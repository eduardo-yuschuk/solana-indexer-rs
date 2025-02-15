import bs58 from "bs58";
import { RaydiumPoolV4Discriminator } from "./raydium.parser";
import {
  decodeAdminCancelOrders,
  decodeCreateConfigAccount,
  decodeDeposit,
  decodeInitialize,
  decodeInitialize2,
  decodeMigrateToOpenBook,
  decodeMonitorStep,
  decodePreInitialize,
  decodeSetParams,
  decodeSimulateInfo,
  decodeSwapBaseIn,
  decodeSwapBaseOut,
  decodeUpdateConfigAccount,
  decodeWithdraw,
  decodeWithdrawPnl,
  decodeWithdrawSrm,
} from "./instruction.decoder";
import {
  RaydiumInstructionData,
  RaydiumInstructionType,
} from "./instruction-data";

export const decodeInstructionData = (
  data: string | Buffer,
): RaydiumInstructionData => {
  const decodedData =
    data instanceof Buffer ? data : bs58.decode(data as string);

  const discriminator = Number(decodedData[0]);
  switch (discriminator) {
    case RaydiumPoolV4Discriminator.Initialize: {
      return {
        instructionType: RaydiumInstructionType.Initialize,
        instructionValues: decodeInitialize(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.Initialize2: {
      return {
        instructionType: RaydiumInstructionType.Initialize2,
        instructionValues: decodeInitialize2(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.MonitorStep: {
      return {
        instructionType: RaydiumInstructionType.MonitorStep,
        instructionValues: decodeMonitorStep(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.Deposit: {
      return {
        instructionType: RaydiumInstructionType.Deposit,
        instructionValues: decodeDeposit(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.Withdraw: {
      return {
        instructionType: RaydiumInstructionType.Withdraw,
        instructionValues: decodeWithdraw(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.MigrateToOpenBook: {
      return {
        instructionType: RaydiumInstructionType.MigrateToOpenBook,
        instructionValues: decodeMigrateToOpenBook(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.SetParams: {
      return {
        instructionType: RaydiumInstructionType.SetParams,
        instructionValues: decodeSetParams(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.WithdrawPnl: {
      return {
        instructionType: RaydiumInstructionType.WithdrawPnl,
        instructionValues: decodeWithdrawPnl(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.WithdrawSrm: {
      return {
        instructionType: RaydiumInstructionType.WithdrawSrm,
        instructionValues: decodeWithdrawSrm(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.SwapBaseIn: {
      return {
        instructionType: RaydiumInstructionType.SwapBaseIn,
        instructionValues: decodeSwapBaseIn(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.PreInitialize: {
      return {
        instructionType: RaydiumInstructionType.PreInitialize,
        instructionValues: decodePreInitialize(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.SwapBaseOut: {
      return {
        instructionType: RaydiumInstructionType.SwapBaseOut,
        instructionValues: decodeSwapBaseOut(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.SimulateInfo: {
      return {
        instructionType: RaydiumInstructionType.SimulateInfo,
        instructionValues: decodeSimulateInfo(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.AdminCancelOrders: {
      return {
        instructionType: RaydiumInstructionType.AdminCancelOrders,
        instructionValues: decodeAdminCancelOrders(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.CreateConfigAccount: {
      return {
        instructionType: RaydiumInstructionType.CreateConfigAccount,
        instructionValues: decodeCreateConfigAccount(decodedData),
      };
    }
    case RaydiumPoolV4Discriminator.UpdateConfigAccount: {
      return {
        instructionType: RaydiumInstructionType.UpdateConfigAccount,
        instructionValues: decodeUpdateConfigAccount(decodedData),
      };
    }
    default: {
      return {
        instructionType: RaydiumInstructionType.Unknown,
        instructionValues: undefined,
      };
    }
  }
};
