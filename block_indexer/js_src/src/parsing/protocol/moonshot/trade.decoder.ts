import { u64 } from "@solana/buffer-layout-utils";
import { u8, struct } from "@solana/buffer-layout";
import { MoonshotTradeValues } from "./instruction-data";

// tokenAmount: u64
// collateralAmount: u64
// fixedSide: u8
// slippageBps: u64

export const TradeLayout = struct<MoonshotTradeValues>([
  u64("tokenAmount"),
  u64("collateralAmount"),
  u8("fixedSide"),
  u64("slippageBps"),
]);

export const decodeTrade = (decodedData: Uint8Array): MoonshotTradeValues => {
  return TradeLayout.decode(Buffer.from(decodedData.slice(8)));
};
