import { IEvent } from "../../auxiliar/parsing";
import { decode } from "base-64";
import { EventType, eventTypeFromDiscriminator } from "./pumpfun.decoder";
import { decodeTradeEvent } from "./trade-event.decoder";
import {
  PumpfunCreateEventValues,
  PumpfunInstructionData,
  PumpfunTradeEventValues,
} from "./instruction-data";
import { GenericEventType, IndexerEventSource } from "../../../event";
import { decodeCreateEvent } from "./create-event.decoder";

const PUMPFUN_LOG_PREFIX = "Program data: ";
const PUMPFUN_LOG_PREFIX_LENGTH = PUMPFUN_LOG_PREFIX.length;

export function bytesToHexString(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stringToUint8Array(decodedLogMessage: string): Uint8Array {
  const intArray = [];
  for (let i = 0; i < decodedLogMessage.length; i++) {
    intArray.push(decodedLogMessage.charCodeAt(i));
  }
  const decodedData = new Uint8Array(intArray);
  return decodedData;
}

export function stringToIntArray(decodedLogMessage: string): number[] {
  const intArray = [];
  for (let i = 0; i < decodedLogMessage.length; i++) {
    intArray.push(decodedLogMessage.charCodeAt(i));
  }
  return intArray;
}

export const parseCreateInstruction = (
  slot: number,
  signature: string,
  decodedData: PumpfunInstructionData,
  logMessages: string[],
  eventMeta: any,
): IEvent[] => {
  const events: IEvent[] = [];

  if (logMessages == undefined) {
    console.error(
      `There are no logs available for this instruction\n` +
        `(slot: ${slot}, signature: ${signature}, parseCreateInstruction...`,
    );
  }

  logMessages.forEach((logMessage) => {
    if (logMessage.startsWith(PUMPFUN_LOG_PREFIX)) {
      const logMessageWithoutPrefix = logMessage!.slice(
        PUMPFUN_LOG_PREFIX_LENGTH,
      );
      try {
        // TODO improve this
        const decodedLogMessage = decode(logMessageWithoutPrefix);
        const intArray = stringToIntArray(decodedLogMessage);
        const decodedLogData = stringToUint8Array(decodedLogMessage);
        const header = bytesToHexString(intArray.slice(0, 8));

        const eventType = eventTypeFromDiscriminator(header);
        switch (eventType) {
          case EventType.CreateEvent: {
            const decodedTrade: PumpfunCreateEventValues | undefined =
              decodeCreateEvent(decodedLogData);
            if (decodedTrade != undefined) {
              events.push({
                source: IndexerEventSource.Pumpfun,
                type: GenericEventType.Mint,
                slot,
                signature,
                eventObj: { decodedData, decodedTrade },
                eventMeta,
              });
            }
            break;
          }
          default: {
          }
        }
      } catch (err) {
        // ignore the incomprehensible log
        // InvalidCharacterError: Invalid character: the string to be decoded is not correctly encoded.
        console.error(err);
      }
    }
  });

  if (events.length != 1) {
    throw new Error(
      "Inconsistent information was found during the parsing of the trade event",
    );
  }

  return events;
};

export const parseTradeInstruction = (
  slot: number,
  signature: string,
  decodedData: PumpfunInstructionData,
  logMessages: string[],
  eventMeta: any,
): IEvent[] => {
  const events: IEvent[] = [];

  if (logMessages == undefined) {
    console.error(
      `There are no logs available for this instruction\n` +
        `(slot: ${slot}, signature: ${signature}, parseTradeInstruction...`,
    );
  }

  logMessages.forEach((logMessage) => {
    if (logMessage.startsWith(PUMPFUN_LOG_PREFIX)) {
      const logMessageWithoutPrefix = logMessage!.slice(
        PUMPFUN_LOG_PREFIX_LENGTH,
      );
      try {
        // TODO improve this
        const decodedLogMessage = decode(logMessageWithoutPrefix);
        const intArray = stringToIntArray(decodedLogMessage);
        const decodedLogData = stringToUint8Array(decodedLogMessage);
        const header = bytesToHexString(intArray.slice(0, 8));

        const eventType = eventTypeFromDiscriminator(header);
        switch (eventType) {
          case EventType.TradeEvent: {
            const decodedTrade: PumpfunTradeEventValues =
              decodeTradeEvent(decodedLogData);
            events.push({
              source: IndexerEventSource.Pumpfun,
              type: GenericEventType.Trade,
              slot,
              signature,
              eventObj: { decodedData, decodedTrade },
              eventMeta,
            });
            break;
          }
          default: {
          }
        }
      } catch (err) {
        // ignore the incomprehensible log
        // InvalidCharacterError: Invalid character: the string to be decoded is not correctly encoded.
        console.error(err);
      }
    }
  });

  if (events.length != 1) {
    throw new Error(
      "Inconsistent information was found during the parsing of the trade event",
    );
  }

  return events;
};
