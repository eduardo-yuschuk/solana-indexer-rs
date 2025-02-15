import { IEvent, stringifyObj } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";
import pako from "pako";

const LAST_TRADES_COUNT = 50;

interface IRaydiumLastTradeValues {
  timestamp: number;
  isBuy: boolean;
  tokenAmount: bigint;
  solAmount: bigint;
  sender: string;
}

// TODO: add isBuy to this function and use everywhere
function getTokenAndSolAmounts(rayLog: any): {
  tokenAmount: bigint;
  solAmount: bigint;
} {
  if (rayLog.log_type == "SwapBaseIn") {
    if (rayLog.direction == 1) {
      return {
        tokenAmount: rayLog.amount_in,
        solAmount: rayLog.out_amount,
      };
    }

    if (rayLog.direction == 2) {
      return {
        tokenAmount: rayLog.out_amount,
        solAmount: rayLog.amount_in,
      };
    }

    throw new Error(`Unknown Raydium swap direction ${rayLog.direction}`);
  }

  if (rayLog.log_type == "SwapBaseOut") {
    if (rayLog.direction == 1) {
      return {
        tokenAmount: rayLog.deduct_in,
        solAmount: rayLog.amount_out,
      };
    }

    if (rayLog.direction == 2) {
      return {
        tokenAmount: rayLog.amount_out,
        solAmount: rayLog.deduct_in,
      };
    }

    throw new Error(`Unknown Raydium swap direction ${rayLog.direction}`);
  }

  throw new Error(`Unknown Raydium swap type ${rayLog.log_type}`);
}

export async function saveLastTrades(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { slot } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradeEventsWithMintAndRayLog = tradeEvents.filter((event) => {
    const { eventMeta, rayLogEventData: rayLog } = event as any;
    return eventMeta.mint !== undefined && rayLog !== undefined;
  });

  if (tradeEventsWithMintAndRayLog.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(
      tradeEventsWithMintAndRayLog.map((event) => event.eventMeta.mint),
    ),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, trades FROM last_trades WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IRaydiumLastTradeValues[] } = {};

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

  for (const event of tradeEventsWithMintAndRayLog) {
    const { eventObj, eventMeta, rayLogEventData: rayLog } = event as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const { tokenAmount, solAmount } = getTokenAndSolAmounts(rayLog);
    const value: IRaydiumLastTradeValues = {
      timestamp: eventMeta.timestamp,
      isBuy,
      tokenAmount,
      solAmount,
      sender: eventMeta.user,
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

  const tradeEventsWithMintAndRayLog = tradeEvents.filter((event) => {
    const { eventMeta, rayLogEventData: rayLog } = event as any;
    return eventMeta.mint !== undefined && rayLog !== undefined;
  });

  if (tradeEventsWithMintAndRayLog.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(
      tradeEventsWithMintAndRayLog.map((event) => event.eventMeta.mint),
    ),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, compressed_json FROM last_trades_zip WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IRaydiumLastTradeValues[] } = {};

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

  for (const event of tradeEventsWithMintAndRayLog) {
    const { eventObj, eventMeta, rayLogEventData: rayLog } = event as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const { tokenAmount, solAmount } = getTokenAndSolAmounts(rayLog);
    const value: IRaydiumLastTradeValues = {
      timestamp: eventMeta.timestamp,
      isBuy,
      tokenAmount,
      solAmount,
      sender: eventMeta.user,
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

  const tradeEventsWithMintAndRayLog = tradeEvents.filter((event) => {
    const { eventMeta, rayLogEventData: rayLog } = event as any;
    return eventMeta.mint !== undefined && rayLog !== undefined;
  });

  if (tradeEventsWithMintAndRayLog.length === 0) return { rowsCount: 0 };

  const tradeEventsMints = [
    ...new Set(
      tradeEventsWithMintAndRayLog.map((event) => event.eventMeta.mint),
    ),
  ];

  // read current last trades from db

  const placeholders = tradeEventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, trades FROM last_trades_json WHERE mint IN (${placeholders});`;

  const mintToTradesMap: { [mint: string]: IRaydiumLastTradeValues[] } = {};

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

  for (const event of tradeEventsWithMintAndRayLog) {
    const { eventObj, eventMeta, rayLogEventData: rayLog } = event as any;
    const mint = eventMeta.mint;
    if (!mintToTradesMap[mint]) {
      mintToTradesMap[mint] = [];
    }
    const isBuy = eventObj.instructionType === "Buy";
    const { tokenAmount, solAmount } = getTokenAndSolAmounts(rayLog);
    const value: IRaydiumLastTradeValues = {
      timestamp: eventMeta.timestamp,
      isBuy,
      tokenAmount,
      solAmount,
      sender: eventMeta.user,
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
