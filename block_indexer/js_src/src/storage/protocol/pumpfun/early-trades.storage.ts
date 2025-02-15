import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { dbQuery, dbQueryWithValues } from "../../wrapper";

const SNIPER_MINT_CREATION_BLOCK_RANGE = 10;

export function markEarlyTradeEvents(
  mintEvents: IEvent[],
  tradeEvents: IEvent[],
) {
  if (mintEvents.length === 0 || tradeEvents.length === 0) return;

  assertNonFailedTransaction(mintEvents);
  assertNonFailedTransaction(tradeEvents);

  for (const mintEvent of mintEvents) {
    const { eventObj } = mintEvent;
    let { decodedMint } = eventObj;
    if (decodedMint == undefined) decodedMint = eventObj;

    const mintEventMint = decodedMint.mint.toBase58();
    const mintEventUser = decodedMint.user.toBase58();
    for (const tradeEvent of tradeEvents) {
      const { eventObj } = tradeEvent;
      let { decodedTrade } = eventObj;
      if (decodedTrade == undefined) decodedTrade = eventObj;
      const tradeEventMint = decodedTrade.mint.toBase58();
      const tradeEventUser = decodedTrade.user.toBase58();
      tradeEvent.eventMeta = {
        ...tradeEvent.eventMeta,
        isEarly:
          tradeEventMint === mintEventMint && tradeEventUser !== mintEventUser,
        mintBlock: mintEvent.slot,
      };
    }
  }
}

export async function markSniperTradeEvents(
  tradeEvents: IEvent[],
  client: Client,
  blockData: IBlockData,
) {
  if (tradeEvents.length === 0) return;

  assertNonFailedTransaction(tradeEvents);

  const { slot: currentSlot } = blockData;
  const firstSlot = currentSlot - SNIPER_MINT_CREATION_BLOCK_RANGE;

  const selectQuery = `
    SELECT mint, create_event_slot 
    FROM moonshot_data
    WHERE create_event_slot BETWEEN ${firstSlot} AND ${currentSlot}
    UNION
    SELECT mint, create_event_slot 
    FROM pump_data
    WHERE create_event_slot BETWEEN ${firstSlot} AND ${currentSlot}
  `;

  const result = await dbQuery(client, selectQuery);

  const mintMap: Record<string, number> = {};

  result.rows.forEach((row) => {
    mintMap[row.mint] = row.create_event_slot;
  });

  for (const tradeEvent of tradeEvents) {
    const { eventObj } = tradeEvent;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const mint = decodedTrade.mint.toBase58();

    const creationBlock = mintMap[mint];
    if (creationBlock !== undefined) {
      tradeEvent.eventMeta = {
        ...tradeEvent.eventMeta,
        isSniper: true,
        mintBlock: creationBlock,
      };
    } else {
      tradeEvent.eventMeta = {
        ...tradeEvent.eventMeta,
        isSniper: false,
      };
    }
  }
}

export async function saveEarlyTrades(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(tradeEvents);

  const { blockTime } = blockData;

  const earlyTrades = tradeEvents.filter(
    (event) =>
      (event.eventMeta?.isEarly ?? false) ||
      (event.eventMeta?.isSniper ?? false),
  );

  if (earlyTrades.length === 0) return { rowsCount: 0 };

  const insertQuery = `
    INSERT INTO early_trades (
      mint,
      mint_slot,
      wallet,
      transaction_id,
      token_amount,
      is_buy,
      trade_slot,
      created
    ) VALUES
    ${earlyTrades
      .map(
        (_, index) =>
          `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`,
      )
      .join(", ")};
  `;

  const values = earlyTrades.flatMap((event) => {
    const { eventObj, signature, eventMeta } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const data = decodedTrade as PumpfunTradeEventValues;

    return [
      data.mint.toBase58(),
      eventMeta.mintBlock,
      data.user.toBase58(),
      signature,
      data.tokenAmount,
      data.isBuy,
      event.slot,
      blockTime,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting early_trades:", err);
    throw err;
  }

  return { rowsCount };
}
