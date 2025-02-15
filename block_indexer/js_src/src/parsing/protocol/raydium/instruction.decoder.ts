import { u64 } from "@solana/buffer-layout-utils";
import { u8, struct } from "@solana/buffer-layout";
import {
  IRaydiumInstructionValues,
  RaydiumInitialize2Values,
  RaydiumSwapBaseInValues,
  RaydiumSwapBaseOutValues,
} from "./instruction-data";

// discriminator: u8
// nonce: u8
// openTime: u64
// initPcAmount: u64
// initCoinAmount: u64

export const Initialize2Layout = struct<RaydiumInitialize2Values>([
  u8("discriminator"),
  u8("nonce"),
  u64("openTime"),
  u64("initPcAmount"),
  u64("initCoinAmount"),
]);

export const SwapBaseInLayout = struct<RaydiumSwapBaseInValues>([
  u8("discriminator"),
  u64("amountIn"),
  u64("minimumAmountOut"),
]);

export const SwapBaseOutLayout = struct<RaydiumSwapBaseOutValues>([
  u8("discriminator"),
  u64("maxAmountIn"),
  u64("amountOut"),
]);

export const decodeInitialize = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeInitialize2 = (
  decodedData: Uint8Array,
): IRaydiumInstructionValues => {
  return Initialize2Layout.decode(Buffer.from(decodedData));
};

export const decodeMonitorStep = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeDeposit = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeWithdraw = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeMigrateToOpenBook = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeSetParams = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeWithdrawPnl = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeWithdrawSrm = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeSwapBaseIn = (
  decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return SwapBaseInLayout.decode(Buffer.from(decodedData));
};

export const decodePreInitialize = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeSwapBaseOut = (
  decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return SwapBaseOutLayout.decode(Buffer.from(decodedData));
};

export const decodeSimulateInfo = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeAdminCancelOrders = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeCreateConfigAccount = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};

export const decodeUpdateConfigAccount = (
  _decodedData: Uint8Array,
): IRaydiumInstructionValues | undefined => {
  return undefined;
};
