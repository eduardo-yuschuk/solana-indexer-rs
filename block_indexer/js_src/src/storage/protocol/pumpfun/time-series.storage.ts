import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { IBar, Timeframe, Timeframes } from "../../time-series";
import { dbQueryWithValues } from "../../wrapper";

/**
 * Builds the most granular S1 bars based on the specific trade events of the protocol.
 *
 * This function takes a series of trade events and aggregates them into S1 bars.
 *
 * @param {IEvent[]} tradeEvents - An array of trade events that contain the details of each
 *                                  trade in the protocol.
 * @returns {IBar[]} An array of S1 bars generated from the trade events.
 */
export function buildS1Bars(tradeEvents: IEvent[]): IBar[] {
  if (tradeEvents.length === 0) return [];

  assertNonFailedTransaction(tradeEvents);

  const m1Bars: Map<string, IBar> = new Map<string, IBar>();
  for (const tradeEvent of tradeEvents) {
    const { eventObj } = tradeEvent;
    let decodedTrade: PumpfunTradeEventValues = eventObj.decodedTrade;
    if (decodedTrade == undefined) {
      // is a TradeEvent (readed from logs)
      decodedTrade = eventObj as PumpfunTradeEventValues;
    }
    const data = decodedTrade as PumpfunTradeEventValues;
    const mint = data.mint.toBase58();
    const timestamp: number = Number.parseInt(data.timestamp.toString());

    // TODO de-duplicate this logic
    const price =
      Number(data.virtualSolReserves) /
      1000000000 /
      (Number(data.virtualTokenReserves) / 1000000);
    const volume = data.solAmount;

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
        buy_count: data.isBuy ? 1n : 0n,
        sell_count: data.isBuy ? 0n : 1n,
      });
    } else {
      if (price > m1Bar.high) m1Bar.high = price;
      if (price < m1Bar.low) m1Bar.low = price;
      m1Bar.close = price;
      m1Bar.volume += volume;
      if (data.isBuy) {
        m1Bar.buy_count += 1n;
      } else {
        m1Bar.sell_count += 1n;
      }
    }
  }
  return Array.from(m1Bars.values());
}

export async function saveBars(
  client: Client,
  bars: IBar[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { blockTime } = blockData;

  if (bars.length == 0) {
    return { rowsCount: 0 };
  }

  const insertQuery = `
      INSERT INTO pump_price_bar (
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
        high = GREATEST(EXCLUDED.high, pump_price_bar.high),
        low = LEAST(EXCLUDED.low, pump_price_bar.low),
        close = EXCLUDED.close,
        volume = pump_price_bar.volume + EXCLUDED.volume,
        buy_count = pump_price_bar.buy_count + EXCLUDED.buy_count,
        sell_count = pump_price_bar.sell_count + EXCLUDED.sell_count;
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
    console.error("Error inserting/updating pump_price_bar:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveTimeSeries(
  client: Client,
  s1Bars: IBar[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  let rowsCount = 0;

  const bars: IBar[] = [];

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
