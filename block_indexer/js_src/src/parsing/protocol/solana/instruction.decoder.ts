import { u64 } from "@solana/buffer-layout-utils";
import { u8, struct, u32 } from "@solana/buffer-layout";
import {
  ISplInstructionValues,
  ISystemInstructionValues,
  SplTransferCheckedValues,
  SplTransferValues,
  SystemTransferValues,
} from "./instruction-data";

// SPL

export const SplTransferLayout = struct<SplTransferValues>([
  u8("discriminator"),
  u64("amount"),
]);

export const SplTransferCheckedLayout = struct<SplTransferCheckedValues>([
  u8("discriminator"),
  u64("amount"),
  u8("decimals"),
]);

export const decodeSplProgramTransfer = (
  decodedData: Uint8Array,
): ISplInstructionValues | undefined => {
  return SplTransferLayout.decode(Buffer.from(decodedData));
};

export const decodeSplProgramTransferChecked = (
  decodedData: Uint8Array,
): ISplInstructionValues => {
  return SplTransferCheckedLayout.decode(Buffer.from(decodedData));
};

// System

export const SystemTransferLayout = struct<SystemTransferValues>([
  u32("instruction"),
  u64("lamports"),
]);

export const decodeSystemProgramTransfer = (
  decodedData: Uint8Array,
): ISystemInstructionValues | undefined => {
  return SystemTransferLayout.decode(Buffer.from(decodedData));
};
