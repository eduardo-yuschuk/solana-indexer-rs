// DEPRECATED
// This file is used to verify the blocks and save the events to the database.
// If it finds a block that is not indexed, it will index it and save the events to the database.
// This approach requires complete support for disordered blocks indexing.
// (i.e. an old event can be indexed after a new one without compromising the consistency of the data)
// Use ./fetching/block-verifier.ts to verify the blocks instead of this file.

import dotenv from "dotenv";
import * as fs from "fs";
import { Client } from "pg";
import { exit } from "node:process";
import web3 from "@solana/web3.js";
import { parseBlock } from "./parsing/block.parser";
import { PumpFunParser } from "./parsing/protocol/pumpfun/pumpfun.parser";
import { MoonshotParser } from "./parsing/protocol/moonshot/moonshot.parser";
import { RaydiumParser } from "./parsing/protocol/raydium/raydium.parser";
import { SolanaParser } from "./parsing/protocol/solana/solana.parser";
import { IParser } from "./parsing/auxiliar/parsing";
import { buildEventsReport, range, sleep } from "./util";
import { saveEvents } from "./storage/storage";
import { IndexerEventSource } from "./event";
import { dbQuery } from "./storage/wrapper";

dotenv.config();

const indexerDbClient = new Client({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
  ssl:
    process.env.DB_DISABLE_SSL == "true"
      ? undefined
      : {
          ca: fs.readFileSync("aws/rds-global-bundle.pem").toString(),
        },
});

indexerDbClient
  .connect()
  .then(() => {
    console.log("Verifier, connected to DB");
  })
  .catch((err) => {
    console.error("Verifier, connection error", err.stack);
    exit(1);
  });

const backendDbClient = new Client({
  user: process.env.BACKEND_DB_USERNAME,
  host: process.env.BACKEND_DB_HOST,
  database: process.env.BACKEND_DB_NAME,
  password: process.env.BACKEND_DB_PASSWORD,
  port: parseInt(process.env.BACKEND_DB_PORT || "5432"),
  ssl:
    process.env.BACKEND_DB_DISABLE_SSL == "true"
      ? undefined
      : {
          ca: fs.readFileSync("aws/rds-global-bundle.pem").toString(),
        },
});

backendDbClient
  .connect()
  .then(() => {
    console.log("Verifier, connected to backend DB");
  })
  .catch((err) => {
    console.error("Verifier, connection to backend DB error", err.stack);
    exit(1);
  });

const parsers: IParser[] = [];

if (process.env.INDEXERS?.includes(IndexerEventSource.Raydium.toLowerCase())) {
  console.log("Verifier, loading RaydiumParser");
  parsers.push(RaydiumParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Moonshot.toLowerCase())) {
  console.log("Verifier, loading MoonshotParser");
  parsers.push(MoonshotParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Pumpfun.toLowerCase())) {
  console.log("Verifier, loading PumpFunParser");
  parsers.push(PumpFunParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Solana.toLowerCase())) {
  console.log("Indexer, loading SolanaParser");
  parsers.push(SolanaParser);
}

const rpcConnection = new web3.Connection(process.env.RPC_URL || "");

export async function runBlocksVerifier() {
  if (process.env.RUN_VERIFIER) {
    while (true) {
      await verifyBlocks(indexerDbClient, backendDbClient);
      await sleep(1000);
    }
  }
}

export async function indexBlock(slot: number) {
  await indexMissingBlock(indexerDbClient, backendDbClient, slot);
}

async function getUnverifiedSlots(
  client: Client,
  count: number,
): Promise<number[]> {
  const query = `
    SELECT slot 
    FROM public.blocks 
    WHERE verified IS NULL 
    ORDER BY slot ASC 
    LIMIT ${count};
  `;

  try {
    const result = await dbQuery(client, query);
    return result.rows.map((row: any) => Number(row.slot));
  } catch (err) {
    console.error("Verifier, error fetching unverified slots: ", err);
    return [];
  }
}

async function getLastVerifiedSlot(client: Client): Promise<number | null> {
  const query = `
      SELECT slot 
      FROM public.blocks 
      WHERE verified IS NOT NULL 
      ORDER BY slot DESC 
      LIMIT 1;
    `;

  try {
    const result = await dbQuery(client, query);
    return result.rows.length > 0 ? Number(result.rows[0].slot) : null;
  } catch (err) {
    console.error("Verifier, error fetching the last verified slot: ", err);
    return null;
  }
}

async function verifySlot(client: Client, slot: number) {
  if (process.env.BYPASS_STORAGE) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const upsertQuery = `
    UPDATE public.blocks SET verified = ${timestamp}
    WHERE slot = ${slot};
  `;

  try {
    await dbQuery(client, upsertQuery);
  } catch (err) {
    console.error("Verifier, error updating blocks: ", err);
  }
}

