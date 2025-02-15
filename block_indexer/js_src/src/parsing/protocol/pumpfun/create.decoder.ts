import * as borsh from "borsh";
import { PumpfunCreateValues } from "./instruction-data";

// name: string
// symbol: string
// uri: string

interface iCreate {
  name: string;
  symbol: string;
  uri: string;
}

class CreateStruct implements iCreate {
  name!: string;
  symbol!: string;
  uri!: string;

  constructor(fields: iCreate) {
    Object.assign(this, fields);
  }
}

const CreateSchema = new Map<any, any>([
  [
    CreateStruct,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
      ],
    },
  ],
]);

// TODO the implementation is different because I couldn't get @solana/buffer-layout to work with utf8

export const decodeCreate = (decodedData: Uint8Array): PumpfunCreateValues => {
  // deserialization without the lengths check (malfomed data could cause a failure using borsh.deserialize)
  const deserialized = borsh.deserializeUnchecked(
    CreateSchema,
    CreateStruct,
    Buffer.from(decodedData.slice(8)),
  );

  return {
    name: deserialized.name,
    symbol: deserialized.symbol,
    uri: deserialized.uri,
  };
};
