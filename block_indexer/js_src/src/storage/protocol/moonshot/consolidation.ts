import Decimal from "decimal.js";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IConsolidatedTradeEvent } from "../../consolidation";
import { IBlockData } from "../../storage";

export function consolidateTradeEvents(
  tradeEvents: IEvent[],
  blockData: IBlockData,
): IConsolidatedTradeEvent[] {
  const { blockTime } = blockData;
  const consolidatedEvents: Map<string, IConsolidatedTradeEvent> = new Map();

  tradeEvents.forEach((event) => {
    const { eventLog, eventObj, eventMeta } = event as any;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) {
      // is a TradeEvent (readed from logs)
      decodedTrade = eventObj;
    }
    const data = decodedTrade;
    const isBuy = data.instructionType.toLowerCase() == "buy";
    const isSell = !isBuy;
    const key = `${eventMeta.sender}-${eventMeta.mint}`;
    const tokenAmount = eventLog.amount;
    const solAmount = eventLog.collateralAmount;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        userWallet: eventMeta.sender,
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

export interface IConsolidatedTradeEventForMoonshotData {
  tokenMint: string;
  tokenAmount: bigint;
  collateralAmount: bigint;
  buyCount: number;
  sellCount: number;
  buyVolume: bigint;
  sellVolume: bigint;
  volume: bigint;
  curveTokenAmount: bigint;
  curveSolAmount: bigint;
  curveLiquidity: bigint;
}

export function consolidateTradeEventsForMoonshotData(
  tradeEvents: IEvent[],
): IConsolidatedTradeEventForMoonshotData[] {
  const consolidatedEvents: Map<
    string,
    IConsolidatedTradeEventForMoonshotData
  > = new Map();

  tradeEvents.forEach((event) => {
    const { eventLog, eventObj, eventMeta } = event as any;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const data = decodedTrade;
    const isBuy = data.instructionType.toLowerCase() == "buy";
    const key = `${eventMeta.mint}`;
    const tokenAmount = eventLog.amount;
    const solAmount = eventLog.collateralAmount;
    const price = new Decimal(solAmount.toString())
      .div(new Decimal(1000000000))
      .div(new Decimal(tokenAmount.toString()).div(new Decimal(1000000000)));
    const {
      bondingCurveSolPostBalance: curveSolAmount,
      bondingCurveTokenPostBalance: curveTokenAmount,
    } = eventMeta;
    const curveLiquidity = BigInt(
      new Decimal(curveSolAmount.toString())
        .plus(new Decimal(curveTokenAmount.toString()).mul(price))
        .floor()
        .toString(),
    );

    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        tokenMint: eventMeta.mint,
        tokenAmount: tokenAmount,
        collateralAmount: solAmount,
        buyCount: isBuy ? 1 : 0,
        sellCount: !isBuy ? 1 : 0,
        buyVolume: isBuy ? solAmount : 0n,
        sellVolume: !isBuy ? solAmount : 0n,
        volume: solAmount,
        curveTokenAmount: curveTokenAmount,
        curveSolAmount: curveSolAmount,
        curveLiquidity,
      });
    } else {
      consolidatedEvent.buyCount += isBuy ? 1 : 0;
      consolidatedEvent.sellCount += !isBuy ? 1 : 0;
      consolidatedEvent.buyVolume += isBuy ? solAmount : 0n;
      consolidatedEvent.sellVolume += !isBuy ? solAmount : 0n;
      consolidatedEvent.volume += solAmount;
      consolidatedEvent.curveTokenAmount = curveTokenAmount;
      consolidatedEvent.curveSolAmount = curveSolAmount;
      consolidatedEvent.curveLiquidity = curveLiquidity;
    }
  });

  return Array.from(consolidatedEvents.values());
}
