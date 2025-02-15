import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { IFixedBar, Timeframe, Timeframes } from "../../time-series";
import { consolidateTradeEventsForRaydiumData } from "./consolidation";
import { filterTradesOfCookingWallets } from "./wallets";
import { updateWalletPositions } from "./positions-full.storage";
import { dbQueryWithValues } from "../../wrapper";
import { saveLastTrades } from "./last-trades.storage";

function deduplicate<T, K>(array: T[], keySelector: (item: T) => K): T[] {
  const map = new Map<K, T>();

  for (const item of array) {
    const key = keySelector(item);
    map.set(key, item);
  }

  return Array.from(map.values());
}

// the real price is computed from the ray log data
export function computePrice(rayLog: any): number {
  const avoidNaN = (price: number): number => {
    if (Number.isNaN(price)) {
      return 0;
    }
    return price;
  };

  if (rayLog.log_type == "SwapBaseIn") {
    if (rayLog.direction == 1) {
      return avoidNaN(
        Number(rayLog.out_amount) /
          1000000000 /
          (Number(rayLog.amount_in) / 1000000),
      );
    }

    if (rayLog.direction == 2) {
      return avoidNaN(
        Number(rayLog.amount_in) /
          1000000000 /
          (Number(rayLog.out_amount) / 1000000),
      );
    }

    console.log(`Unknown Raydium swap direction ${rayLog.direction}`);
    return 0;
  }

  if (rayLog.log_type == "SwapBaseOut") {
    if (rayLog.direction == 1) {
      return avoidNaN(
        Number(rayLog.amount_out) /
          1000000000 /
          (Number(rayLog.deduct_in) / 1000000),
      );
    }

    if (rayLog.direction == 2) {
      return avoidNaN(
        Number(rayLog.deduct_in) /
          1000000000 /
          (Number(rayLog.amount_out) / 1000000),
      );
    }

    console.log(`Unknown Raydium swap direction ${rayLog.direction}`);
    return 0;
  }

  console.log(`Unknown Raydium swap type ${rayLog.log_type}`);
  return 0;
}

async function getTradingEventsFromOurProtocols(
  client: Client,
  tradeEvents: IEvent[],
): Promise<IEvent[]> {
  // get amms from tradeEvents deduplicated
  const amms = deduplicate(tradeEvents, (event) => event.eventMeta.amm).map(
    (event) => event.eventMeta.amm,
  );

  const selectQuery = `
    SELECT amm
    FROM raydium_data 
    WHERE amm IN (
      ${amms.map((_, index) => `$${index + 1}`).join(", ")}
    )
  `;

  const relevantTradeEvents: IEvent[] = [];

  try {
    const result = await dbQueryWithValues(client, selectQuery, amms);

    // generate a map of relevant amms
    const relevantAmmMap: Record<string, boolean> = {};
    result.rows.forEach((row) => {
      relevantAmmMap[row.amm] = true;
    });

    // filter tradeEvents by relevantAmmMap
    tradeEvents.forEach((event) => {
      if (relevantAmmMap[event.eventMeta.amm]) {
        relevantTradeEvents.push(event);
      }
    });
  } catch (err) {
    console.error("Error reading raydium_data:", err);
    throw err;
  }

  return relevantTradeEvents;
}

