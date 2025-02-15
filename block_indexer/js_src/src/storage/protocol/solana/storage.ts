/* eslint-disable @typescript-eslint/no-unused-vars */
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
import {
  saveSolTransferEvents,
  saveSplTokenTransferEvents,
} from "./transfer.storage";
import { saveSplTokenBalanceChangeEvents } from "./balance-change.storage";

export const SolanaStorage: IStorage = {
  async saveProtocolEvents(
    client: Client,
    backendClient: Client,
    events: IEvent[],
    blockData: IBlockData,
  ): Promise<IProtocolSaveResult> {
    if (events.length === 0) return { eventsByType: {}, rowsCount: 0 };

    const result: { [id: string]: number } = {};

    let rowsCount = 0;

    const eventsByType = arrangeEventsByType(events);
    const orderedEventTypes = getSortedEventTypes(eventsByType);

    for (const type of orderedEventTypes) {
      result[type] = eventsByType[type].length;
      switch (type) {
        case GenericEventType.SolTransfer: {
          rowsCount += (
            await saveSolTransferEvents(
              client,
              backendClient,
              eventsByType[type],
              blockData,
            )
          ).rowsCount;
          break;
        }
        case GenericEventType.SplTokenTransfer: {
          rowsCount += (
            await saveSplTokenTransferEvents(
              client,
              backendClient,
              eventsByType[type],
              blockData,
            )
          ).rowsCount;
          break;
        }
        case GenericEventType.SplTokenBalanceChange: {
          rowsCount += (
            await saveSplTokenBalanceChangeEvents(
              client,
              backendClient,
              eventsByType[type],
              blockData,
            )
          ).rowsCount;
          break;
        }
        default:
          throw new Error(`Unknown Solana event to store ${type}`);
      }
    }

    return { eventsByType: result, rowsCount };
  },
};
