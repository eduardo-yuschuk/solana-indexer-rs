import bs58 from "bs58";
import {
  MoonshotInstructionData,
  MoonshotInstructionDiscriminator,
  MoonshotInstructionType,
} from "./instruction-data";
import { decodeConfig, decodeTokenMint } from "./token-mint.decoder";
import { decodeTrade } from "./trade.decoder";

// TODO use borsh
const u64BytesToBigInt = (bytes: Uint8Array, offset: number): bigint => {
  return BigInt.asUintN(
    64,
    (BigInt(bytes[offset + 7]) << 56n) |
      (BigInt(bytes[offset + 6]) << 48n) |
      (BigInt(bytes[offset + 5]) << 40n) |
      (BigInt(bytes[offset + 4]) << 32n) |
      (BigInt(bytes[offset + 3]) << 24n) |
      (BigInt(bytes[offset + 2]) << 16n) |
      (BigInt(bytes[offset + 1]) << 8n) |
      BigInt(bytes[offset + 0]),
  );
};

export const decodeInstructionData = (
  data: string | Buffer,
): MoonshotInstructionData => {
  const decodedData =
    data instanceof Buffer ? data : bs58.decode(data as string);

  const discriminator = u64BytesToBigInt(decodedData, 0);
  switch (discriminator.toString()) {
    case MoonshotInstructionDiscriminator.Buy: {
      const decodedTrade = decodeTrade(decodedData);
      return {
        instructionType: MoonshotInstructionType.Buy,
        instructionValues: decodedTrade,
      };
    }
    case MoonshotInstructionDiscriminator.Sell: {
      const decodedTrade = decodeTrade(decodedData);
      return {
        instructionType: MoonshotInstructionType.Sell,
        instructionValues: decodedTrade,
      };
    }
    case MoonshotInstructionDiscriminator.TokenMint: {
      const decodedTokenMint = decodeTokenMint(decodedData);
      return {
        instructionType: MoonshotInstructionType.TokenMint,
        instructionValues: decodedTokenMint,
      };
    }
    case MoonshotInstructionDiscriminator.ConfigInit: {
      const decodedConfig = decodeConfig(decodedData);
      return {
        instructionType: MoonshotInstructionType.ConfigInit,
        instructionValues: decodedConfig,
      };
    }
    case MoonshotInstructionDiscriminator.ConfigUpdate: {
      const decodedConfig = decodeConfig(decodedData);
      return {
        instructionType: MoonshotInstructionType.ConfigUpdate,
        instructionValues: decodedConfig,
      };
    }
    default: {
      return {
        instructionType: MoonshotInstructionType.Unknown,
        instructionValues: undefined,
      };
    }
  }
};
