import { u64 } from "@solana/buffer-layout-utils";
import { struct } from "@solana/buffer-layout";
import { PumpfunBuyValues, PumpfunSellValues } from "./instruction-data";

export const BuyLayout = struct<PumpfunBuyValues>([
  u64("amount"),
  u64("maxSolCost"),
]);

export const decodeBuy = (decodedData: Uint8Array): PumpfunBuyValues => {
  return BuyLayout.decode(Buffer.from(decodedData.slice(8)));
};

export const SellLayout = struct<PumpfunSellValues>([
  u64("amount"),
  u64("minSolOutput"),
]);

export const decodeSell = (decodedData: Uint8Array): PumpfunSellValues => {
  return SellLayout.decode(Buffer.from(decodedData.slice(8)));
};
