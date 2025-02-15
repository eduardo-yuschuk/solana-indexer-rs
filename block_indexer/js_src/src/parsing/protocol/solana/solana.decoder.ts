import bs58 from "bs58";
import {
  SplInstructionData,
  SplInstructionType,
  SystemInstructionData,
  SystemInstructionType,
} from "./instruction-data";
import {
  decodeSplProgramTransfer,
  decodeSplProgramTransferChecked,
  decodeSystemProgramTransfer,
} from "./instruction.decoder";

export enum SplDiscriminator {
  Transfer = 3,
  TransferChecked = 12,
}

export const decodeSplProgramInstructionData = (
  data: string | Buffer,
): SplInstructionData => {
  const decodedData =
    data instanceof Buffer ? data : bs58.decode(data as string);

  const discriminator = Number(decodedData[0]);
  switch (discriminator) {
    case SplDiscriminator.Transfer: {
      return {
        instructionType: SplInstructionType.Transfer,
        instructionValues: decodeSplProgramTransfer(decodedData),
      };
    }
    case SplDiscriminator.TransferChecked: {
      return {
        instructionType: SplInstructionType.TransferChecked,
        instructionValues: decodeSplProgramTransferChecked(decodedData),
      };
    }
    default: {
      return {
        instructionType: SplInstructionType.Unknown,
        instructionValues: undefined,
      };
    }
  }
};

export enum SystemDiscriminator {
  Create = 0,
  Assign = 1,
  Transfer = 2,
  CreateWithSeed = 3,
  AdvanceNonceAccount = 4,
  WithdrawNonceAccount = 5,
  InitializeNonceAccount = 6,
  AuthorizeNonceAccount = 7,
  Allocate = 8,
  AllocateWithSeed = 9,
  AssignWithSeed = 10,
  TransferWithSeed = 11,
  UpgradeNonceAccount = 12,
}

export const decodeSystemProgramInstructionData = (
  data: string | Buffer,
): SystemInstructionData => {
  const decodedData =
    data instanceof Buffer ? data : bs58.decode(data as string);

  const discriminator = Number(decodedData[0]);
  switch (discriminator) {
    case SystemDiscriminator.Transfer: {
      return {
        instructionType: SystemInstructionType.Transfer,
        instructionValues: decodeSystemProgramTransfer(decodedData),
      };
    }
    default: {
      return {
        instructionType: SystemInstructionType.Unknown,
        instructionValues: undefined,
      };
    }
  }
};
