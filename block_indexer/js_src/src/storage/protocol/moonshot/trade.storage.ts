import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { buildS1Bars, saveTimeSeries } from "./time-series.storage";
import { saveTradesOfCookingWallets } from "./trade-history.storage";
import { getCurvePercentage } from "../../../auxiliar/moonshot";
import { saveLastTrades } from "./last-trades.storage";
import { consolidateTradeEventsForMoonshotData } from "./consolidation";
import { filterTradesOfCookingWallets } from "./wallets";
import { updateWalletPositions } from "./positions-full.storage";
import { dbQueryWithValues } from "../../wrapper";

async function savePrices(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(tradeEvents);

  const consolidatedTradeEvents =
    consolidateTradeEventsForMoonshotData(tradeEvents);

  if (consolidatedTradeEvents.length === 0) return { rowsCount: 0 };

  const insertQuery = `
      INSERT INTO moonshot_data (
          mint, price, marketcap, percentage, updated, buy_count, sell_count, volume, curve_token_amount, curve_sol_amount, curve_liquidity
      ) VALUES
      ${consolidatedTradeEvents
        .map(
          (_, index) =>
            `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
              $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}::numeric,
              $${index * 11 + 9}::numeric, $${index * 11 + 10}::numeric, $${index * 11 + 11}::numeric)`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO UPDATE
      SET 
        price = EXCLUDED.price, 
        marketcap = EXCLUDED.marketcap,
        percentage = EXCLUDED.percentage,
        updated = EXCLUDED.updated,
        buy_count = EXCLUDED.buy_count + moonshot_data.buy_count,
        sell_count = EXCLUDED.sell_count + moonshot_data.sell_count,
        volume = EXCLUDED.volume + moonshot_data.volume,
        curve_token_amount = EXCLUDED.curve_token_amount,
        curve_sol_amount = EXCLUDED.curve_sol_amount,
        curve_liquidity = EXCLUDED.curve_liquidity;
    `;

  const values = consolidatedTradeEvents.flatMap((event) => {
    const tokenAmount = Number(event.tokenAmount) / 1000000000;
    const collateralAmount = event.collateralAmount;
    const solAmount = Number(collateralAmount) / 1000000000;
    const price = solAmount / tokenAmount;
    const marketcap = price * 1000000000;
    let percentage = getCurvePercentage(price);

    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    return [
      event.tokenMint,
      price,
      marketcap,
      percentage,
      blockData.blockTime,
      event.buyCount,
      event.sellCount,
      event.volume,
      event.curveTokenAmount,
      event.curveSolAmount,
      event.curveLiquidity,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting moonshot_data:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveTradeEvents(
  client: Client,
  backendClient: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradeEventsWithLogs = tradeEvents.filter(
    (event) => (event as any).eventLog !== undefined,
  );

  if (tradeEventsWithLogs.length === 0) return { rowsCount: 0 };

  const nonFailedTradeEvents = tradeEventsWithLogs.filter(
    (event) => !event.eventMeta.failedTransaction,
  );

  if (nonFailedTradeEvents.length === 0) return { rowsCount: 0 };

  let rowsCount = 0;

  rowsCount += (await savePrices(client, nonFailedTradeEvents, blockData))
    .rowsCount;

  // rowsCount += (await saveBondingCurves(client, nonFailedTradeEvents)).rowsCount;

  rowsCount += (
    await saveTimeSeries(
      client,
      buildS1Bars(nonFailedTradeEvents, blockData),
      blockData,
    )
  ).rowsCount;

  // this includes failed transactions
  rowsCount += (
    await saveTradesOfCookingWallets(
      client,
      backendClient,
      tradeEvents,
      blockData,
    )
  ).rowsCount;

  rowsCount += (await saveLastTrades(client, nonFailedTradeEvents, blockData))
    .rowsCount;

  // rowsCount += (
  //   await saveLastTradesJson(client, nonFailedTradeEvents, blockData)
  // ).rowsCount;

  const nonFailedTradeEventsOfCookingWallets =
    await filterTradesOfCookingWallets(backendClient, nonFailedTradeEvents);

  rowsCount += (
    await updateWalletPositions(
      client,
      nonFailedTradeEventsOfCookingWallets,
      blockData,
    )
  ).rowsCount;

  return { rowsCount };
}
