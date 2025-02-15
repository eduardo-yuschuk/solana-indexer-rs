import { bool, publicKey, u64 } from "@solana/buffer-layout-utils";
import { struct, ns64 } from "@solana/buffer-layout";
import { PumpfunTradeEventValues } from "./instruction-data";

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

export const TradeEventLayout = struct<PumpfunTradeEventValues>([
  publicKey("mint"),
  u64("solAmount"),
  u64("tokenAmount"),
  bool("isBuy"),
  publicKey("user"),
  ns64("timestamp"),
  u64("virtualSolReserves"),
  u64("virtualTokenReserves"),
  u64("realSolReserves"),
  u64("realTokenReserves"),
]);

export const decodeTradeEvent = (
  decodedData: Uint8Array,
): PumpfunTradeEventValues => {
  return TradeEventLayout.decode(Buffer.from(decodedData.slice(8)));
};
