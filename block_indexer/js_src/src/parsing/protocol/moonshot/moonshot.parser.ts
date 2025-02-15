import { decodeInstructionData } from "./moonshot.decoder";
import {
  IEvent,
  IParser,
  ParseInstructionArguments,
  ParseTransactionArguments,
  getAddressAsString,
  getAddressIndex,
} from "../../auxiliar/parsing";
import { GenericEventType, IndexerEventSource } from "../../../event";
import { decode } from "base-64";
import {
  MoonshotInstructionType,
  MoonshotTradeEventValues,
} from "./instruction-data";
import { decodeTradeEvent } from "./trade-event.decoder";
import { getBalances, getTokenBalances } from "../solana/solana.parser";

const MOONSHOT_PROGRAM_ID = "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG";

const TARGET_LOGS = ["bddb7fd34ee661ee"];

const MOONSHOT_LOG_PREFIX = "Program data: ";
const MOONSHOT_LOG_PREFIX_LENGTH = MOONSHOT_LOG_PREFIX.length;

export const MoonshotParser: IParser = {
  parseInstruction(args: ParseInstructionArguments): IEvent[] {
    return parseInstructionImpl(args);
  },

  parseTransaction(_args: ParseTransactionArguments): IEvent[] {
    return [];
  },
};

const parseInstructionImpl = (args: ParseInstructionArguments): IEvent[] => {
  const {
    slot,
    blockObject,
    transactionObject,
    addresses,
    instruction,
    instructionsLogMessages,
  } = args;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const programId = addresses[instruction.programIdIndex];
  const { blockTime } = blockObject;
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  let functionCallEvent = undefined;

  if (programId != MOONSHOT_PROGRAM_ID) {
    return events;
  }

  const decodedInstruction = decodeInstructionData(instruction.data);
  switch (decodedInstruction.instructionType) {
    //
    // TRADE
    //
    case MoonshotInstructionType.Sell:
    case MoonshotInstructionType.Buy: {
      const curveAccountIndex = getAddressIndex(2, instruction);
      // const curveAccount = getAddressAsString(2, addresses, instruction);

      const curveTokenAccountIndex = getAddressIndex(3, instruction);
      // const curveTokenAccount = getAddressAsString(3, addresses, instruction);

      const curveTokenAccountTokenBalances = getTokenBalances(
        meta,
        curveTokenAccountIndex,
      );
      const curveTokenAccountTokenPostBalance = BigInt(
        curveTokenAccountTokenBalances.postBalances[0]?.uiTokenAmount?.amount ??
          0,
      );

      const curveAccountSolBalances = getBalances(meta, curveAccountIndex);
      const curveAccountSolPostBalance = BigInt(
        curveAccountSolBalances?.postBalance ?? 0,
      );

      functionCallEvent = {
        source: IndexerEventSource.Moonshot,
        type: GenericEventType.Trade,
        slot,
        signature,
        eventObj: decodedInstruction,
        eventMeta: {
          blockTime,
          sender: getAddressAsString(0, addresses, instruction),
          // senderTokenAccount
          // curveAccount
          // curveTokenAccount
          // dexFee
          // helioFee
          mint: getAddressAsString(6, addresses, instruction),
          // configAccount
          // tokenProgram
          // associatedTokenProgram
          // systemProgram
          failedTransaction,
          // post-balances
          bondingCurveTokenPostBalance: curveTokenAccountTokenPostBalance,
          bondingCurveSolPostBalance: curveAccountSolPostBalance,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    case MoonshotInstructionType.TokenMint: {
      if (failedTransaction) {
        break;
      }
      //
      // MINT
      //
      functionCallEvent = {
        source: IndexerEventSource.Moonshot,
        type: GenericEventType.Mint,
        slot,
        signature,
        eventObj: decodedInstruction,
        eventMeta: {
          sender: getAddressAsString(0, addresses, instruction),
          // backendAuthority: getAddressAsString(1, addresses, instruction),
          curveAccount: getAddressAsString(2, addresses, instruction),
          mint: getAddressAsString(3, addresses, instruction),
          mintMetadata: getAddressAsString(4, addresses, instruction),
          curveTokenAccount: getAddressAsString(5, addresses, instruction),
          configAccount: getAddressAsString(6, addresses, instruction),
          // tokenProgram
          // associatedTokenProgram
          // mplTokenMetadata
          // systemProgram
          failedTransaction,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    case MoonshotInstructionType.MigrateFunds: {
      if (failedTransaction) {
        break;
      }
      //
      // COMPLETE
      //
      functionCallEvent = {
        source: IndexerEventSource.Moonshot,
        type: GenericEventType.Complete,
        slot,
        signature,
        eventObj: decodedInstruction,
        eventMeta: {
          // backendAuthority
          // migrationAuthority
          curveAccount: getAddressAsString(2, addresses, instruction),
          curveTokenAccount: getAddressAsString(3, addresses, instruction),
          // migrationAuthorityTokenAccount
          mint: getAddressAsString(5, addresses, instruction),
          // dexFeeAccount
          // helioFeeAccount
          // configAccount
          // systemProgram
          // tokenProgram
          // associatedTokenProgram
          failedTransaction,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    case MoonshotInstructionType.ConfigInit:
    case MoonshotInstructionType.ConfigUpdate: {
      if (failedTransaction) {
        break;
      }
      functionCallEvent = {
        source: IndexerEventSource.Moonshot,
        type: GenericEventType.Info,
        slot,
        signature,
        eventObj: decodedInstruction,
        eventMeta: {
          // configAuthority
          // configAccount
          // systemProgram (just for ConfigInit)
          failedTransaction,
        },
      };
      events.push(functionCallEvent);
      break;
    }
    default: {
    }
  }

  // skip failed transactions log parsing
  if (failedTransaction) {
    return events;
  }

  if (functionCallEvent == undefined) {
    return events;
  }

  // read the log messages

  const { address, logMessages } = instructionsLogMessages[0];

  if (address != MOONSHOT_PROGRAM_ID) {
    console.error(
      `Moonshot parser: log adddress doesn't match invoked program`,
    );
    return events;
  }

  for (const logMessage of logMessages) {
    if (logMessage.startsWith(MOONSHOT_LOG_PREFIX)) {
      const logMessageWithoutPrefix = logMessage!.slice(
        MOONSHOT_LOG_PREFIX_LENGTH,
      );
      const decodedLogMessage = decode(logMessageWithoutPrefix);
      const intArray = stringToIntArray(decodedLogMessage);
      const decodedData = stringToUint8Array(decodedLogMessage);
      const header = bytesToHexString(intArray.slice(0, 8));

      if (TARGET_LOGS.includes(header)) {
        const decodedTrade: MoonshotTradeEventValues =
          decodeTradeEvent(decodedData);
        (functionCallEvent as any).eventLog = {
          amount: decodedTrade.amount,
          collateralAmount: decodedTrade.collateralAmount,
          dexFee: decodedTrade.dexFee,
          helioFee: decodedTrade.helioFee,
          allocation: decodedTrade.allocation,
          curve: decodedTrade.curve.toBase58(),
          costToken: decodedTrade.costToken.toBase58(),
          sender: decodedTrade.sender.toBase58(),
          type: decodedTrade.type,
          label: decodedTrade.label,
        };
      }
    }
  }

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
