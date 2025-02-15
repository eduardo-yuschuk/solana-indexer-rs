import { IEvent } from "../../../parsing/auxiliar/parsing";
import {
  arrangeEventsByType,
  getSortedEventTypes,
  IBlockData,
  IProtocolSaveResult,
  IStorage,
} from "../../storage";
import { GenericEventType } from "../../../event";
import { saveTradeEvents } from "./trade.storage";
import { saveMintEvents } from "./mint.storage";
import { Client } from "pg";
import { saveCompleteEvents } from "./complete.storage";
import { markSniperTradeEvents } from "./early-trades.storage";
import { markEarlyTradeEvents } from "./early-trades.storage";

export const PumpFunStorage: IStorage = {
  async saveProtocolEvents(
    client: Client,
    backendClient: Client,
    events: IEvent[],
    blockData: IBlockData,
  ): Promise<IProtocolSaveResult> {
    let rowsCount = 0;
    const result: { [id: string]: number } = {};

    const eventsByType = arrangeEventsByType(events);

    const nonFailedTradingEvents = eventsByType[GenericEventType.Trade]?.filter(
      (event) => !event.eventMeta.failedTransaction,
    );

    markEarlyTradeEvents(
      eventsByType[GenericEventType.Mint] ?? [],
      nonFailedTradingEvents ?? [],
    );

    await markSniperTradeEvents(
      nonFailedTradingEvents ?? [],
      client,
      blockData,
    );

    const orderedEventTypes = getSortedEventTypes(eventsByType);

    for (const type of orderedEventTypes) {
      result[type] = eventsByType[type].length;
      switch (type) {
        case GenericEventType.Trade: {
          rowsCount += (
            await saveTradeEvents(
              client,
              backendClient,
              eventsByType[type],
              blockData,
            )
          ).rowsCount;
          break;
        }
        case GenericEventType.Mint: {
          rowsCount += (
            await saveMintEvents(client, eventsByType[type], blockData)
          ).rowsCount;
          break;
        }
        case GenericEventType.Complete: {
          rowsCount += (
            await saveCompleteEvents(client, eventsByType[type], blockData)
          ).rowsCount;
          break;
        }
        default:
          throw new Error(`Unknown Pumpfun event to store ${type}`);
      }
    }

    return { eventsByType: result, rowsCount };
  },
};