async function savePrices(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(tradeEvents);

  const consolidatedTradeEvents =
    consolidateTradeEventsForRaydiumData(tradeEvents);

  const { blockTime } = blockData;

  const updateQuery = `
    UPDATE raydium_data
    SET 
      price = tmp.price,
      updated = tmp.updated,
      buy_count = tmp.buy_count + raydium_data.buy_count,
      sell_count = tmp.sell_count + raydium_data.sell_count,
      buy_volume = tmp.buy_volume + raydium_data.buy_volume,
      sell_volume = tmp.sell_volume + raydium_data.sell_volume,
      volume = tmp.volume + raydium_data.volume,
      coin_amount = tmp.pool_coin,
      pc_amount = tmp.pool_pc
    FROM (
      VALUES
      ${consolidatedTradeEvents
        .map(
          (_, index) =>
            `($${index * 10 + 1}::text, $${index * 10 + 2}::numeric, $${index * 10 + 3}::bigint, $${index * 10 + 4}::bigint, 
              $${index * 10 + 5}::bigint, $${index * 10 + 6}::numeric, $${index * 10 + 7}::numeric, $${index * 10 + 8}::numeric, 
              $${index * 10 + 9}::bigint, $${index * 10 + 10}::bigint)`,
        )
        .join(", ")}
    ) AS tmp(amm, price, updated, buy_count, sell_count, buy_volume, sell_volume, volume, pool_coin, pool_pc)
    WHERE raydium_data.amm = tmp.amm;
  `;

  const values = consolidatedTradeEvents.flatMap((consolidatedEvent) => {
    return [
      consolidatedEvent.amm,
      consolidatedEvent.price.toFixed(10),
      blockTime,
      consolidatedEvent.buyCount,
      consolidatedEvent.sellCount,
      consolidatedEvent.buyVolume,
      consolidatedEvent.sellVolume,
      consolidatedEvent.volume,
      consolidatedEvent.poolCoin,
      consolidatedEvent.poolPc,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, updateQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error updating raydium_data:", err);
    throw err;
  }

  return { rowsCount };
}

async function buildS1Bars(
  successfulTradeEvents: IEvent[],
): Promise<IFixedBar[]> {
  if (successfulTradeEvents.length === 0) return [];

  assertNonFailedTransaction(successfulTradeEvents);

  const lastTradeEventsOfEachAmm = deduplicate(
    successfulTradeEvents,
    (event) => {
      const { eventMeta } = event;
      return eventMeta.amm;
    },
  );

  const m1Bars: Map<string, IFixedBar> = new Map<string, IFixedBar>();

  for (const tradeEvent of lastTradeEventsOfEachAmm) {
    const { eventObj, eventMeta, rayLogEventData: rayLog } = tradeEvent as any;

    if (eventMeta.mint == undefined) {
      continue;
    }

    const mint = eventMeta.mint;
    if (mint == undefined) {
      throw new Error("Mint is undefined");
    }
    const timestamp: number = Number.parseInt(eventMeta.timestamp.toString());

    // TODO de-duplicate this logic
    const price = computePrice(rayLog);

    let volume = 0;
    let buy_count = 0;
    let sell_count = 0;

    if (eventObj.log_type == "SwapBaseIn") {
      if (rayLog.direction == 1) {
        volume = Number(rayLog.amount_in) / 1000000000;
        buy_count = 1;
      }

      if (rayLog.direction == 2) {
        volume = Number(rayLog.out_amount) / 1000000000;
        sell_count = 1;
      }
    }

    if (eventObj.log_type == "SwapBaseOut") {
      if (rayLog.direction == 1) {
        volume = Number(rayLog.amount_out) / 1000000000;
        sell_count = 1;
      }

      if (rayLog.direction == 2) {
        volume = Number(rayLog.deduct_in) / 1000000000;
        buy_count = 1;
      }
    }

    const m1Bar = m1Bars.get(mint);
    if (m1Bar == undefined) {
      m1Bars.set(mint, {
        timeframe: Timeframe.S1,
        timestamp,
        mint,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
        buy_count,
        sell_count,
      });
    } else {
      if (price > m1Bar.high) m1Bar.high = price;
      if (price < m1Bar.low) m1Bar.low = price;
      m1Bar.close = price;
      m1Bar.volume += volume;
      m1Bar.buy_count += buy_count;
      m1Bar.sell_count += sell_count;
    }
  }

  return Array.from(m1Bars.values());
}

async function loadMintFromAmm(
  client: Client,
  relevantTradeEvents: IEvent[],
): Promise<number> {
  const selectQuery = `
    SELECT amm, coin_mint, pc_mint
    FROM raydium_data
    WHERE amm IN (
      ${relevantTradeEvents.map((_, index) => `$${index + 1}`).join(", ")}
    )
    AND (coin_mint = 'So11111111111111111111111111111111111111112' OR pc_mint = 'So11111111111111111111111111111111111111112');
  `;

  try {
    const values = relevantTradeEvents.map((event) => event.eventMeta.amm);
    const result = await dbQueryWithValues(client, selectQuery, values);

    const ammToCoinMintMap: Record<
      string,
      { coin_mint: string; pc_mint: string }
    > = {};
    result.rows.forEach((row) => {
      ammToCoinMintMap[row.amm] = {
        coin_mint: row.coin_mint,
        pc_mint: row.pc_mint,
      };
    });

    let mintsUpdated = 0;

    relevantTradeEvents.forEach((event) => {
      const mints = ammToCoinMintMap[event.eventMeta.amm];
      if (mints) {
        if (mints.coin_mint == "So11111111111111111111111111111111111111112") {
          event.eventMeta.mint = mints.pc_mint;
        } else {
          event.eventMeta.mint = mints.coin_mint;
        }
        mintsUpdated++;
      } else {
        event.eventMeta.mint = undefined;
      }
    });

    return mintsUpdated;
  } catch (err) {
    console.error("Error reading raydium_data:", err);
    throw err;
  }
}

export async function saveBars(
  client: Client,
  bars: IFixedBar[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (bars.length == 0) {
    return { rowsCount: 0 };
  }

  const insertQuery = `
    INSERT INTO raydium_price_bar (
      timeframe, mint, timestamp, open, high, low, close, volume, buy_count, sell_count, created
    ) VALUES 
    ${bars
      .map(
        (_, index) =>
          `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`,
      )
      .join(", ")}
    ON CONFLICT (timeframe, mint, timestamp)
    DO UPDATE SET
      high = GREATEST(EXCLUDED.high, raydium_price_bar.high),
      low = LEAST(EXCLUDED.low, raydium_price_bar.low),
      close = EXCLUDED.close,
      volume = raydium_price_bar.volume + EXCLUDED.volume,
      buy_count = raydium_price_bar.buy_count + EXCLUDED.buy_count,
      sell_count = raydium_price_bar.sell_count + EXCLUDED.sell_count;
  `;

  const values = bars.flatMap((bar) => {
    const {
      timeframe,
      timestamp,
      mint,
      open,
      high,
      low,
      close,
      volume,
      buy_count,
      sell_count,
    } = bar;

    if (mint == undefined) {
      throw new Error("Mint is undefined");
    }

    return [
      timeframe,
      mint,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      buy_count,
      sell_count,
      blockData.blockTime,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating raydium_price_bar:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveTimeSeries(
  client: Client,
  s1Bars: IFixedBar[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  let rowsCount = 0;

  const bars: IFixedBar[] = [];

  for (const s1Bar of s1Bars) {
    for (const barTimeframe of Timeframes) {
      const { mint, open, high, low, close, volume, buy_count, sell_count } =
        s1Bar;
      const barTimestamp = s1Bar.timestamp - (s1Bar.timestamp % barTimeframe);

      bars.push({
        timeframe: barTimeframe,
        timestamp: barTimestamp,
        mint,
        open,
        high,
        low,
        close,
        volume,
        buy_count,
        sell_count,
      });
    }
  }

  rowsCount += (await saveBars(client, bars, blockData)).rowsCount;

  return { rowsCount };
}

async function filterTradesOfActiveWallets(
  client: Client,
  tradeEvents: IEvent[],
): Promise<IEvent[]> {
  const users = tradeEvents.flatMap((event) => {
    const { eventMeta } = event;
    return eventMeta.user;
  });

  const deduplicatedUsers = deduplicate(users, (user) => {
    return user;
  });

  const activeWalletsMap: Record<string, boolean> = {};

  try {
    const selectQuery = `
      SELECT address
      FROM wallets 
      WHERE address IN (
        ${deduplicatedUsers.map((_, index) => `$${index + 1}`).join(", ")}
      )
    `;

    const result = await dbQueryWithValues(
      client,
      selectQuery,
      deduplicatedUsers,
    );

    result.rows.forEach((row) => {
      activeWalletsMap[row.address] = true;
    });
  } catch (err) {
    console.error("Error reading wallets:", err);
    throw err;
  }

  const relevantTradeEvents: IEvent[] = [];

  tradeEvents.forEach((event) => {
    const { eventMeta } = event;
    if (activeWalletsMap[eventMeta.user]) {
      relevantTradeEvents.push(event);
    }
  });

  return relevantTradeEvents;
}

async function saveTradesHistory(
  client: Client,
  backendClient: Client,
  tradeEvents: IEvent[],
  _blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const tradesOfActiveWallets = await filterTradesOfActiveWallets(
    backendClient,
    tradeEvents,
  );

  if (tradesOfActiveWallets.length == 0) {
    return { rowsCount: 0 };
  }

  const insertQuery = `
    INSERT INTO raydium_trade (
      signer,
      amm, 
      transaction_id,
      log_type,
      amount_in,
      minimum_out,
      direction,
      user_source,
      pool_coin,
      pool_pc,
      out_amount,
      max_in,
      amount_out,
      deduct_in,
      created,
      failed_transaction
    ) VALUES
    ${tradesOfActiveWallets
      .map(
        (_, index) =>
          `($${index * 16 + 1}, $${index * 16 + 2}, $${index * 16 + 3}, $${index * 16 + 4}, $${index * 16 + 5}, $${index * 16 + 6}, $${index * 16 + 7}, $${index * 16 + 8}, $${index * 16 + 9}, $${index * 16 + 10}, $${index * 16 + 11}, $${index * 16 + 12}, $${index * 16 + 13}, $${index * 16 + 14}, $${index * 16 + 15}, $${index * 16 + 16})`,
      )
      .join(", ")};
  `;

  const values = tradesOfActiveWallets.flatMap((event) => {
    const {
      eventObj,
      eventMeta,
      rayLogEventData: rayLog,
      signature,
    } = event as any;
    const { user, amm, failedTransaction } = eventMeta;

    if (failedTransaction) {
      const { instructionType, instructionValues } = eventObj;
      // if failed, we don't have the ray log data, so we use the instruction values (desired values)
      const { amountIn, minimumAmountOut, amountOut, maxAmountIn } =
        instructionValues;

      return [
        user,
        amm,
        signature,
        instructionType,
        amountIn,
        minimumAmountOut,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        maxAmountIn,
        amountOut,
        undefined,
        Math.floor(Date.now() / 1000),
        failedTransaction,
      ];
    }

    const {
      log_type,
      amount_in,
      minimum_out,
      direction,
      user_source,
      pool_coin,
      pool_pc,
      out_amount,
      max_in,
      amount_out,
      deduct_in,
    } = rayLog;

    return [
      user,
      amm,
      signature,
      log_type,
      amount_in,
      minimum_out,
      direction,
      user_source,
      pool_coin,
      pool_pc,
      out_amount,
      max_in,
      amount_out,
      deduct_in,
      Math.floor(Date.now() / 1000),
      failedTransaction,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting raydium_trade:", err);
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

  let rowsCount = 0;

  const tradingEventsFromOurProtocols = await getTradingEventsFromOurProtocols(
    client,
    tradeEvents,
  );

  if (tradingEventsFromOurProtocols.length == 0) {
    return { rowsCount };
  }

  const mintsUpdated = await loadMintFromAmm(
    client,
    tradingEventsFromOurProtocols,
  );

  if (mintsUpdated == 0) {
    return { rowsCount };
  }

  // filter out failed transactions
  const nonFailedTradingEvents = tradingEventsFromOurProtocols.filter(
    (event) => !event.eventMeta.failedTransaction,
  );

  // filter out events that don't have ray log data even though they are not failed transactions
  // probably because the transaction logs are truncated
  const completeNonFailedTradingEvents = nonFailedTradingEvents.filter(
    (event) => {
      const { rayLogEventData: rayLog } = event as any;
      return rayLog != undefined;
    },
  );

  rowsCount += (
    await savePrices(client, completeNonFailedTradingEvents, blockData)
  ).rowsCount;

  // TODO change lastTradeEventsOfEachAmm to tradingEventsFromOurProtocols (computationally more expensive)
  const s1Bars = await buildS1Bars(completeNonFailedTradingEvents);
  rowsCount += (await saveTimeSeries(client, s1Bars, blockData)).rowsCount;

  // saves all trades, including failed transactions
  rowsCount += (
    await saveTradesHistory(
      client,
      backendClient,
      tradingEventsFromOurProtocols,
      blockData,
    )
  ).rowsCount;

  rowsCount += (await saveLastTrades(client, nonFailedTradingEvents, blockData))
    .rowsCount;

  // rowsCount += (
  //   await saveLastTradesJson(client, nonFailedTradingEvents, blockData)
  // ).rowsCount;

  const nonFailedTradeEventsOfCookingWallets =
    await filterTradesOfCookingWallets(
      backendClient,
      completeNonFailedTradingEvents,
    );

  rowsCount += (
    await updateWalletPositions(
      client,
      nonFailedTradeEventsOfCookingWallets,
      blockData,
    )
  ).rowsCount;

  return { rowsCount };
}
