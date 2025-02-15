import { PublicKey } from "@solana/web3.js";
import { GenericEventType } from "../../event";
import { Block, Instruction, Transaction2 } from "./datatypes";
import { InstructionLogs } from "../transaction-log.parser";

export const stringifyObj = (obj: any) => {
  const isBigInt = (value: any) => typeof value === "bigint";

  const replacer = (_key: any, value: any) => {
    if (isBigInt(value)) {
      return value.toString();
    }
    return value;
  };

  return JSON.stringify(obj, replacer);
};

export const addressAsString = (key: PublicKey | string): string => {
  if (key instanceof PublicKey) {
    return (key as PublicKey).toBase58();
  }
  return key as string;
};

export const getAddressAsString = (
  index: number,
  addresses: string[],
  instruction: any,
): string => {
  const addressIndex = instruction.accounts
    ? instruction.accounts[index]
    : instruction.accountKeyIndexes[index];
  return addressAsString(addresses[addressIndex]);
};

export const getAddressIndex = (index: number, instruction: any): number => {
  const addressIndex = instruction.accounts
    ? instruction.accounts[index]
    : instruction.accountKeyIndexes[index];
  return addressIndex;
};

export const tryToGetAddressAsPublicKey = (
  index: number,
  addresses: string[],
  instruction: any,
): PublicKey | undefined => {
  const accounts = instruction.accounts
    ? instruction.accounts
    : instruction.accountKeyIndexes;
  if (accounts.length <= index) return undefined;
  const addressIndex = accounts[index];
  if (addresses.length <= addressIndex) return undefined;
  return new PublicKey(addressAsString(addresses[addressIndex]));
};

export const tryToGetAddressAsString = (
  index: number,
  addresses: string[],
  instruction: any,
): string | undefined => {
  const accounts = instruction.accounts
    ? instruction.accounts
    : instruction.accountKeyIndexes;
  if (accounts.length <= index) return undefined;
  const addressIndex = accounts[index];
  if (addresses.length <= addressIndex) return undefined;
  return addressAsString(addresses[addressIndex]);
};

export interface IEvent {
  source: string;
  type: GenericEventType;
  slot: number;
  signature: string;
  eventObj: any;
  eventMeta: any;
}

// TODO: remove this once we are sure that we are not going to have failed transactions in the wrong places
export function assertNonFailedTransaction(_events: IEvent[]) {
  // for (const event of events) {
  //   if (event.eventMeta.failedTransaction) {
  //     throw new Error("Unexpected failed transaction");
  //   }
  // }
}

export interface TransactionParserArguments {
  slot: number;
  blockObject: Block;
  transactionObject: Transaction2;
  transactionIndex: number;
  parsers: IParser[];
}

export interface InstructionParserArguments {
  slot: number;
  blockObject: Block;
  transactionObject: Transaction2;
  instruction: Instruction;
  instructionIndex: number;
  parsers: IParser[];
  addresses: string[];
  instructionsLogMessages: InstructionLogs[];
}

export interface ParseInstructionArguments {
  slot: number;
  blockObject: Block;
  transactionObject: Transaction2;
  instruction: Instruction;
  instructionIndex: number;
  parentInstruction: Instruction | undefined;
  addresses: any[];
  instructionsLogMessages: InstructionLogs[];
}

export interface ParseTransactionArguments {
  slot: number;
  blockObject: Block;
  transactionObject: Transaction2;
  instructionsLogMessages: readonly InstructionLogs[];
  addresses: any[];
}

export interface IParser {
  parseInstruction: (args: ParseInstructionArguments) => IEvent[];
  parseTransaction: (args: ParseTransactionArguments) => IEvent[];
}
