import {
  IEvent,
  ParseInstructionArguments,
  IParser,
  ParseTransactionArguments,
  tryToGetAddressAsPublicKey,
} from "../../auxiliar/parsing";
import {
  PumpfunCompleteEventValues,
  PumpfunCreateEventValues,
  PumpfunInstructionType,
  PumpfunTradeEventValues,
} from "./instruction-data";
import { decode } from "base-64";
import {
  decodeInstructionData,
  EventType,
  eventTypeFromDiscriminator,
} from "./pumpfun.decoder";
import { decodeTradeEvent } from "./trade-event.decoder";
import { GenericEventType, IndexerEventSource } from "../../../event";
import { decodeCreateEvent } from "./create-event.decoder";
import { decodeCompleteEvent } from "./complete-event.decoder";

const PUMPFUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
// const PUMPFUN_PUBLIC_KEY = new PublicKey(PUMPFUN_PROGRAM_ID);

const PUMPFUN_LOG_PREFIX = "Program data: ";
const PUMPFUN_LOG_PREFIX_LENGTH = PUMPFUN_LOG_PREFIX.length;

const TARGET_LOGS = [
  "1b72a94ddeeb6376",
  "bddb7fd34ee661ee",
  "5f72619cd42e9808",
  "dfc39ff63e308f83",
];

export const PumpFunParser: IParser = {
  parseInstruction(args: ParseInstructionArguments): IEvent[] {
    // parse only instruction of failed transactions
    return parseInstructionImpl(args);
  },

  parseTransaction(args: ParseTransactionArguments): IEvent[] {
    // parse only successful transactions
    return parseTransactionImpl(args);
  },
};

