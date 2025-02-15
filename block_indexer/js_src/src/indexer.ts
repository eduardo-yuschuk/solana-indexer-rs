// DEPRECATED
// This file is used to index the blocks and save the events to the database.
// It is implemented to read the blocks from the websocket and save the events to the database.
// Use ./fetching/block-indexer.ts to index the blocks instead of this file.

import dotenv from "dotenv";
import WebSocket from "ws";
import { parseBlock } from "./parsing/block.parser";
import { RootObject } from "./parsing/auxiliar/datatypes";
import { PumpFunParser } from "./parsing/protocol/pumpfun/pumpfun.parser";
import { MoonshotParser } from "./parsing/protocol/moonshot/moonshot.parser";
import { RaydiumParser } from "./parsing/protocol/raydium/raydium.parser";
import { SolanaParser } from "./parsing/protocol/solana/solana.parser";
import { IParser } from "./parsing/auxiliar/parsing";
import { saveEvents } from "./storage/storage";
import { exit } from "node:process";
import { obfuscateUrl } from "./util";
import { runBlocksVerifier } from "./verifier";
import * as fs from "fs";
import { Client } from "pg";
import { IndexerEventSource } from "./event";
import { runMoonshotBondingFetcher } from "./fetching/protocol/moonshot/bonding.fetcher";
import { runArchiver } from "./archiver/archive";

dotenv.config();

const version = "2.0.1";
console.log(`Starting Indexer (${version})`);

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
    console.log("Indexer, connected to indexer DB");
  })
  .catch((err) => {
    console.error("Indexer, connection to indexer DB error", err);
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
    console.log("Indexer, connected to backend DB");
  })
  .catch((err) => {
    console.error("Indexer, connection to backend DB error", err);
    exit(1);
  });

const parsers: IParser[] = [];

if (process.env.INDEXERS?.includes(IndexerEventSource.Raydium.toLowerCase())) {
  console.log("Indexer, loading RaydiumParser");
  parsers.push(RaydiumParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Moonshot.toLowerCase())) {
  console.log("Indexer, loading MoonshotParser");
  parsers.push(MoonshotParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Pumpfun.toLowerCase())) {
  console.log("Indexer, loading PumpFunParser");
  parsers.push(PumpFunParser);
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Solana.toLowerCase())) {
  console.log("Indexer, loading SolanaParser");
  parsers.push(SolanaParser);
}

const ws = new WebSocket(process.env.WSS_URL || "");

function sendRequest(ws: WebSocket) {
  const blockSubscribeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "blockSubscribe",
    params: [
      "all",
      {
        encoding: "json",
        maxSupportedTransactionVersion: 0,
        transactionDetails: "full",
        commitment: "confirmed",
        reward: false,
      },
    ],
  };

  ws.send(JSON.stringify(blockSubscribeRequest));
}

ws.on("open", function open() {
  try {
    console.log(`Indexer, WebSocket is open, url: ${obfuscateUrl(ws.url)}`);
    if (process.env.BYPASS_INDEXER) return;
    sendRequest(ws);
    console.log("Indexer, started");
  } catch (e) {
    console.error(e);
    exit(1);
  }
});

const indexingStartTime: { [id: string]: number } = {};

ws.on("message", async function incoming(data: WebSocket.RawData) {
  try {
    const begin = performance.now();

    const dataStr = data.toString("utf8");
    const dataObj = JSON.parse(dataStr);

    if (dataObj.result) return; // skip subscription response

    try {
      const slot = dataObj.params.result.value.slot;
      indexingStartTime[slot] = begin;

      // if (process.env.VERBOSE) {
      //   console.log(` Fetcher, ${slot} | queue: ${queue.length}`);
      // }
    } catch (e) {
      console.error(dataStr);
      throw e;
    }

    queue.push(dataObj);

    await processQueue();
  } catch (e) {
    console.error(e);
    exit(1);
  }
});

const queue: any[] = [];
let isProcessing = false;

const processQueue = async () => {
  try {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
      const dataObj: RootObject = queue.shift();

      const { slot, block } = dataObj.params.result.value;
      const { blockTime } = dataObj.params.result.value.block;

      try {
        const parseBegin = performance.now();

        const { events } = parseBlock(slot, block, parsers);

        const parseEnd = performance.now();
        const parseTime = parseEnd - parseBegin;

        const saveBegin = performance.now();

        const { rowsCount, eventsBySourceAndType: _ } = await saveEvents(
          indexerDbClient,
          backendDbClient,
          { slot, blockTime },
          events,
        );

        const saveEnd = performance.now();
        const saveTime = saveEnd - saveBegin;

        const totalTime = performance.now() - indexingStartTime[slot];
        delete indexingStartTime[slot];
        const blockTimeDelay = Math.floor(Date.now() / 1000) - blockTime;
        if (process.env.VERBOSE || queue.length > 5) {
          // const report = buildEventsReport(eventsBySourceAndType);
          const report = `parsing: ${parseTime.toFixed(1).padStart(5)} ms | writing: ${saveTime.toFixed(1).padStart(5)} ms`;
          console.log(
            ` Indexer, ${slot} | roundtrip: ${totalTime.toFixed(1).padStart(5)} ms | block_age: ${blockTimeDelay.toFixed(0).padStart(3)} s | db_rows: ${rowsCount.toFixed(0).padStart(3)} | queue_size: ${queue.length} | (${report})`,
          );
        }
      } catch (e) {
        // print the block number and throw the error to exit the process
        console.error(`Indexer, processQueue: error processing block ${slot}`);
        throw e;
      }
    }

    isProcessing = false;
  } catch (e) {
    console.error(e);
    exit(1);
  }
};

ws.on("error", function error(err: any) {
  console.error("Indexer, WebSocket error:", err);
  exit(1);
});

ws.on("close", function close() {
  console.error("Indexer, WebSocket is closed");
  exit(1);
});

runBlocksVerifier();
runMoonshotBondingFetcher();
runArchiver();
