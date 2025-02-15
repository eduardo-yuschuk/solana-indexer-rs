import bs58 from "bs58";
import {
  PumpfunInstructionData,
  PumpfunInstructionDiscriminator,
  PumpfunInstructionType,
} from "./instruction-data";
import { decodeBuy, decodeSell } from "./trade.decoder";
import { decodeCreate } from "./create.decoder";

// TODO use borsh
export const u64BytesToBigInt = (bytes: Uint8Array, offset: number): bigint => {
  if (bytes.length < offset + 8) {
    return BigInt(-1);
  }
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

export enum EventDiscriminator {
  CreateEvent = "1b72a94ddeeb6376",
  TradeEvent = "bddb7fd34ee661ee",
  CompleteEvent = "5f72619cd42e9808",
  SetParamsEvent = "dfc39ff63e308f83",
}

export enum EventType {
  CreateEvent = "CreateEvent",
  TradeEvent = "TradeEvent",
  CompleteEvent = "CompleteEvent",
  SetParamsEvent = "SetParamsEvent",
}

export function eventTypeFromDiscriminator(
  discriminator: string,
): EventType | undefined {
  switch (discriminator) {
    case EventDiscriminator.CreateEvent:
      return EventType.CreateEvent;
    case EventDiscriminator.TradeEvent:
      return EventType.TradeEvent;
    case EventDiscriminator.CompleteEvent:
      return EventType.CompleteEvent;
    case EventDiscriminator.SetParamsEvent:
      return EventType.SetParamsEvent;
    default:
      return undefined;
  }
}

export const decodeInstructionData = (
  data: string | Buffer,
): PumpfunInstructionData => {
  const decodedData =
    data instanceof Buffer ? data : bs58.decode(data as string);

  const discriminator = u64BytesToBigInt(decodedData, 0);

  switch (discriminator.toString()) {
    case PumpfunInstructionDiscriminator.Initialize: {
      return {
        instructionType: PumpfunInstructionType.Initialize,
        instructionValues: undefined,
      };
    }
    case PumpfunInstructionDiscriminator.SetParams: {
      return {
        instructionType: PumpfunInstructionType.SetParams,
        instructionValues: undefined,
      };
    }
    case PumpfunInstructionDiscriminator.Create: {
      try {
        const decodedTokenMint = decodeCreate(decodedData);
        return {
          instructionType: PumpfunInstructionType.Create,
          instructionValues: decodedTokenMint,
        };
      } catch (e) {
        return {
          instructionType: PumpfunInstructionType.Create,
          instructionValues: {
            error: e,
            malformedData: true,
          },
        };
      }
    }
    case PumpfunInstructionDiscriminator.Buy: {
      try {
        const decodedBuy = decodeBuy(decodedData);
        return {
          instructionType: PumpfunInstructionType.Buy,
          instructionValues: decodedBuy,
        };
      } catch (e) {
        return {
          instructionType: PumpfunInstructionType.Buy,
          instructionValues: {
            error: e,
            malformedData: true,
          },
        };
      }
    }
    case PumpfunInstructionDiscriminator.Sell: {
      try {
        const decodedSell = decodeSell(decodedData);
        return {
          instructionType: PumpfunInstructionType.Sell,
          instructionValues: decodedSell,
        };
      } catch (e) {
        return {
          instructionType: PumpfunInstructionType.Sell,
          instructionValues: {
            error: e,
            malformedData: true,
          },
        };
      }
    }
    case PumpfunInstructionDiscriminator.Withdraw: {
      return {
        instructionType: PumpfunInstructionType.Withdraw,
        instructionValues: undefined,
      };
    }
    default: {
      return {
        instructionType: PumpfunInstructionType.Unknown,
        instructionValues: undefined,
      };
    }
  }
};