// used for parsing failed transactions (logs are not available or incomplete)
const parseInstructionImpl = (args: ParseInstructionArguments): IEvent[] => {
  const { slot, blockObject, transactionObject, addresses, instruction } = args;
  const { blockTime } = blockObject;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const programId = addresses[instruction.programIdIndex];
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  // skip successful transactions, only interested in failed ones (the success ones are parsed in parseTransactionImpl)
  if (!failedTransaction) {
    return events;
  }

  let functionCallEvent = undefined;

  if (programId != PUMPFUN_PROGRAM_ID) {
    return events;
  }

  const decodedData = decodeInstructionData(instruction.data);
  switch (decodedData.instructionType) {
    case PumpfunInstructionType.Buy: {
      const mint = tryToGetAddressAsPublicKey(2, addresses, instruction);
      if (failedTransaction && mint == undefined) break;
      const bondingCurve = tryToGetAddressAsPublicKey(
        3,
        addresses,
        instruction,
      );
      if (failedTransaction && bondingCurve == undefined) break;
      const associatedBondingCurve = tryToGetAddressAsPublicKey(
        4,
        addresses,
        instruction,
      );
      if (failedTransaction && associatedBondingCurve == undefined) break;
      const user = tryToGetAddressAsPublicKey(6, addresses, instruction);
      if (failedTransaction && user == undefined) break;
      functionCallEvent = {
        source: IndexerEventSource.Pumpfun,
        type: GenericEventType.Trade,
        slot,
        signature,
        eventObj: {
          ...decodedData,
          blockTime,
          // Global
          // Fee Recipient
          mint,
          bondingCurve,
          associatedBondingCurve,
          // Associated User
          user,
          // System Program
          // Token Program
          // Rent
          // Event Authority
          // Program
        },
        eventMeta: {
          tradeType: PumpfunInstructionType.Buy,
          failedTransaction,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    case PumpfunInstructionType.Sell: {
      const mint = tryToGetAddressAsPublicKey(2, addresses, instruction);
      if (failedTransaction && mint == undefined) break;
      const bondingCurve = tryToGetAddressAsPublicKey(
        3,
        addresses,
        instruction,
      );
      if (failedTransaction && bondingCurve == undefined) break;
      const associatedBondingCurve = tryToGetAddressAsPublicKey(
        4,
        addresses,
        instruction,
      );
      if (failedTransaction && associatedBondingCurve == undefined) break;
      const user = tryToGetAddressAsPublicKey(6, addresses, instruction);
      if (failedTransaction && user == undefined) break;
      functionCallEvent = {
        source: IndexerEventSource.Pumpfun,
        type: GenericEventType.Trade,
        slot,
        signature,
        eventObj: {
          ...decodedData,
          blockTime,
          // Global
          // Fee Recipient
          mint,
          bondingCurve,
          associatedBondingCurve,
          // Associated User
          user,
          // System Program
          // Associated Token Program
          // Token Program
          // Event Authority
          // Program
        },
        eventMeta: {
          tradeType: PumpfunInstructionType.Sell,
          failedTransaction,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    default: {
      break;
    }
  }

  return events;
};

// used for parsing successful transactions (logs are available)
const parseTransactionImpl = (args: ParseTransactionArguments): IEvent[] => {
  const { instructionsLogMessages } = args;
  const { slot, transactionObject } = args;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  // skip failed transactions, only interested in successful ones
  if (failedTransaction) {
    return events;
  }

  instructionsLogMessages.forEach((instructionLogMessages) => {
    if (instructionLogMessages.address == PUMPFUN_PROGRAM_ID) {
      const { logMessages } = instructionLogMessages;
      logMessages.forEach((logMessage) => {
        if (logMessage.startsWith(PUMPFUN_LOG_PREFIX)) {
          const logMessageWithoutPrefix = logMessage!.slice(
            PUMPFUN_LOG_PREFIX_LENGTH,
          );
          try {
            const decodedLogMessage = decode(logMessageWithoutPrefix);
            const intArray = stringToIntArray(decodedLogMessage);
            const decodedData = stringToUint8Array(decodedLogMessage);
            const header = bytesToHexString(intArray.slice(0, 8));

            if (TARGET_LOGS.includes(header)) {
              const eventType = eventTypeFromDiscriminator(header);
              switch (eventType) {
                case EventType.TradeEvent: {
                  const decodedTrade: PumpfunTradeEventValues =
                    decodeTradeEvent(decodedData);
                  events.push({
                    source: IndexerEventSource.Pumpfun,
                    type: GenericEventType.Trade,
                    slot,
                    signature,
                    eventObj: decodedTrade,
                    eventMeta: {
                      failedTransaction,
                    },
                  });
                  break;
                }
                case EventType.CreateEvent: {
                  if (failedTransaction) {
                    break;
                  }
                  const decodedCreate: PumpfunCreateEventValues =
                    decodeCreateEvent(decodedData);
                  events.push({
                    source: IndexerEventSource.Pumpfun,
                    type: GenericEventType.Mint,
                    slot,
                    signature,
                    eventObj: decodedCreate,
                    eventMeta: {
                      failedTransaction,
                    },
                  });
                  break;
                }
                case EventType.SetParamsEvent: {
                  break;
                }
                case EventType.CompleteEvent: {
                  if (failedTransaction) {
                    break;
                  }
                  const decodedComplete: PumpfunCompleteEventValues =
                    decodeCompleteEvent(decodedData);
                  events.push({
                    source: IndexerEventSource.Pumpfun,
                    type: GenericEventType.Complete,
                    slot,
                    signature,
                    eventObj: decodedComplete,
                    eventMeta: {
                      failedTransaction,
                    },
                  });
                  break;
                }
                default: {
                }
              }
            }
          } catch (err) {
            // InvalidCharacterError: Invalid character: the string to be decoded is not correctly encoded.
            console.error(err);
          }
        }
      });
    }
  });

  return events;
};

function bytesToHexString(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stringToUint8Array(decodedLogMessage: string): Uint8Array {
  const intArray = [];
  for (let i = 0; i < decodedLogMessage.length; i++) {
    intArray.push(decodedLogMessage.charCodeAt(i));
  }
  const decodedData = new Uint8Array(intArray);
  return decodedData;
}

function stringToIntArray(decodedLogMessage: string): number[] {
  const intArray = [];
  for (let i = 0; i < decodedLogMessage.length; i++) {
    intArray.push(decodedLogMessage.charCodeAt(i));
  }
  return intArray;
}
