import {
  IEvent,
  IParser,
  ParseInstructionArguments,
  ParseTransactionArguments,
  getAddressAsString,
} from "../../auxiliar/parsing";
import bs58 from "bs58";
import { decodeRayLog, LogType } from "./ray-log.decoder";
import { GenericEventType, IndexerEventSource } from "../../../event";
import { decodeInstructionData } from "./raydium.decoder";
import {
  RaydiumInstructionData,
  RaydiumInstructionType,
} from "./instruction-data";

const RAYDIUM_POOL_V4_PROGRAM_ID =
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const RAY_LOG_HEADER = "Program log: ray_log: ";
const RAY_LOG_HEADER_LENGTH = RAY_LOG_HEADER.length;

export enum RaydiumPoolV4Discriminator {
  Initialize = 0,
  Initialize2 = 1,
  MonitorStep = 2,
  Deposit = 3,
  Withdraw = 4,
  MigrateToOpenBook = 5,
  SetParams = 6,
  WithdrawPnl = 7,
  WithdrawSrm = 8,
  SwapBaseIn = 9,
  PreInitialize = 10,
  SwapBaseOut = 11,
  SimulateInfo = 12,
  AdminCancelOrders = 13,
  CreateConfigAccount = 14,
  UpdateConfigAccount = 15,
}

const instructionsWithRayLog = [
  RaydiumPoolV4Discriminator.Initialize2,
  RaydiumPoolV4Discriminator.Deposit,
  RaydiumPoolV4Discriminator.Withdraw,
  RaydiumPoolV4Discriminator.SwapBaseIn,
  RaydiumPoolV4Discriminator.SwapBaseOut,
];

export enum RaydiumSwapBaseInAccounts18 {
  SPL_TOKEN_PROGRAM = 0,
  AMM_ID,
  AMM_AUTHORITY,
  AMM_OPEN_ORDERS,
  AMM_TARGET_ORDERS,
  AMM_COIN_VAULT_ACCOUNT,
  AMM_PC_VAULT_ACCOUNT,
  MARKET_PROGRAM_ID,
  MARKET_ACCOUNT,
  MARKET_BIDS_ACCOUNT,
  MARKET_ASKS_ACCOUNT,
  MARKET_EVENT_QUEUE_ACCOUNT,
  MARKET_COIN_VAULT_ACCOUNT,
  MARKET_PC_VAULT_ACCOUNT,
  MARKET_VAULT_SIGNER_ACCOUNT,
  USER_SOURCE_TOKEN_ACCOUNT,
  USER_DESTINATION_TOKEN_ACCOUNT,
  USER_WALLET_ACCOUNT,
}

export enum RaydiumSwapBaseInAccounts17 {
  SPL_TOKEN_PROGRAM = 0,
  AMM_ID,
  AMM_AUTHORITY,
  AMM_OPEN_ORDERS,
  AMM_COIN_VAULT_ACCOUNT,
  AMM_PC_VAULT_ACCOUNT,
  MARKET_PROGRAM_ID,
  MARKET_ACCOUNT,
  MARKET_BIDS_ACCOUNT,
  MARKET_ASKS_ACCOUNT,
  MARKET_EVENT_QUEUE_ACCOUNT,
  MARKET_COIN_VAULT_ACCOUNT,
  MARKET_PC_VAULT_ACCOUNT,
  MARKET_VAULT_SIGNER_ACCOUNT,
  USER_SOURCE_TOKEN_ACCOUNT,
  USER_DESTINATION_TOKEN_ACCOUNT,
  USER_WALLET_ACCOUNT,
}

export enum RaydiumSwapBaseOutAccounts18 {
  SPL_TOKEN_PROGRAM = 0,
  AMM_ID,
  AMM_AUTHORITY,
  AMM_OPEN_ORDERS,
  AMM_TARGET_ORDERS,
  AMM_COIN_VAULT_ACCOUNT,
  AMM_PC_VAULT_ACCOUNT,
  MARKET_PROGRAM_ID,
  MARKET_ACCOUNT,
  MARKET_BIDS_ACCOUNT,
  MARKET_ASKS_ACCOUNT,
  MARKET_EVENT_QUEUE_ACCOUNT,
  MARKET_COIN_VAULT_ACCOUNT,
  MARKET_PC_VAULT_ACCOUNT,
  MARKET_VAULT_SIGNER_ACCOUNT,
  USER_SOURCE_TOKEN_ACCOUNT,
  USER_DESTINATION_TOKEN_ACCOUNT,
  USER_WALLET_ACCOUNT,
}

export enum RaydiumSwapBaseOutAccounts17 {
  SPL_TOKEN_PROGRAM = 0,
  AMM_ID,
  AMM_AUTHORITY,
  AMM_OPEN_ORDERS,
  AMM_COIN_VAULT_ACCOUNT,
  AMM_PC_VAULT_ACCOUNT,
  MARKET_PROGRAM_ID,
  MARKET_ACCOUNT,
  MARKET_BIDS_ACCOUNT,
  MARKET_ASKS_ACCOUNT,
  MARKET_EVENT_QUEUE_ACCOUNT,
  MARKET_COIN_VAULT_ACCOUNT,
  MARKET_PC_VAULT_ACCOUNT,
  MARKET_VAULT_SIGNER_ACCOUNT,
  USER_SOURCE_TOKEN_ACCOUNT,
  USER_DESTINATION_TOKEN_ACCOUNT,
  USER_WALLET_ACCOUNT,
}

export const RaydiumParser: IParser = {
  parseInstruction(args: ParseInstructionArguments): IEvent[] {
    return parseInstructionImpl(args);
  },

  parseTransaction(_args: ParseTransactionArguments): IEvent[] {
    return [];
  },
};

