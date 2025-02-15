import dotenv from "dotenv";
import { exit } from "node:process";
import * as fs from "fs";
import { Client } from "pg";
import * as pako from "pako";
import web3, { PublicKey } from "@solana/web3.js";
import { dbQuery, dbQueryWithValues } from "../storage/wrapper";
import { sleep } from "../util";

dotenv.config();

// configuration //////////////////////////////////////////////////////////////////////////////////

const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";
// const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

const PROGRAM_IDS_TO_IGNORE = [
  VOTE_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  // Note: System program is not ignored because it is used in the transfers parsing
  //SYSTEM_PROGRAM_ID,
];

const SLEEP_MS_BASE = 50;
const NO_NEW_BLOCKS_SLEEP_MS = 200;
const RECOVERED_BLOCK_SLEEP_MS = 500;

// rpc ////////////////////////////////////////////////////////////////////////////////////////////

const rpcConnection = new web3.Connection(process.env.RPC_URL || "");

// db /////////////////////////////////////////////////////////////////////////////////////////////

const dbClient = new Client({
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

dbClient
  .connect()
  .then(() => {
    console.log("Block-Verifier, connected to indexer DB");
  })
  .catch((err) => {
    console.error("Block-Verifier, connection to indexer DB error", err);
    exit(1);
  });

// utils //////////////////////////////////////////////////////////////////////////////////////////

function asStringArray(keys: PublicKey[] | string[]): string[] {
  if (keys.length == 0) return [];
  if (keys[0] instanceof PublicKey) {
    return (keys as PublicKey[]).map((key: PublicKey) => key.toBase58());
  }
  return keys as string[];
}

// auxiliar ///////////////////////////////////////////////////////////////////////////////////////

function isUseful(address: string): boolean {
  return !PROGRAM_IDS_TO_IGNORE.includes(address);
}

function removeUselessTransactions(block: any): string {
  // this data structure is used to create the useful tx only
  // it doesn't determine the order of transactions
  const usefulTxs = new Set();

  const { transactions } = block;

  for (const [transactionIndex, transaction_] of transactions.entries()) {
    const { meta, transaction } = transaction_;
    const { innerInstructions } = meta;

    // // discard failed transactions
    // if (meta.err != null) {
    //   continue;
    // }

    let resolvedInstructions = transaction.message.instructions;
    if (resolvedInstructions == undefined) {
      resolvedInstructions = transaction.message.compiledInstructions;
    }
    for (const [
      instructionIndex,
      instruction_,
    ] of resolvedInstructions.entries()) {
      const { programIdIndex } = instruction_;
      let addresses: string[];
      if (transaction.message.accountKeys) {
        addresses = [
          ...asStringArray(transaction.message.accountKeys),
          ...asStringArray(meta.loadedAddresses.writable),
          ...asStringArray(meta.loadedAddresses.readonly),
        ];
      } else {
        addresses = [
          ...asStringArray(transaction.message.staticAccountKeys),
          ...asStringArray(meta.loadedAddresses.writable),
          ...asStringArray(meta.loadedAddresses.readonly),
        ];
      }
      const invokedProgram = addresses[programIdIndex];

      if (isUseful(invokedProgram)) {
        usefulTxs.add(transactionIndex);
      }

      const innerGroup = innerInstructions.find(
        (group: any) => group.index == instructionIndex,
      );

      if (innerGroup == undefined) {
        continue;
      }

      for (const [
        _innerInstructionIndex,
        innerInstruction_,
      ] of innerGroup.instructions.entries()) {
        const { programIdIndex } = innerInstruction_;
        const invokedProgram = addresses[programIdIndex];

        if (isUseful(invokedProgram)) {
          usefulTxs.add(transactionIndex);
        }
      }
    }
  }

  // remove the useless transactions

  let transactionIndex = transactions.length;
  while (transactionIndex--) {
    if (!usefulTxs.has(transactionIndex)) {
      transactions.splice(transactionIndex, 1);
    }
  }

  const newDataStr = JSON.stringify(block);

  return newDataStr;
}

async function recoverBlock(slot: number): Promise<number> {
  try {
    const block = await rpcConnection.getBlock(slot, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
      rewards: false,
      transactionDetails: "full",
    });

    const minifiedBlock = removeUselessTransactions(block);
    // compress block
    const gzipBlock = pako.gzip(minifiedBlock);

    const insertQuery = `
      INSERT INTO block_json (slot, compressed_json, recovered, verified) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (slot) DO NOTHING;`;
    const currentTime = Math.floor(Date.now() / 1000);
    const values = [slot, gzipBlock, currentTime, currentTime];
    await dbQueryWithValues(dbClient, insertQuery, values);

    return gzipBlock.byteLength;
  } catch (err: any) {
    // "failed to get confirmed block: Slot SLOT_NUMBER was skipped, or missing due to ledger jump to recent snapshot"

    if ((err.message as string).startsWith("failed to get confirmed block")) {
      const insertQuery = `
        INSERT INTO block_json (slot, recovered, verified) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (slot) DO NOTHING;`;
      const currentTime = Math.floor(Date.now() / 1000);
      const values = [slot, currentTime, currentTime];
      await dbQueryWithValues(dbClient, insertQuery, values);
    } else {
      console.error("Block-Verifier, error recovering block", err);
    }

    return 0;
  }
}

async function getFirstUnverifiedSlot(): Promise<number | undefined> {
  const selectQuery = `
      SELECT slot FROM block_json 
      WHERE verified IS NULL 
      ORDER BY slot
      LIMIT 1;`;

  const result = await dbQuery(dbClient, selectQuery);
  const slots = result.rows.map((row) => row.slot);

  if (slots.length == 1) {
    const firstUnverifiedSlot = slots[0];
    return firstUnverifiedSlot;
  }

  return undefined;
}

async function getLastVerifiedSlot(): Promise<number | undefined> {
  const selectQuery = `
      SELECT slot FROM block_json 
      WHERE verified IS NOT NULL 
      ORDER BY slot DESC
      LIMIT 1;`;

  const result = await dbQuery(dbClient, selectQuery);
  const slots = result.rows.map((row) => row.slot);

  if (slots.length == 1) {
    const lastVerifiedSlot = slots[0];
    return lastVerifiedSlot;
  }

  return undefined;
}

async function getSlot(slot: number): Promise<number | undefined> {
  const selectQuery = `
      SELECT slot FROM block_json 
      WHERE slot = ${slot};`;

  const result = await dbQuery(dbClient, selectQuery);
  const slots = result.rows.map((row) => row.slot);

  if (slots.length == 1) {
    const slot = slots[0];
    return slot;
  }

  return undefined;
}

async function markSlotAsVerified(slot: number): Promise<void> {
  const updateQuery = `UPDATE block_json SET verified = $1 WHERE slot = $2;`;
  const values = [Math.floor(Date.now() / 1000), slot];
  await dbQueryWithValues(dbClient, updateQuery, values);
}

async function getFirstSlot(): Promise<number | undefined> {
  const selectQuery = `
      SELECT slot FROM block_json 
      ORDER BY slot
      LIMIT 1;`;

  const result = await dbQuery(dbClient, selectQuery);
  const slots = result.rows.map((row) => row.slot);

  if (slots.length == 1) {
    return slots[0];
  }

  return undefined;
}

// main ///////////////////////////////////////////////////////////////////////////////////////////

interface VerifySlotResult {
  slot: number | undefined;
  slotVerified: boolean;
  slotRecovered: boolean;
  gzipBlockSize: number | undefined;
}

async function verifyFirstSlotEver(): Promise<VerifySlotResult> {
  const result: VerifySlotResult = {
    slot: undefined,
    slotVerified: false,
    slotRecovered: false,
    gzipBlockSize: undefined,
  };

  result.slot = await getFirstSlot();

  if (result.slot === undefined) {
    return result;
  }

  await markSlotAsVerified(result.slot);
  result.slotVerified = true;

  return result;
}

async function verifyNextSlot(
  lastVerifiedSlot: number,
): Promise<VerifySlotResult> {
  const result: VerifySlotResult = {
    slot: lastVerifiedSlot + 1,
    slotVerified: false,
    slotRecovered: false,
    gzipBlockSize: undefined,
  };

  const firstUnverifiedSlot = await getFirstUnverifiedSlot();

  // there are no more slots to verify
  if (firstUnverifiedSlot == undefined) {
    return result;
  }

  // get the next slot to verify
  const readedNextSlot = await getSlot(result.slot as number);

  if (readedNextSlot == undefined) {
    const gzipBlockSize = await recoverBlock(result.slot as number);
    result.slotRecovered = true;
    result.gzipBlockSize = gzipBlockSize;
  }

  await markSlotAsVerified(result.slot as number);
  result.slotVerified = true;

  return result;
}

async function verifySlots(): Promise<VerifySlotResult> {
  const lastVerifiedSlot = await getLastVerifiedSlot();

  if (lastVerifiedSlot == undefined) {
    return await verifyFirstSlotEver();
  } else {
    return await verifyNextSlot(lastVerifiedSlot);
  }
}

async function purgeIndexedSlots(slot: number) {
  // delete the first 10 indexed slots
  const deleteQuery = `
    DELETE FROM block_json 
    WHERE slot IN (
      SELECT slot 
      FROM block_json 
      WHERE indexed IS NOT NULL 
      AND slot < (${slot} - 10)
      ORDER BY slot 
      LIMIT 10
    )`;
  await dbQuery(dbClient, deleteQuery);
}

function printResult(result: VerifySlotResult, time: number) {
  const logInfo = [];

  if (!result.slotRecovered) return;

  if (result.slotVerified) {
    logInfo.push(`Block-Verifier, ${result.slot}`);
    logInfo.push(` | slot ${result.slot} verified`);

    if (result.slotRecovered) {
      logInfo.push(` | slotRecovered: ${result.slotRecovered}`);
      logInfo.push(
        ` | gzipBlockSize: ${((result.gzipBlockSize as number) / 1024.0).toFixed(2).padStart(8)} Kb`,
      );
    }

    logInfo.push(` | roundtrip: ${time.toFixed(1).padStart(5)} ms`);
  }

  if (logInfo.length > 0) {
    console.log(logInfo.join(""));
  }
}

export async function runBlocksVerifier() {
  while (true) {
    const begin = performance.now();

    const result = await verifySlots();

    if (result.slot != undefined) {
      await purgeIndexedSlots(result.slot);
    }

    const end = performance.now();
    const time = end - begin;

    if (process.env.VERBOSE) {
      printResult(result, time);
    }

    // we always sleep the base time to avoid database locking
    let sleepTime = SLEEP_MS_BASE;

    // there are no new data, so we sleep more
    if (!result.slotVerified) {
      sleepTime = NO_NEW_BLOCKS_SLEEP_MS;
    }

    // there was a block recovered, so we sleep more to avoid spamming the RPC
    if (result.slotRecovered) {
      sleepTime = RECOVERED_BLOCK_SLEEP_MS;
    }

    await sleep(sleepTime);
  }
}
