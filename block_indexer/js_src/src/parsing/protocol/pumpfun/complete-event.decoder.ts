import { publicKey } from "@solana/buffer-layout-utils";
import { ns64, struct } from "@solana/buffer-layout";
import { PumpfunCompleteEventValues } from "./instruction-data";

export const CompleteEventLayout = struct<PumpfunCompleteEventValues>([
  publicKey("user"),
  publicKey("mint"),
  publicKey("bondingCurve"),
  ns64("timestamp"),
]);

export const decodeCompleteEvent = (
  decodedData: Uint8Array,
): PumpfunCompleteEventValues => {
  return CompleteEventLayout.decode(Buffer.from(decodedData.slice(8)));
};