const createInitialize2Event = (
  slot: number,
  signature: string,
  decodedInstruction: RaydiumInstructionData,
  addresses: string[],
  instruction: any,
  failedTransaction: boolean,
) => {
  return {
    source: IndexerEventSource.Raydium,
    type: GenericEventType.Mint,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      amm: getAddressAsString(4, addresses, instruction),
      ammOpenOrders: getAddressAsString(6, addresses, instruction),
      lpMint: getAddressAsString(7, addresses, instruction),
      coinMint: getAddressAsString(8, addresses, instruction),
      pcMint: getAddressAsString(9, addresses, instruction),
      poolCoinTokenAccount: getAddressAsString(10, addresses, instruction),
      poolPcTokenAccount: getAddressAsString(11, addresses, instruction),
      poolWithdrawQueue: getAddressAsString(12, addresses, instruction),
      ammTargetOrders: getAddressAsString(13, addresses, instruction),
      poolTempLp: getAddressAsString(14, addresses, instruction),
      failedTransaction,
    },
  };
};

const createSwapBaseInEvent = (
  slot: number,
  signature: string,
  decodedInstruction: RaydiumInstructionData,
  addresses: string[],
  instruction: any,
  blockTime: number,
  failedTransaction: boolean,
) => {
  const accountIndexes = instruction.accounts
    ? instruction.accounts
    : instruction.accountKeyIndexes;

  const amm = addresses[accountIndexes[RaydiumSwapBaseInAccounts18.AMM_ID]];

  let userAccountIndex = 0;
  if (accountIndexes.length == 18) {
    userAccountIndex = RaydiumSwapBaseInAccounts18.USER_WALLET_ACCOUNT;
  } else if (accountIndexes.length == 17) {
    userAccountIndex = RaydiumSwapBaseInAccounts17.USER_WALLET_ACCOUNT;
  }

  const user = addresses[accountIndexes[userAccountIndex]];

  return {
    source: IndexerEventSource.Raydium,
    type: GenericEventType.Trade,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      amm,
      user,
      timestamp: blockTime,
      failedTransaction,
    },
  };
};

const createSwapBaseOutEvent = (
  slot: number,
  signature: string,
  decodedInstruction: RaydiumInstructionData,
  addresses: string[],
  instruction: any,
  blockTime: number,
  failedTransaction: boolean,
) => {
  const accountIndexes = instruction.accounts
    ? instruction.accounts
    : instruction.accountKeyIndexes;

  const amm = addresses[accountIndexes[RaydiumSwapBaseOutAccounts18.AMM_ID]];

  let userAccountIndex = 0;
  if (accountIndexes.length == 18) {
    userAccountIndex = RaydiumSwapBaseOutAccounts18.USER_WALLET_ACCOUNT;
  } else if (accountIndexes.length == 17) {
    userAccountIndex = RaydiumSwapBaseOutAccounts17.USER_WALLET_ACCOUNT;
  }

  const user = addresses[accountIndexes[userAccountIndex]];

  return {
    source: IndexerEventSource.Raydium,
    type: GenericEventType.Trade,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      amm,
      user,
      timestamp: blockTime,
      failedTransaction,
    },
  };
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
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  if (programId == RAYDIUM_POOL_V4_PROGRAM_ID) {
    //
    // decode function call

    const rayLogMessages = instructionsLogMessages[0]?.logMessages?.filter(
      (logMessage: string) => logMessage.startsWith(RAY_LOG_HEADER),
    );

    let functionCallEvent = undefined;

    const decodedInstruction = decodeInstructionData(instruction.data);
    switch (decodedInstruction.instructionType) {
      case RaydiumInstructionType.Initialize2: {
        if (failedTransaction) {
          break;
        }
        functionCallEvent = createInitialize2Event(
          slot,
          signature,
          decodedInstruction,
          addresses,
          instruction,
          failedTransaction,
        );
        events.push(functionCallEvent);
        break;
      }
      case RaydiumInstructionType.SwapBaseIn: {
        functionCallEvent = createSwapBaseInEvent(
          slot,
          signature,
          decodedInstruction,
          addresses,
          instruction,
          blockObject.blockTime,
          failedTransaction,
        );
        events.push(functionCallEvent);
        break;
      }
      case RaydiumInstructionType.SwapBaseOut: {
        functionCallEvent = createSwapBaseOutEvent(
          slot,
          signature,
          decodedInstruction,
          addresses,
          instruction,
          blockObject.blockTime,
          failedTransaction,
        );
        events.push(functionCallEvent);
        break;
      }
      default: {
      }
    }

    // decode ray logs

    const decodedData =
      instruction.data instanceof Buffer
        ? instruction.data
        : bs58.decode(instruction.data);
    if (instructionsWithRayLog.includes(decodedData[0])) {
      const rayLogMessage = rayLogMessages?.shift();
      // rayLogMessage == undefined when the log is truncated
      if (rayLogMessage != undefined) {
        const logObj = decodeRayLog(
          rayLogMessage!.slice(RAY_LOG_HEADER_LENGTH),
        );
        // logObj == undefined when the transaction is failed (different ray log message)
        if (logObj != undefined) {
          switch (logObj.log_type) {
            case LogType.Init: {
              if (functionCallEvent) {
                (functionCallEvent as any).rayLogEventData = logObj;
              }
              break;
            }
            case LogType.Deposit: {
              break;
            }
            case LogType.Withdraw: {
              break;
            }
            case LogType.SwapBaseIn:
            case LogType.SwapBaseOut: {
              // skip failed transactions because they don't have useful ray logs
              if (failedTransaction) {
                break;
              }
              if (functionCallEvent) {
                if (functionCallEvent) {
                  (functionCallEvent as any).rayLogEventData = logObj;
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  return events;
};
