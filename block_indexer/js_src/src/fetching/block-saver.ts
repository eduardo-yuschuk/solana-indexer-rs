import dotenv from "dotenv";
import WebSocket from "ws";
import { exit } from "node:process";
import * as fs from "fs";
import { Client } from "pg";
import * as pako from "pako";
import { dbQueryWithValues } from "../storage/wrapper";
import { obfuscateUrl } from "../util";

const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";
// const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

const PROGRAM_IDS_TO_IGNORE = [
  VOTE_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  // Note: System program is not ignored because it is used in the transfers parsing
  //SYSTEM_PROGRAM_ID,
];

const isUseful = (address: string): boolean => {
  return !PROGRAM_IDS_TO_IGNORE.includes(address);
};

dotenv.config();

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
    console.log("Block-Saver, connected to indexer DB");
  })
  .catch((err) => {
    console.error("Block-Saver, connection to indexer DB error", err);
    exit(1);
  });

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
    console.log(`Block-Saver, WebSocket is open, url: ${obfuscateUrl(ws.url)}`);
    sendRequest(ws);
  } catch (e) {
    console.error(e);
    exit(1);
  }
});

ws.on("message", async function incoming(data: WebSocket.RawData) {
  try {
    const begin = performance.now();
    const usefulTxs = new Set();

    const dataStr = data.toString("utf8");
    const originalBlockSize = dataStr.length;
    const dataObj = JSON.parse(dataStr);

    if (dataObj.result) return; // skip subscription response

    const { slot, block } = dataObj.params.result.value;
    const { blockTime, transactions } = block;

    const allTxsCount = transactions.length;

    for (const [transactionIndex, transaction_] of transactions.entries()) {
      const { meta, transaction } = transaction_;
      const { innerInstructions, loadedAddresses } = meta;

      if (meta.err != null) {
        continue;
      }
      const { message } = transaction;
      const { accountKeys, instructions } = message;
      for (const [instructionIndex, instruction_] of instructions.entries()) {
        const { programIdIndex } = instruction_;
        const addresses = [
          ...accountKeys,
          ...loadedAddresses.writable,
          ...loadedAddresses.readonly,
        ];
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

    let transactionIndex = transactions.length;
    while (transactionIndex--) {
      if (!usefulTxs.has(transactionIndex)) {
        transactions.splice(transactionIndex, 1);
      }
    }

    const newDataStr = JSON.stringify(block);

    const gzipData = pako.gzip(newDataStr);
    const gzipBlockSize = gzipData.byteLength;

    // block save

    const insertQuery = `
      INSERT INTO block_json (slot, compressed_json, readed) 
      SELECT $1, $2, $3
      WHERE $1 >= (
          SELECT COALESCE(MAX(slot), 0) 
          FROM block_json 
          WHERE verified IS NOT NULL
      )
      ON CONFLICT (slot) DO NOTHING;
    `;
    const values = [slot, gzipData, Math.floor(Date.now() / 1000)];
    await dbQueryWithValues(dbClient, insertQuery, values);

    // time report

    const blockTimeDelay = Math.floor(Date.now() / 1000) - blockTime;

    const totalTime = performance.now() - begin;

    if (process.env.VERBOSE) {
      console.log(
        [
          `Block-Saver, slot: ${slot}`,
          ` | totalTime: ${totalTime.toFixed(1).padStart(5)} ms`,
          ` | blockTimeDelay: ${blockTimeDelay.toFixed(0).padStart(3)} s`,
          ` | usefulTxCount: ${usefulTxs.size.toFixed(0).padStart(4)}/${allTxsCount.toFixed(0).padStart(4)}`,
          ` | originalBlockSize: ${(originalBlockSize / 1024.0).toFixed(2).padStart(8)} Kb`,
          ` | gzipBlockSize: ${(gzipBlockSize / 1024.0).toFixed(2).padStart(8)} Kb`,
        ].join(""),
      );
    }
  } catch (e) {
    console.error(e);
    exit(1);
  }
});

ws.on("error", function error(err: any) {
  console.error("Block-Saver, WebSocket error: ", err);
  exit(1);
});

ws.on("close", function close() {
  console.error("Block-Saver, WebSocket is closed");
  exit(1);
});