async function addEmptySlot(client: Client, slot: number) {
  if (process.env.BYPASS_STORAGE) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const upsertQuery = `
    INSERT INTO public.blocks (slot, status, verified)
    VALUES (${slot}, 'E', ${timestamp})
    ON CONFLICT (slot) DO NOTHING
  `;

  try {
    await dbQuery(client, upsertQuery);
  } catch (err) {
    console.error("Verifier, error on insert blocks: ", err);
  }
}

async function setAsRecoveredSlot(client: Client, slot: number) {
  if (process.env.BYPASS_STORAGE) {
    return;
  }

  const verified = Math.floor(Date.now() / 1000);
  const upsertQuery = `
    UPDATE public.blocks SET status = 'R', verified = ${verified}
    WHERE slot = ${slot}
  `;

  try {
    await dbQuery(client, upsertQuery);
  } catch (err) {
    console.error("Verifier, error on update blocks: ", err);
  }
}

async function indexMissingBlock(
  indexerDbClient: Client,
  backendDbClient: Client,
  slot: number,
) {
  const block = await rpcConnection.getBlock(slot, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
    rewards: false,
    transactionDetails: "full",
  });

  if (block != null) {
    const { events } = parseBlock(
      Number(slot),
      {
        previousBlockhash: block.previousBlockhash,
        blockhash: block.blockhash,
        parentSlot: block.parentSlot,
        transactions: block.transactions,
        blockTime: block.blockTime,
        blockHeight: 0,
      },
      parsers,
    );

    if (process.env.DUMP_EVENTS) {
      for (const event of events) {
        console.log(event);
      }
    }

    const { rowsCount, eventsBySourceAndType } = await saveEvents(
      indexerDbClient,
      backendDbClient,
      { slot, blockTime: Number(block.blockTime) },
      events,
    );

    await setAsRecoveredSlot(indexerDbClient, slot);

    if (process.env.VERBOSE) {
      const eventsReport = buildEventsReport(eventsBySourceAndType);
      const blockTimeDelay =
        block.blockTime != null
          ? Math.floor(Date.now() / 1000) - block.blockTime
          : 0;
      console.log(
        `Verifier, ${slot} | blockTimeDelay: ${blockTimeDelay.toFixed(0).padStart(3)} s | rowsCount: ${rowsCount.toFixed(0).padStart(3)} | (${eventsReport})`,
      );
    }
  } else {
    console.error(`Verifier, getBlock RPC call failed (slot: ${slot})`);
  }
}

async function verifyBlocks(indexerDbClient: Client, backendDbClient: Client) {
  const unverifiedSlots = await getUnverifiedSlots(indexerDbClient, 100);
  const lastVerifiedSlot = await getLastVerifiedSlot(indexerDbClient);

  if (
    lastVerifiedSlot != null &&
    unverifiedSlots.length > 0 &&
    unverifiedSlots[0] - lastVerifiedSlot > 1
  ) {
    // fill the gap between the last verified slot and the first unverified slot

    const firstMissingSlot = lastVerifiedSlot + 1;
    const lastMissingSlot = unverifiedSlots[0] - 1;

    const confirmedBlocks = await rpcConnection.getBlocks(
      firstMissingSlot,
      lastMissingSlot,
      "confirmed",
    );

    if (process.env.VERBOSE) {
      console.log(
        `Verifier, filling the gap between the last verified slot and the first unverified slot (confirmedBlocks: ${confirmedBlocks.length})`,
      );
    }

    for (const missingSlot of range(firstMissingSlot, lastMissingSlot)) {
      if (confirmedBlocks.includes(missingSlot)) {
        await indexMissingBlock(indexerDbClient, backendDbClient, missingSlot);
        await sleep(10);
      } else {
        await addEmptySlot(indexerDbClient, missingSlot);
      }
    }
  } else {
    // verify the slots when there are no more missing slots

    if (unverifiedSlots.length == 0) return;

    const confirmedBlocks = await rpcConnection.getBlocks(
      unverifiedSlots[0],
      unverifiedSlots[unverifiedSlots.length - 1],
      "confirmed",
    );

    if (process.env.VERBOSE) {
      console.log(
        `Verifier, verifiying blocks (confirmedBlocks: ${confirmedBlocks.length})`,
      );
    }

    const unverifiedSlotPairs = unverifiedSlots
      .slice(0, -1)
      .map((value, index) => [value, unverifiedSlots[index + 1]]);

    for (const [firstSlot, lastSlot] of unverifiedSlotPairs) {
      await verifySlot(indexerDbClient, firstSlot);
      for (const missingSlot of range(firstSlot + 1, lastSlot - 1)) {
        if (confirmedBlocks.includes(missingSlot)) {
          await indexMissingBlock(
            indexerDbClient,
            backendDbClient,
            missingSlot,
          );
          await sleep(10);
        } else {
          await addEmptySlot(indexerDbClient, missingSlot);
        }
      }
    }
  }
}
