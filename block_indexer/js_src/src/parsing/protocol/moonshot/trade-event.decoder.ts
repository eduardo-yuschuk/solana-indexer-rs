import { publicKey, u64 } from "@solana/buffer-layout-utils";
import { u8, struct, cstr } from "@solana/buffer-layout";
import { MoonshotTradeEventValues } from "./instruction-data";

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

export const TradeEventLayout = struct<MoonshotTradeEventValues>([
  u64("amount"),
  u64("collateralAmount"),
  u64("dexFee"),
  u64("helioFee"),
  u64("allocation"),
  publicKey("curve"),
  publicKey("costToken"),
  publicKey("sender"),
  u8("type"),
  cstr("label"),
]);

export const decodeTradeEvent = (
  decodedData: Uint8Array,
): MoonshotTradeEventValues => {
  return TradeEventLayout.decode(Buffer.from(decodedData.slice(8)));
};
