import * as borsh from "borsh";
import {
  MoonshotConfigValues,
  MoonshotTokenMintValues,
} from "./instruction-data";
import { PublicKey } from "@solana/web3.js";

// name: string
// symbol: string
// uri: string
// decimals: u8
// collateralCurrency: u8
// amount: u64
// curveType: u8
// migrationTarget: u8

interface iTokenMint {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  collateralCurrency: number;
  amount: number;
  curveType: number;
  migrationTarget: number;
}

class TokenMintStruct implements iTokenMint {
  name!: string;
  symbol!: string;
  uri!: string;
  decimals!: number;
  collateralCurrency!: number;
  amount!: number;
  curveType!: number;
  migrationTarget!: number;

  constructor(fields: iTokenMint) {
    Object.assign(this, fields);
  }
}

const TokenMintSchema = new Map<any, any>([
  [
    TokenMintStruct,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
        ["decimals", "u8"],
        ["collateralCurrency", "u8"],
        ["amount", "u64"],
        ["curveType", "u8"],
        ["migrationTarget", "u8"],
      ],
    },
  ],
]);

// TODO the implementation is different because I couldn't get @solana/buffer-layout to work with utf8

export const decodeTokenMint = (
  decodedData: Uint8Array,
): MoonshotTokenMintValues => {
  const deserialized = borsh.deserializeUnchecked(
    TokenMintSchema,
    TokenMintStruct,
    Buffer.from(decodedData.slice(8)),
  );

  return {
    name: deserialized.name,
    symbol: deserialized.symbol,
    uri: deserialized.uri,
    decimals: deserialized.decimals,
    collateralCurrency: deserialized.collateralCurrency,
    amount: BigInt(deserialized.amount.toString()),
    curveType: deserialized.curveType,
    migrationTarget: deserialized.migrationTarget,
  };
};

interface iConfig {
  migrationAuthority: Buffer;
  backendAuthority: Buffer;
  configAuthority: Buffer;
  helioFee: Buffer;
  dexFee: Buffer;
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

class ConfigStruct implements iConfig {
  migrationAuthority!: Buffer;
  backendAuthority!: Buffer;
  configAuthority!: Buffer;
  helioFee!: Buffer;
  dexFee!: Buffer;
  feeBps!: number;
  dexFeeShare!: number;
  migrationFee!: bigint;
  marketcapThreshold!: bigint;
  marketcapCurrency!: number;
  minSupportedDecimalPlaces!: number;
  maxSupportedDecimalPlaces!: number;
  minSupportedTokenSupply!: bigint;
  maxSupportedTokenSupply!: bigint;
  coefB!: number;

  constructor(fields: iConfig) {
    Object.assign(this, fields);
  }
}

const ConfigSchema = new Map<any, any>([
  [
    ConfigStruct,
    {
      kind: "struct",
      fields: [
        ["migrationAuthority", "publicKey"],
        ["backendAuthority", "publicKey"],
        ["configAuthority", "publicKey"],
        ["helioFee", "publicKey"],
        ["dexFee", "publicKey"],
        ["feeBps", "u16"],
        ["dexFeeShare", "u8"],
        ["migrationFee", "u64"],
        ["marketcapThreshold", "u64"],
        ["marketcapCurrency", "u8"],
        ["minSupportedDecimalPlaces", "u8"],
        ["maxSupportedDecimalPlaces", "u8"],
        ["minSupportedTokenSupply", "u64"],
        ["maxSupportedTokenSupply", "u64"],
        ["coefB", "u32"],
      ],
    },
  ],
]);

export const decodeConfig = (decodedData: Uint8Array): MoonshotConfigValues => {
  const deserialized = borsh.deserialize(
    ConfigSchema,
    ConfigStruct,
    Buffer.from(decodedData.slice(8)),
  );

  return {
    migrationAuthority: new PublicKey(
      Uint8Array.from(deserialized.migrationAuthority),
    ),
    backendAuthority: new PublicKey(
      Uint8Array.from(deserialized.backendAuthority),
    ),
    configAuthority: new PublicKey(
      Uint8Array.from(deserialized.configAuthority),
    ),
    helioFee: new PublicKey(Uint8Array.from(deserialized.helioFee)),
    dexFee: new PublicKey(Uint8Array.from(deserialized.dexFee)),
    feeBps: deserialized.feeBps,
    dexFeeShare: deserialized.dexFeeShare,
    migrationFee: BigInt(deserialized.migrationFee.toString()),
    marketcapThreshold: BigInt(deserialized.marketcapThreshold.toString()),
    marketcapCurrency: deserialized.marketcapCurrency,
    minSupportedDecimalPlaces: deserialized.minSupportedDecimalPlaces,
    maxSupportedDecimalPlaces: deserialized.maxSupportedDecimalPlaces,
    minSupportedTokenSupply: BigInt(
      deserialized.minSupportedTokenSupply.toString(),
    ),
    maxSupportedTokenSupply: BigInt(
      deserialized.maxSupportedTokenSupply.toString(),
    ),
    coefB: deserialized.coefB,
  };
};
