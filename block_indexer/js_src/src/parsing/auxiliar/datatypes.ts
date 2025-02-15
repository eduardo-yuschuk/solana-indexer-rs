// TODO: Remove this file
// This definition is based on the structure of a block received via a blockSubscribe.
// Later we added indexing of blocks retrieved on demand and discovered that the structure
// of those messages is slightly different. It is necessary to create interfaces that support
// both types of messages or to dispense with typing at this point, knowing that
// if we add another data source the structure could change again.

export type RootObject = any;
export type Block = any;
export type Transaction2 = any;
export type Instruction = any;

/*
export interface RootObject {
  jsonrpc: string;
  method: string;
  params: Params;
}

export interface Params {
  result: Result;
  subscription: number;
}

export interface Result {
  context: Context;
  value: Value;
}

export interface Value {
  slot: number;
  block: Block;
  err: null;
}

export interface Block {
  previousBlockhash: string;
  blockhash: string;
  parentSlot: number;
  transactions: Transaction2[];
  blockTime: number;
  blockHeight: number;
}

export interface Transaction2 {
  transaction: Transaction;
  meta: Meta;
  version: number | string;
}

export interface Meta {
  err: Err | Err2 | Err3 | null;
  status: Status;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  innerInstructions: (InnerInstruction | InnerInstructions2)[];
  logMessages: string[];
  preTokenBalances: (PreTokenBalance | PreTokenBalances2 | PreTokenBalances3)[];
  postTokenBalances: (PreTokenBalance | PreTokenBalances2)[];
  rewards: null;
  loadedAddresses: LoadedAddresses;
  computeUnitsConsumed: number;
  returnData?: ReturnData;
}

export interface ReturnData {
  programId: string;
  data: string[];
}

export interface LoadedAddresses {
  writable: string[];
  readonly: string[];
}

export interface PreTokenBalances3 {
  accountIndex: number;
  mint: string;
  uiTokenAmount: UiTokenAmount3;
  owner: string;
  programId: string;
}

export interface UiTokenAmount3 {
  uiAmount: null;
  decimals: number;
  amount: string;
  uiAmountString: string;
}

export interface PreTokenBalances2 {
  accountIndex: number;
  mint: string;
  uiTokenAmount: UiTokenAmount2;
  owner: string;
  programId: string;
}

export interface UiTokenAmount2 {
  uiAmount: null | number;
  decimals: number;
  amount: string;
  uiAmountString: string;
}

export interface PreTokenBalance {
  accountIndex: number;
  mint: string;
  uiTokenAmount: UiTokenAmount;
  owner: string;
  programId: string;
}

export interface UiTokenAmount {
  uiAmount: number;
  decimals: number;
  amount: string;
  uiAmountString: string;
}

export interface InnerInstructions2 {
  index: number;
  instructions: Instruction3[];
}

export interface Instruction3 {
  programIdIndex: number;
  accounts: number[];
  data: string;
  stackHeight: number;
}

export interface InnerInstruction {
  index: number;
  instructions: Instruction2[];
}

export interface Instruction2 {
  programIdIndex: number;
  accounts: number[];
  data: string;
  stackHeight: number;
}

export interface Status {
  Ok?: null;
  Err?: Err4;
}

export interface Err4 {
  InstructionError?: (InstructionError | number | string)[][];
  InsufficientFundsForRent?: InsufficientFundsForRent;
}

export interface Err3 {
  InstructionError: (InstructionError | number)[];
}

export interface InstructionError {
  Custom: number;
}

export interface Err2 {
  InsufficientFundsForRent: InsufficientFundsForRent;
}

export interface InsufficientFundsForRent {
  account_index: number;
}

export interface Err {
  InstructionError: (number | string)[];
}

export interface Transaction {
  signatures: string[];
  message: Message;
}

export interface Message {
  header: Header;
  accountKeys: string[];
  recentBlockhash: string;
  instructions: Instruction[];
  addressTableLookups?: (
    | AddressTableLookup
    | AddressTableLookups2
    | AddressTableLookups3
    | AddressTableLookups4
    | AddressTableLookups5
  )[];
}

export interface AddressTableLookups5 {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface AddressTableLookups4 {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface AddressTableLookups3 {
  accountKey: string;
  writableIndexes: any[];
  readonlyIndexes: number[];
}

export interface AddressTableLookups2 {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: any[];
}

export interface AddressTableLookup {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface Instruction {
  programIdIndex: number;
  accounts: (number | number)[];
  data: string;
  stackHeight: null;
}

export interface Header {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
}

export interface Context {
  slot: number;
}
*/
