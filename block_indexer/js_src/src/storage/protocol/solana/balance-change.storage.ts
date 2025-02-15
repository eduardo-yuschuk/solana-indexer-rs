import { Client } from "pg";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { saveSplTokenHoldersJsonb } from "./holders.storage";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { filterAndCompleteData } from "./events-filter";
import { updatePumpTokenStats } from "../pumpfun/balance-change.storage";
import { updateMoonshotTokenStats } from "../moonshot/balance-change.storage";

export async function saveSplTokenBalanceChangeEvents(
  client: Client,
  backendClient: Client,
  splTokenBalanceChangeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (splTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(splTokenBalanceChangeEvents);

  const eventsFromOurProtocols = await filterAndCompleteData(
    client,
    splTokenBalanceChangeEvents,
  );

  let rowsCount = 0;

  // TODO: deprecated, replaced by saveSplTokenHoldersJsonb
  // rowsCount += (
  //   await saveSplTokenHolders(
  //     client,
  //     backendClient,
  //     eventsFromOurProtocols,
  //     blockData,
  //   )
  // ).rowsCount;

  rowsCount += (
    await saveSplTokenHoldersJsonb(
      client,
      backendClient,
      eventsFromOurProtocols,
      blockData,
    )
  ).rowsCount;

  rowsCount += (
    await updatePumpTokenStats(
      client,
      backendClient,
      eventsFromOurProtocols,
      blockData,
    )
  ).rowsCount;

  rowsCount += (
    await updateMoonshotTokenStats(
      client,
      backendClient,
      eventsFromOurProtocols,
      blockData,
    )
  ).rowsCount;

  return { rowsCount };
}
