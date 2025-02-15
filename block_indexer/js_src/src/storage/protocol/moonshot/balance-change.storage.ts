import { Client } from "pg";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { dbQueryWithValues } from "../../wrapper";
import { IndexerEventSource } from "../../../event";
import { aggregateSplTokenBalanceChangeEvents } from "../solana/consolidation";

export async function updateMoonshotTokenStats(
  client: Client,
  _backendClient: Client,
  filteredSplTokenBalanceChangeEvents: IEvent[],
  _blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (filteredSplTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  const moonshotTokenBalanceChangeEvents =
    filteredSplTokenBalanceChangeEvents.filter(
      (event) => event.source === IndexerEventSource.Moonshot,
    );

  if (moonshotTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  const aggregatedSplTokenBalanceChangeEvents =
    aggregateSplTokenBalanceChangeEvents(moonshotTokenBalanceChangeEvents);

  if (aggregatedSplTokenBalanceChangeEvents.length === 0)
    return { rowsCount: 0 };

  const updateQuery = `
    UPDATE moonshot_data 
    SET 
        dev_hold_sum = updates.dev_hold_sum,
        total_amount = moonshot_data.total_amount + updates.total_amount,
        total_holders = moonshot_data.total_holders + updates.total_holders
    FROM (VALUES
      ${aggregatedSplTokenBalanceChangeEvents
        .map(
          (_, i) =>
            `($${i * 4 + 1}::bigint, $${i * 4 + 2}::bigint, $${i * 4 + 3}::int, $${i * 4 + 4}::text)`,
        )
        .join(", ")}
    ) AS updates(dev_hold_sum, total_amount, total_holders, mint)
    WHERE moonshot_data.mint = updates.mint;
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
    console.error("Error updating moonshot_data:", err);
    throw err;
  }

  return { rowsCount };
}
