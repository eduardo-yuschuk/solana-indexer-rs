import { PublicKey } from "@solana/web3.js";

// bytes = new Uint8Array([183, 18, 70, 156, 148, 109, 161, 34])
// bytes.reverse()
// Buffer.from(bytes).toString("hex")

export enum PumpfunInstructionDiscriminator {
  Initialize = "17121445590508351407",
  SetParams = "18411476951383809957",
  Create = "8576854823835016728",
  Buy = "16927863322537952870",
  Sell = "12502976635542562355", // 12502976635542562355n
  Withdraw = "2495396153584390839",
}

export enum PumpfunInstructionType {
  Initialize = "Initialize",
  SetParams = "SetParams",
  Create = "Create",
  Buy = "Buy",
  Sell = "Sell",
  Withdraw = "Withdraw",
  Unknown = "Unknown",
}

export interface PumpfunInstructionData {
  instructionType: PumpfunInstructionType;
  instructionValues: IPumpfunInstructionValues | undefined;
}

export interface IPumpfunInstructionValues {}

// mint: pubkey
// solAmount: u64
// tokenAmount: u64
// isBuy: bool
// user: pubkey
// timestamp: i64
// virtualSolReserves: u64
// virtualTokenReserves: u64
// realSolReserves: u64
// realTokenReserves: u64

export interface PumpfunTradeEventValues extends IPumpfunInstructionValues {
  mint: PublicKey;
  solAmount: bigint;
  tokenAmount: bigint;
  isBuy: boolean;
  user: PublicKey;
  timestamp: number;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
}

// amount: u64
// maxSolCost: u64

export interface PumpfunBuyValues extends IPumpfunInstructionValues {
  amount: bigint;
  maxSolCost: bigint;
}

// amount: u64
// minSolOutput: u64

export interface PumpfunSellValues extends IPumpfunInstructionValues {
  amount: bigint;
  minSolOutput: bigint;
}

// name: string
// symbol: string
// uri: string

export interface PumpfunCreateValues extends IPumpfunInstructionValues {
  name: string;
  symbol: string;
  uri: string;
}

// name: string
// symbol: string
// uri: string
// mint: pubkey
// bondingCurve: pubkey
// user: pubkey

export interface PumpfunCreateEventValues extends IPumpfunInstructionValues {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  bondingCurve: PublicKey;
  user: PublicKey;
}

// user: pubkey
// mint: pubkey
// bondingCurve: pubkey
// timestamp: i64

export interface PumpfunCompleteEventValues extends IPumpfunInstructionValues {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: number;
}
