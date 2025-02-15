import { IEvent } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import {
  IConsolidatedTradeEvent,
  IConsolidatedTradeEventForPositionsFull,
} from "../../consolidation";
import { IBlockData } from "../../storage";

export function consolidateTradeEvents(
  tradeEvents: IEvent[],
  blockData: IBlockData,
): IConsolidatedTradeEvent[] {
  const { blockTime } = blockData;

  const consolidatedEvents: Map<string, IConsolidatedTradeEvent> = new Map();

  tradeEvents.forEach((event) => {
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;

    const data = decodedTrade as PumpfunTradeEventValues;
    const isBuy = data.isBuy;
    const isSell = !isBuy;
    const key = `${data.user.toBase58()}-${data.mint.toBase58()}`;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        userWallet: data.user.toBase58(),
        tokenMint: data.mint.toBase58(),
        solReceived: isSell ? data.solAmount : 0n,
        tokenReceived: isBuy ? data.tokenAmount : 0n,
        solSent: isBuy ? data.solAmount : 0n,
        tokenSent: isSell ? data.tokenAmount : 0n,
        costBasis: 0n,
        realizedPnl: 0,
        unrealizedPnl: 0,
        currentPrice: 0n,
        lastBuy: isBuy ? blockTime : null,
        isBondingCurve: null,
      });
    } else {
      consolidatedEvent.solReceived += isSell ? data.solAmount : 0n;
      consolidatedEvent.tokenReceived += isBuy ? data.tokenAmount : 0n;
      consolidatedEvent.solSent += isBuy ? data.solAmount : 0n;
      consolidatedEvent.tokenSent += isSell ? data.tokenAmount : 0n;
      if (isBuy) {
        consolidatedEvent.lastBuy = blockTime;
      }
    }
  });

  return Array.from(consolidatedEvents.values());
}

export function consolidateTradeEventsForPositionsFull(
  tradeEvents: IEvent[],
): IConsolidatedTradeEventForPositionsFull[] {
  const consolidatedEvents: Map<
    string,
    IConsolidatedTradeEventForPositionsFull
  > = new Map();

  tradeEvents.forEach((event) => {
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;

    const data = decodedTrade as PumpfunTradeEventValues;

    const userWallet = data.user.toBase58();
    const tokenMint = data.mint.toBase58();

    let tokenReceived = 0n;
    let tokenSent = 0n;
    let solReceived = 0n;
    let solSent = 0n;
    let buyCount = 0;
    let sellCount = 0;

    if (data.isBuy) {
      tokenReceived = data.tokenAmount;
      solReceived = data.solAmount;
      buyCount = 1;
    } else {
      tokenSent = data.tokenAmount;
      solSent = data.solAmount;
      sellCount = 1;
    }

    const key = `${userWallet}-${tokenMint}`;
    const consolidatedEvent = consolidatedEvents.get(key);

    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        userWallet,
        tokenMint,
        tokenReceived,
        tokenSent,
        solReceived,
        solSent,
        buyCount,
        sellCount,
      });
    } else {
      consolidatedEvent.solReceived += solReceived;
      consolidatedEvent.tokenReceived += tokenReceived;
      consolidatedEvent.solSent += solSent;
      consolidatedEvent.tokenSent += tokenSent;
      consolidatedEvent.buyCount += buyCount;
      consolidatedEvent.sellCount += sellCount;
    }
  });

  return Array.from(consolidatedEvents.values());
}

export interface IConsolidatedTradeEventForPumpData {
  tokenMint: string;
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  buyCount: number;
  sellCount: number;
  buyVolume: bigint;
  sellVolume: bigint;
  volume: bigint;
}

/**
 * Builds consolidated trade events for pump data.
 *
 * This function takes a series of trade events and aggregates them into a single event for each token.
 * The event contains the virtual and real reserves, the buy and sell counts, the buy and sell volumes, and the total volume.
 * The virtual and real reserves are updated on every trade event.
 * The buy and sell counts are incremented on every trade event.
 * The buy and sell volumes are incremented on every trade event.
 * The total volume is incremented on every trade event.
 *
 * @param {IEvent[]} tradeEvents - An array of trade events in the protocol.
 * @returns {IConsolidatedTradeEventForPumpData[]} An array of consolidated trade events for pump data.
 */
export function consolidateTradeEventsForPumpData(
  tradeEvents: IEvent[],
): IConsolidatedTradeEventForPumpData[] {
  const consolidatedEvents: Map<string, IConsolidatedTradeEventForPumpData> =
    new Map();

  tradeEvents.forEach((event) => {
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;

    const data = decodedTrade as PumpfunTradeEventValues;
    const key = `${data.mint.toBase58()}`;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        tokenMint: data.mint.toBase58(),
        virtualTokenReserves: data.virtualTokenReserves,
        virtualSolReserves: data.virtualSolReserves,
        realTokenReserves: data.realTokenReserves,
        realSolReserves: data.realSolReserves,
        buyCount: data.isBuy ? 1 : 0,
        sellCount: !data.isBuy ? 1 : 0,
        buyVolume: data.isBuy ? data.solAmount : 0n,
        sellVolume: !data.isBuy ? data.solAmount : 0n,
        volume: data.solAmount,
      });
    } else {
      // update the virtual reserves with the current reserves
      consolidatedEvent.virtualTokenReserves = data.virtualTokenReserves;
      consolidatedEvent.virtualSolReserves = data.virtualSolReserves;
      consolidatedEvent.realTokenReserves = data.realTokenReserves;
      consolidatedEvent.realSolReserves = data.realSolReserves;
      // increment the buy and sell counts
      consolidatedEvent.buyCount += data.isBuy ? 1 : 0;
      consolidatedEvent.sellCount += !data.isBuy ? 1 : 0;
      // increment the buy and sell volumes
      consolidatedEvent.buyVolume += data.isBuy ? data.solAmount : 0n;
      consolidatedEvent.sellVolume += !data.isBuy ? data.solAmount : 0n;
      // increment the total volume
      consolidatedEvent.volume += data.solAmount;
    }
  });

  return Array.from(consolidatedEvents.values());
}
