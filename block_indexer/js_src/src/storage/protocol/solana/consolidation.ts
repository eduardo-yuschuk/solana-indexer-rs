import { IEvent } from "../../../parsing/auxiliar/parsing";
import {
  IAggregatedSplTokenBalanceChangeEvent,
  IConsolidatedSplTokenBalanceChangeEvent,
} from "../../consolidation";

export function consolidateSplTokenBalanceChangeEvents(
  splTokenBalanceChangeEvents: IEvent[],
): IConsolidatedSplTokenBalanceChangeEvent[] {
  const consolidatedEvents: Map<
    string,
    IConsolidatedSplTokenBalanceChangeEvent
  > = new Map();

  // keep the most recent amount for each mint of each owner
  splTokenBalanceChangeEvents.forEach((event) => {
    const { eventObj, isBondingCurve, isDeveloper } = event as any;
    const { oldAmount, newAmount, decimals, mint, owner, tokenAccount } =
      eventObj;
    const key = `${owner}-${mint}`;
    const consolidatedEvent = consolidatedEvents.get(key);
    if (consolidatedEvent == undefined) {
      consolidatedEvents.set(key, {
        wallet: owner,
        mint: mint,
        tokenAccount: tokenAccount,
        decimals: decimals,
        // store the first old amount as the initial amount
        oldAmount: oldAmount,
        newAmount: newAmount,
        isBondingCurve,
        isDeveloper,
      });
    } else {
      // update the new amount until the last event
      consolidatedEvent.newAmount = newAmount;
    }
  });

  return Array.from(consolidatedEvents.values());
}

export function aggregateSplTokenBalanceChangeEvents(
  splTokenBalanceChangeEvents: IEvent[],
): IAggregatedSplTokenBalanceChangeEvent[] {
  const aggregatedEvents: Map<string, IAggregatedSplTokenBalanceChangeEvent> =
    new Map();

  splTokenBalanceChangeEvents.forEach((event) => {
    const { eventObj, isDeveloper } = event as any;
    const { oldAmount, newAmount, mint } = eventObj;
    const key = `${mint}`;
    const aggregatedEvent = aggregatedEvents.get(key);
    let holdersChange = 0;
    // conditions are not simplified because of possible events with no amount change in the future
    if (oldAmount == 0n && newAmount > 0n) {
      holdersChange = 1;
    } else if (newAmount == 0n && oldAmount > 0n) {
      holdersChange = -1;
    }
    const amountChange = ((newAmount as bigint) - oldAmount) as bigint;
    if (aggregatedEvent == undefined) {
      aggregatedEvents.set(key, {
        mint: mint,
        devHoldSum: isDeveloper ? newAmount : 0n,
        totalAmount: amountChange,
        totalHolders: holdersChange,
      });
    } else {
      if (isDeveloper) {
        aggregatedEvent.devHoldSum = newAmount;
      }
      aggregatedEvent.totalAmount += amountChange;
      aggregatedEvent.totalHolders += holdersChange;
    }
  });

  return Array.from(aggregatedEvents.values());
}
