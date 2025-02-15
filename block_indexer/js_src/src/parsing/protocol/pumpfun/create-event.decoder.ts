import * as borsh from "borsh";
import { PumpfunCreateEventValues } from "./instruction-data";
import { PublicKey } from "@solana/web3.js";

// name: string
// symbol: string
// uri: string
// mint: pubkey
// bondingCurve: pubkey
// user: pubkey

interface iCreateEvent {
  name: string;
  symbol: string;
  uri: string;
  mint: Buffer;
  bondingCurve: Buffer;
  user: Buffer;
}

class CreateEventStruct implements iCreateEvent {
  name!: string;
  symbol!: string;
  uri!: string;
  mint!: Buffer;
  bondingCurve!: Buffer;
  user!: Buffer;

  constructor(fields: iCreateEvent) {
    Object.assign(this, fields);
  }
}

const CreateEventSchema = new Map<any, any>([
  [
    CreateEventStruct,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
        ["mint", [32]],
        ["bondingCurve", [32]],
        ["user", [32]],
      ],
    },
  ],
]);

// TODO the implementation is different because I couldn't get @solana/buffer-layout to work with utf8

export const decodeCreateEvent = (
  decodedData: Uint8Array,
): PumpfunCreateEventValues => {
  const deserialized = borsh.deserialize(
    CreateEventSchema,
    CreateEventStruct,
    Buffer.from(decodedData.slice(8)),
  );

  return {
    name: deserialized.name,
    symbol: deserialized.symbol,
    uri: deserialized.uri,
    mint: new PublicKey(Uint8Array.from(deserialized.mint)),
    bondingCurve: new PublicKey(Uint8Array.from(deserialized.bondingCurve)),
    user: new PublicKey(Uint8Array.from(deserialized.user)),
  };
};
