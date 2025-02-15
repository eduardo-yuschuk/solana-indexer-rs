import { Client } from "pg";
import { GenericEventType } from "../../../event";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import {
  arrangeEventsByType,
  getSortedEventTypes,
  IBlockData,
  IProtocolSaveResult,
  IStorage,
} from "../../storage";
import { saveTradeEvents } from "./trade.storage";
import { saveMintEvents } from "./mint.storage";

export const MoonshotStorage: IStorage = {
  async saveProtocolEvents(
    client: Client,
    backendClient: Client,
    events: IEvent[],
    blockData: IBlockData,
  ): Promise<IProtocolSaveResult> {
    let rowsCount = 0;
    const result: { [id: string]: number } = {};

    const eventsByType = arrangeEventsByType(events);
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
        default:
          throw new Error(`Unknown Moonshot event to store ${type}`);
      }
    }

    return { eventsByType: result, rowsCount };
  },
};
