import { GenericEventType } from "../../../event";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { PumpfunCompleteEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

function deduplicate<T, K>(array: T[], keySelector: (item: T) => K): T[] {
  const map = new Map<K, T>();

  for (const item of array) {
    const key = keySelector(item);
    map.set(key, item);
  }

  return Array.from(map.values());
}

async function updateBondingCurves(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { blockTime } = blockData;

  const deduplicatedTradeEvents = deduplicate(mintEvents, (event) => {
    const { eventObj } = event;
    let decodedTrade: PumpfunCompleteEventValues = eventObj.decodedTrade;
    if (decodedTrade == undefined) {
      // is a TradeEvent (readed from logs)
      decodedTrade = eventObj as PumpfunCompleteEventValues;
    }
    return decodedTrade.mint.toBase58();
  });

  const insertQuery = `
    INSERT INTO pump_data (
        mint, complete, updated, completed
    ) VALUES
    ${deduplicatedTradeEvents
      .map(
        (_, index) =>
          `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`,
      )
      .join(", ")}
    ON CONFLICT (mint) DO UPDATE
    SET 
        complete = EXCLUDED.complete,
        updated = EXCLUDED.updated,
        completed = EXCLUDED.completed
  `;

  const values = deduplicatedTradeEvents
    .filter((event) => event.type == GenericEventType.Complete)
    .flatMap((event) => {
      const { eventObj } = event;
      let { decodedTrade } = eventObj;
      if (decodedTrade == undefined) {
        // is a TradeEvent (readed from logs)
        decodedTrade = eventObj;
      }
      const data = decodedTrade as PumpfunCompleteEventValues;
      return [data.mint.toBase58(), true, blockTime, data.timestamp];
    });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating pump_data:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveCompleteEvents(
  client: Client,
  completeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (completeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(completeEvents);

  let rowsCount = 0;

  rowsCount += (await updateBondingCurves(client, completeEvents, blockData))
    .rowsCount;

  return { rowsCount };
}
