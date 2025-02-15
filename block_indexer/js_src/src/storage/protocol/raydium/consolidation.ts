import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IConsolidatedTradeEvent } from "../../consolidation";
import { IBlockData } from "../../storage";
import { computePrice } from "./trade.storage";

export function consolidateTradeEvents(
  tradeEvents: IEvent[],
  blockData: IBlockData,
): IConsolidatedTradeEvent[] {
  const { blockTime } = blockData;
  const consolidatedEvents: Map<string, IConsolidatedTradeEvent> = new Map();

  tradeEvents.forEach((event) => {
    const { eventObj, eventMeta } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) {
      // is a TradeEvent (readed from logs)
      decodedTrade = eventObj;
    }
    const data = decodedTrade;
    let isBuy = false;
    let solAmount = 0n;
    let tokenAmount = 0n;

    if (eventObj.log_type == "SwapBaseIn") {
      if (data.direction == 1) {
        isBuy = true;
        solAmount = data.out_amount;
        tokenAmount = data.amount_in;
      }

      if (data.direction == 2) {
        isBuy = false;
        solAmount = data.amount_in;
        tokenAmount = data.out_amount;
      }
    }

    if (eventObj.log_type == "SwapBaseOut") {
      if (data.direction == 1) {
        isBuy = false;
        solAmount = data.amount_out;
        tokenAmount = data.deduct_in;
      }

      if (data.direction == 2) {
        isBuy = true;
        solAmount = data.deduct_in;
        tokenAmount = data.amount_out;
      }
    }

    const isSell = !isBuy;

    const key = `${eventMeta.user}-${eventMeta.mint}`;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        userWallet: eventMeta.user,
        tokenMint: eventMeta.mint,
        solReceived: isSell ? solAmount : 0n,
        tokenReceived: isBuy ? tokenAmount : 0n,
        solSent: isBuy ? solAmount : 0n,
        tokenSent: isSell ? tokenAmount : 0n,
        costBasis: 0n,
        realizedPnl: 0,
        unrealizedPnl: 0,
        currentPrice: 0n,
        lastBuy: isBuy ? blockTime : null,
        isBondingCurve: null,
      });
    } else {
      consolidatedEvent.solReceived += isSell ? solAmount : 0n;
      consolidatedEvent.tokenReceived += isBuy ? tokenAmount : 0n;
      consolidatedEvent.solSent += isBuy ? solAmount : 0n;
      consolidatedEvent.tokenSent += isSell ? tokenAmount : 0n;
      if (isBuy) {
        consolidatedEvent.lastBuy = blockTime;
      }
    }
  });

  return Array.from(consolidatedEvents.values());
}

export interface IConsolidatedTradeEventForRaydiumData {
  amm: string;
  price: number;
  buyCount: number;
  sellCount: number;
  buyVolume: bigint;
  sellVolume: bigint;
  volume: bigint;
  poolCoin: bigint;
  poolPc: bigint;
}

export function consolidateTradeEventsForRaydiumData(
  tradeEvents: IEvent[],
): IConsolidatedTradeEventForRaydiumData[] {
  const consolidatedEvents: Map<string, IConsolidatedTradeEventForRaydiumData> =
    new Map();

  tradeEvents.forEach((event) => {
    const { eventMeta, rayLogEventData: rayLog } = event as any;
    let volume = 0n;
    let buyCount = 0;
    let sellCount = 0;
    let buyVolume = 0n;
    let sellVolume = 0n;
    const poolCoin = rayLog.pool_coin;
    const poolPc = rayLog.pool_pc;

    if (rayLog.log_type == "SwapBaseIn") {
      if (rayLog.direction == 1) {
        buyCount = 1;
        buyVolume = rayLog.amount_in;
        volume = rayLog.amount_in;
      }

      if (rayLog.direction == 2) {
        sellCount = 1;
        sellVolume = rayLog.out_amount;
        volume = rayLog.out_amount;
      }
    }

    if (rayLog.log_type == "SwapBaseOut") {
      if (rayLog.direction == 1) {
        sellCount = 1;
        sellVolume = rayLog.amount_out;
        volume = rayLog.amount_out;
      }

      if (rayLog.direction == 2) {
        buyCount = 1;
        buyVolume = rayLog.deduct_in;
        volume = rayLog.deduct_in;
      }
    }

    const price = computePrice(rayLog);

    const key = `${eventMeta.amm}`;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        amm: eventMeta.amm,
        price,
        buyCount,
        sellCount,
        buyVolume,
        sellVolume,
        volume,
        poolCoin,
        poolPc,
      });
    } else {
      // overwrite price
      consolidatedEvent.price = price;
      // increment counters and accumulators
      consolidatedEvent.buyCount += buyCount;
      consolidatedEvent.sellCount += sellCount;
      consolidatedEvent.buyVolume += buyVolume;
      consolidatedEvent.sellVolume += sellVolume;
      consolidatedEvent.volume += volume;
      // overwrite pool coin and pool pc
      consolidatedEvent.poolCoin = poolCoin;
      consolidatedEvent.poolPc = poolPc;
    }
  });

  return Array.from(consolidatedEvents.values());
}
