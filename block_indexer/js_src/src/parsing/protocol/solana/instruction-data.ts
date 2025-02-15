export interface IInstructionValues {}

// Spl

export enum SplInstructionType {
  Transfer = "Transfer",
  TransferChecked = "TransferChecked",
  Unknown = "Unknown",
}

export interface SplInstructionData {
  instructionType: SplInstructionType;
  instructionValues: ISplInstructionValues | undefined;
}

export interface ISplInstructionValues extends IInstructionValues {}

export interface SplTransferValues extends ISplInstructionValues {
  discriminator: number;
  amount: bigint;
}

export interface SplTransferCheckedValues extends ISplInstructionValues {
  discriminator: number;
  amount: bigint;
  decimals: number;
}

// System

export enum SystemInstructionType {
  Transfer = "Transfer",
  Unknown = "Unknown",
}

export interface SystemInstructionData {
  instructionType: SystemInstructionType;
  instructionValues: ISystemInstructionValues | undefined;
}

export interface ISystemInstructionValues extends IInstructionValues {}

export interface SystemTransferValues extends ISystemInstructionValues {
  instruction: number;
  lamports: bigint;
}
