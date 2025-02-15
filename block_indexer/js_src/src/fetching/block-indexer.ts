import dotenv from "dotenv";
import { parseBlock } from "../parsing/block.parser";
import { PumpFunParser } from "../parsing/protocol/pumpfun/pumpfun.parser";
import { MoonshotParser } from "../parsing/protocol/moonshot/moonshot.parser";
import { RaydiumParser } from "../parsing/protocol/raydium/raydium.parser";
import { IEvent, IParser } from "../parsing/auxiliar/parsing";
import { saveEvents } from "../storage/storage";
import { exit } from "node:process";
import * as fs from "fs";
import { Client } from "pg";
import { IndexerEventSource } from "../event";
import pako from "pako";
import { SolanaParser } from "../parsing/protocol/solana/solana.parser";
import { dbQuery, dbQueryWithValues } from "../storage/wrapper";
import { runMoonshotBondingFetcher } from "./protocol/moonshot/bonding.fetcher";
import { runBlocksVerifier } from "./verification";
import { sleep } from "../util";

dotenv.config();

const version = "2.0.1";
console.log(`Starting Block-Indexer (${version})`);

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
    console.log("Block-Indexer, connected to indexer DB");
  })
  .catch((err) => {
    console.error("Block-Indexer, connection to indexer DB error", err);
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
    console.log("Block-Indexer, connected to backend DB");
  })
  .catch((err) => {
    console.error("Block-Indexer, connection to backend DB error", err);
    exit(1);
  });

const parsers: IParser[] = [];

if (process.env.INDEXERS?.includes(IndexerEventSource.Raydium.toLowerCase())) {
  console.log("Block-Indexer, loading RaydiumParser");
  parsers.push(RaydiumParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Moonshot.toLowerCase())) {
  console.log("Block-Indexer, loading MoonshotParser");
  parsers.push(MoonshotParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Pumpfun.toLowerCase())) {
  console.log("Block-Indexer, loading PumpFunParser");
  parsers.push(PumpFunParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Solana.toLowerCase())) {
  console.log("Block-Indexer, loading SolanaParser");
  parsers.push(SolanaParser);
}

const main = async () => {
  try {
    while (true) {
      // get 10 blocks from the database
      const selectQuery = `
        SELECT slot, compressed_json
        FROM block_json
        WHERE verified IS NOT NULL
          AND indexed IS NULL
        ORDER BY slot
        LIMIT 10;
      `;
      const result = await dbQuery(indexerDbClient, selectQuery);
      const slotAndCompressedJsonArray = result.rows.map((row) => [
        row.slot,
        row.compressed_json,
      ]);

      if (slotAndCompressedJsonArray.length == 0) {
        await sleep(100);
        continue;
      }

      // TODO skip indexed blocks (read blocks table) (?)

      for (const [slot, compressed_json] of slotAndCompressedJsonArray) {
        try {
          const begin = performance.now();

          if (compressed_json === null || compressed_json.length === 0) {
            if (!process.env.BYPASS_STORAGE) {
              const updateQuery = `UPDATE block_json SET indexed = $1 WHERE slot = $2;`;
              const values = [Math.floor(Date.now() / 1000), slot];
              await dbQueryWithValues(indexerDbClient, updateQuery, values);
            }
            if (process.env.VERBOSE) {
              console.log(`Block-Indexer, ${slot} | db_rows: 0 | (empty slot)`);
            }
            continue;
          }

          const dataStr = pako.ungzip(compressed_json, { to: "string" });
          const dataObj = JSON.parse(dataStr, (_key, value) => {
            if (value && value.type === "Buffer" && Array.isArray(value.data)) {
              return Buffer.from(value.data);
            }
            return value;
          });

          // const { slot, block } = dataObj.params.result.value;
          const { blockTime } = dataObj;

          const parseBegin = performance.now();

          let parseBlockResult: {
            events: IEvent[];
            elapsedTime: number;
          } | null = null;

          try {
            parseBlockResult = parseBlock(slot, dataObj, parsers);
          } catch (e) {
            console.error(`Block-Indexer, error parsing block ${slot}`);
            throw e;
          }

          const parseEnd = performance.now();
          const parseTime = parseEnd - parseBegin;

          if (parseBlockResult != null) {
            const saveBegin = performance.now();

            const { events } = parseBlockResult;

            const { rowsCount, eventsBySourceAndType: _ } = await saveEvents(
              indexerDbClient,
              backendDbClient,
              { slot, blockTime },
              events,
            );

            const saveEnd = performance.now();
            const saveTime = saveEnd - saveBegin;
            const totalTime = performance.now() - begin;
            const blockTimeDelay = Math.floor(Date.now() / 1000) - blockTime;

            if (process.env.VERBOSE) {
              // const report = buildEventsReport(eventsBySourceAndType);
              const report = `parsing: ${parseTime.toFixed(1).padStart(5)} ms | writing: ${saveTime.toFixed(1).padStart(5)} ms`;
              console.log(
                ` Block-Indexer, ${slot} | roundtrip: ${totalTime.toFixed(1).padStart(5)} ms | block_age: ${blockTimeDelay.toFixed(0).padStart(3)} s | db_rows: ${rowsCount.toFixed(0).padStart(3)} | (${report})`,
              );
            }
          }

          if (!process.env.BYPASS_STORAGE) {
            const updateQuery = `UPDATE block_json SET indexed = $1 WHERE slot = $2;`;
            const values = [Math.floor(Date.now() / 1000), slot];
            await dbQueryWithValues(indexerDbClient, updateQuery, values);
          }
        } catch (e) {
          // print the block number and throw the error to exit the process
          console.error(`Block-Indexer, error processing block ${slot}`);
          throw e;
        }
      }
    }
  } catch (e) {
    console.error(e);
    exit(1);
  }
};

runBlocksVerifier();
runMoonshotBondingFetcher();
main();
