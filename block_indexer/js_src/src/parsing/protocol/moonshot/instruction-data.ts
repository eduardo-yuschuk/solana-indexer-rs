import { PublicKey } from "@solana/web3.js";

export enum MoonshotInstructionDiscriminator {
  Buy = "16927863322537952870",
  Sell = "12502976635542562355",
  TokenMint = "12967285527113116675",
  ConfigInit = "-1",
  ConfigUpdate = "-2",
}

export enum MoonshotInstructionType {
  Buy = "Buy",
  Sell = "Sell",
  TokenMint = "TokenMint",
  MigrateFunds = "MigrateFunds",
  ConfigInit = "ConfigInit",
  ConfigUpdate = "ConfigUpdate",
  Unknown = "Unknown",
}

export interface MoonshotInstructionData {
  instructionType: MoonshotInstructionType;
  instructionValues: IMoonshotInstructionValues | undefined;
}

export interface IMoonshotInstructionValues {}

// tokenAmount: u64
// collateralAmount: u64
// fixedSide: u8
// slippageBps: u64

export interface MoonshotTradeValues extends IMoonshotInstructionValues {
  tokenAmount: bigint;
  collateralAmount: bigint;
  fixedSide: number;
  slippageBps: bigint;
}

export enum FixedSide {
  ExactIn = 0,
  ExactOut = 1,
}

// name: string
// symbol: string
// uri: string
// decimals: u8
// collateralCurrency: u8
// amount: u64
// curveType: u8
// migrationTarget: u8

export interface MoonshotTokenMintValues extends IMoonshotInstructionValues {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  collateralCurrency: number;
  amount: bigint;
  curveType: number;
  migrationTarget: number;
}

export enum Currency {
  Sol = 0,
}

export enum CurveType {
  LinearV1 = 0,
  ConstantProductV1 = 1,
}

export enum MigrationTarget {
  Raydium = 0,
  Meteora = 1,
}

export interface MoonshotConfigValues extends IMoonshotInstructionValues {
  migrationAuthority: PublicKey;
  backendAuthority: PublicKey;
  configAuthority: PublicKey;
  helioFee: PublicKey;
  dexFee: PublicKey;
  feeBps: number;
  dexFeeShare: number;
  migrationFee: bigint;
  marketcapThreshold: bigint;
  marketcapCurrency: number;
  minSupportedDecimalPlaces: number;
  maxSupportedDecimalPlaces: number;
  minSupportedTokenSupply: bigint;
  maxSupportedTokenSupply: bigint;
  coefB: number;
}

// amount: u64
// collateralAmount: u64
// dexFee: u64
// helioFee: u64
// allocation: u64
// curve: publicKey
// costToken: publicKey
// sender: publicKey
// type: TradeType
// label: string

export interface MoonshotTradeEventValues extends IMoonshotInstructionValues {
  amount: bigint;
  collateralAmount: bigint;
  dexFee: bigint;
  helioFee: bigint;
  allocation: bigint;
  curve: PublicKey;
  costToken: PublicKey;
  sender: PublicKey;
  type: number;
  label: string;
}

export enum TradeType {
  Buy = 0,
  Sell = 1,
}

export interface MoonshotMigrationEventValues
  extends IMoonshotInstructionValues {
  tokensMigrated: bigint;
  tokensBurned: bigint;
  collateralMigrated: bigint;
  fee: bigint;
  label: string;
}
