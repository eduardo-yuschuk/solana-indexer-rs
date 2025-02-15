import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { dbQueryWithValues } from "../../wrapper";
import { IndexerEventSource } from "../../../event";
import { aggregateSplTokenBalanceChangeEvents } from "../solana/consolidation";

export async function updatePumpTokenStats(
  client: Client,
  _backendClient: Client,
  filteredSplTokenBalanceChangeEvents: IEvent[],
  _blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (filteredSplTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(filteredSplTokenBalanceChangeEvents);

  const pumpTokenBalanceChangeEvents =
    filteredSplTokenBalanceChangeEvents.filter(
      (event) => event.source === IndexerEventSource.Pumpfun,
    );

  if (pumpTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  const aggregatedSplTokenBalanceChangeEvents =
    aggregateSplTokenBalanceChangeEvents(pumpTokenBalanceChangeEvents);

  if (aggregatedSplTokenBalanceChangeEvents.length === 0)
    return { rowsCount: 0 };

  const updateQuery = `
    UPDATE pump_data 
    SET 
        dev_hold_sum = updates.dev_hold_sum,
        total_amount = pump_data.total_amount + updates.total_amount,
        total_holders = pump_data.total_holders + updates.total_holders
    FROM (VALUES
      ${aggregatedSplTokenBalanceChangeEvents
        .map(
          (_, i) =>
            `($${i * 4 + 1}::bigint, $${i * 4 + 2}::bigint, $${i * 4 + 3}::int, $${i * 4 + 4}::text)`,
        )
        .join(", ")}
    ) AS updates(dev_hold_sum, total_amount, total_holders, mint)
    WHERE pump_data.mint = updates.mint;
  `;

  const values = aggregatedSplTokenBalanceChangeEvents.flatMap((event) => {
    return [
      event.devHoldSum,
      event.totalAmount,
      event.totalHolders,
      event.mint,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, updateQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error updating pump_data:", err);
    throw err;
  }

  return { rowsCount };
}
