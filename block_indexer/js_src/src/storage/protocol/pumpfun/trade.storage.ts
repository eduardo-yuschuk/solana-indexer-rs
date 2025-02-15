import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { buildS1Bars, saveTimeSeries } from "./time-series.storage";
import { saveTrades } from "./trade-history.storage";
import { filterTradesOfCookingWallets } from "./wallets";
import { updatePositions } from "./positions.storage";
import { saveEarlyTrades } from "./early-trades.storage";
import {
  updatePositionsFull,
  updateWalletPositions,
} from "./positions-full.storage";
import { saveLastTrades } from "./last-trades.storage";
import { consolidateTradeEventsForPumpData } from "./consolidation";
import { dbQueryWithValues } from "../../wrapper";
import { updateIndicators } from "./indicators.storage";

async function savePricesAndBondingCurves(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(tradeEvents);

  const { blockTime } = blockData;

  const consolidatedTradeEvents =
    consolidateTradeEventsForPumpData(tradeEvents);

  const insertQuery = `
    INSERT INTO pump_data (
        mint, 
        discriminator, 
        virtual_token_reserves, 
        virtual_sol_reserves, 
        real_token_reserves, 
        real_sol_reserves, 
        token_total_supply, 
        price, 
        buy_count,
        sell_count,
        buy_volume,
        sell_volume,
        volume,
        updated
    ) VALUES
    ${consolidatedTradeEvents
      .map(
        (_, index) =>
          `($${index * 14 + 1}, $${index * 14 + 2}, $${index * 14 + 3}, $${index * 14 + 4}, $${index * 14 + 5}, $${index * 14 + 6}, $${index * 14 + 7}, $${index * 14 + 8}, $${index * 14 + 9}, $${index * 14 + 10}, $${index * 14 + 11}, $${index * 14 + 12}, $${index * 14 + 13}, $${index * 14 + 14})`,
      )
      .join(", ")}
    ON CONFLICT (mint) DO UPDATE
    SET 
      discriminator = EXCLUDED.discriminator, 
      virtual_token_reserves = EXCLUDED.virtual_token_reserves, 
      virtual_sol_reserves = EXCLUDED.virtual_sol_reserves, 
      real_token_reserves = EXCLUDED.real_token_reserves, 
      real_sol_reserves = EXCLUDED.real_sol_reserves, 
      token_total_supply = EXCLUDED.token_total_supply, 
      price = EXCLUDED.price, 
      buy_count = EXCLUDED.buy_count + pump_data.buy_count,
      sell_count = EXCLUDED.sell_count + pump_data.sell_count,
      buy_volume = EXCLUDED.buy_volume + pump_data.buy_volume,
      sell_volume = EXCLUDED.sell_volume + pump_data.sell_volume,
      volume = EXCLUDED.volume + pump_data.volume,
      updated = EXCLUDED.updated;
  `;

  const values = consolidatedTradeEvents.flatMap((event) => {
    // (virtualSolReserves / LAMPORTS_PER_SOL) / (virtualTokenReserves / 10 ** PUMP_CURVE_TOKEN_DECIMALS)
    const price =
      Number(event.virtualSolReserves) /
      1000000000 /
      (Number(event.virtualTokenReserves) / 1000000);

    return [
      event.tokenMint,
      6966180631402821399n.toString(),
      event.virtualTokenReserves.toString(),
      event.virtualSolReserves.toString(),
      event.realTokenReserves.toString(),
      event.realSolReserves.toString(),
      1000000000000000,
      price,
      event.buyCount,
      event.sellCount,
      event.buyVolume,
      event.sellVolume,
      event.volume,
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
    console.error("Error inserting pump_data:", err);
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

  const nonFailedTradingEvents = tradeEvents.filter(
    (event) => !event.eventMeta.failedTransaction,
  );

  let rowsCount = 0;

  rowsCount += (
    await savePricesAndBondingCurves(client, nonFailedTradingEvents, blockData)
  ).rowsCount;

  rowsCount += (
    await saveTimeSeries(client, buildS1Bars(nonFailedTradingEvents), blockData)
  ).rowsCount;

  // this includes failed transactions
  const tradeEventsOfCookingWallets = await filterTradesOfCookingWallets(
    backendClient,
    tradeEvents,
  );

  const nonFailedTradeEventsOfCookingWallets =
    tradeEventsOfCookingWallets.filter(
      (event) => !event.eventMeta.failedTransaction,
    );

  // this includes failed transactions
  rowsCount += (
    await saveTrades(client, tradeEventsOfCookingWallets, blockData)
  ).rowsCount;

  rowsCount += (
    await updatePositions(
      client,
      nonFailedTradeEventsOfCookingWallets,
      blockData,
    )
  ).rowsCount;

  rowsCount += (
    await updatePositionsFull(client, nonFailedTradingEvents, blockData)
  ).rowsCount;

  rowsCount += (
    await updateWalletPositions(
      client,
      nonFailedTradeEventsOfCookingWallets,
      blockData,
    )
  ).rowsCount;

  // TODO: very expensive in database space
  // rowsCount += (await saveAllTrades(client, tradeEvents)).rowsCount;

  rowsCount += (
    await saveEarlyTrades(client, nonFailedTradingEvents, blockData)
  ).rowsCount;

  rowsCount += (await saveLastTrades(client, nonFailedTradingEvents, blockData))
    .rowsCount;

  // rowsCount += (
  //   await saveLastTradesJson(client, nonFailedTradingEvents, blockData)
  // ).rowsCount;

  rowsCount += (
    await updateIndicators(client, nonFailedTradingEvents, blockData)
  ).rowsCount;

  return { rowsCount };
}
