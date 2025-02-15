import { IEvent, stringifyObj } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";
import pako from "pako";

const LAST_TRADES_COUNT = 50;

interface IMoonshotLastTradeValues {
  timestamp: number;
  isBuy: boolean;
  tokenAmount: bigint;
  solAmount: bigint;
  sender: string;
}

export async function saveLastTrades(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { slot } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(tradeEvents.map((event) => event.eventMeta.mint)),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, trades FROM last_trades WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IMoonshotLastTradeValues[] } = {};

  try {
    const result = await dbQueryWithValues(
      client,
      mintsQuery,
      tradeEventsMints,
    );
    for (const row of result.rows) {
      mintToTradesMap[row.mint] = row.trades;
    }
  } catch (err) {
    console.error("Error fetching last_trades: ", err);
    throw err;
  }

  // merge the new trades with the current trades

  for (const tradeEvent of tradeEvents) {
    const { eventObj, eventMeta, eventLog } = tradeEvent as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const value: IMoonshotLastTradeValues = {
      timestamp: eventMeta.blockTime,
      isBuy,
      tokenAmount: eventLog.amount,
      solAmount: eventLog.collateralAmount,
      sender: eventMeta.sender,
    };
    mintToTradesMap[mint].push(value);
  }

  // update the db

  const insertQuery = `
      INSERT INTO last_trades (
        mint, 
        trades,
        updated_slot
      ) VALUES
      ${tradeEventsMints
        .map(
          (_, index) =>
            `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO UPDATE SET trades = EXCLUDED.trades, updated_slot = EXCLUDED.updated_slot;
    `;

  const values = Object.keys(mintToTradesMap).flatMap((mint) => {
    const trades = mintToTradesMap[mint];
    trades.sort((a, b) => b.timestamp - a.timestamp);
    const lastTrades = trades.slice(0, LAST_TRADES_COUNT);
    return [mint, stringifyObj(lastTrades), slot];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating last_trades:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveLastTradesZip(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { slot } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(tradeEvents.map((event) => event.eventMeta.mint)),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, compressed_json FROM last_trades_zip WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IMoonshotLastTradeValues[] } = {};

  try {
    const result = await dbQueryWithValues(
      client,
      mintsQuery,
      tradeEventsMints,
    );
    for (const row of result.rows) {
      const dataStr = pako.ungzip(row.compressed_json, { to: "string" });
      const dataObj = JSON.parse(dataStr);
      mintToTradesMap[row.mint] = dataObj;
    }
  } catch (err) {
    console.error("Error fetching last_trades_zip: ", err);
    throw err;
  }

  // merge the new trades with the current trades

  for (const tradeEvent of tradeEvents) {
    const { eventObj, eventMeta, eventLog } = tradeEvent as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const value: IMoonshotLastTradeValues = {
      timestamp: eventMeta.blockTime,
      isBuy,
      tokenAmount: eventLog.amount,
      solAmount: eventLog.collateralAmount,
      sender: eventMeta.sender,
    };
    mintToTradesMap[mint].push(value);
  }

  // update the db

  const insertQuery = `
      INSERT INTO last_trades_zip (
        mint, 
        compressed_json,
        updated_slot
      ) VALUES
      ${tradeEventsMints
        .map(
          (_, index) =>
            `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO UPDATE SET compressed_json = EXCLUDED.compressed_json, updated_slot = EXCLUDED.updated_slot;
    `;

  const values = Object.keys(mintToTradesMap).flatMap((mint) => {
    const trades = mintToTradesMap[mint];
    trades.sort((a, b) => b.timestamp - a.timestamp);
    const lastTrades = trades.slice(0, LAST_TRADES_COUNT);
    const compressed_json = pako.gzip(stringifyObj(lastTrades));
    return [mint, compressed_json, slot];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating last_trades_zip:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveLastTradesJson(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { slot } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(tradeEvents.map((event) => event.eventMeta.mint)),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, trades FROM last_trades_json WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IMoonshotLastTradeValues[] } = {};

  try {
    const result = await dbQueryWithValues(
      client,
      mintsQuery,
      tradeEventsMints,
    );
    for (const row of result.rows) {
      mintToTradesMap[row.mint] = row.trades;
    }
  } catch (err) {
    console.error("Error fetching last_trades_json: ", err);
    throw err;
  }

  // merge the new trades with the current trades

  for (const tradeEvent of tradeEvents) {
    const { eventObj, eventMeta, eventLog } = tradeEvent as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const value: IMoonshotLastTradeValues = {
      timestamp: eventMeta.blockTime,
      isBuy,
      tokenAmount: eventLog.amount,
      solAmount: eventLog.collateralAmount,
      sender: eventMeta.sender,
    };
    mintToTradesMap[mint].push(value);
  }

  // update the db

  const insertQuery = `
      INSERT INTO last_trades_json (
        mint, 
        trades,
        updated_slot
      ) VALUES
      ${tradeEventsMints
        .map(
          (_, index) =>
            `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO UPDATE SET trades = EXCLUDED.trades, updated_slot = EXCLUDED.updated_slot;
    `;

  const values = Object.keys(mintToTradesMap).flatMap((mint) => {
    const trades = mintToTradesMap[mint];
    trades.sort((a, b) => b.timestamp - a.timestamp);
    const lastTrades = trades.slice(0, LAST_TRADES_COUNT);
    return [mint, stringifyObj(lastTrades), slot];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating last_trades_json:", err);
    throw err;
  }

  return { rowsCount };
}
