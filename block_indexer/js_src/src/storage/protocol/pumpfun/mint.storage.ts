import { GenericEventType } from "../../../event";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

const cleanString = (str: string): string => str.replace(/\0/g, "");

async function saveTokens(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (mintEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(mintEvents);

  const { blockTime, slot } = blockData;

  const insertQuery = `
    INSERT INTO pump_data (
        mint, name, symbol, uri, bonding_curve, user_public_key, created, create_event_slot
    ) VALUES
    ${mintEvents
      .map(
        (_, index) =>
          `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`,
      )
      .join(", ")}
    ON CONFLICT (mint) DO UPDATE
    SET 
      name = EXCLUDED.name, 
      symbol = EXCLUDED.symbol, 
      uri = EXCLUDED.uri, 
      bonding_curve = EXCLUDED.bonding_curve, 
      user_public_key = EXCLUDED.user_public_key, 
      created = EXCLUDED.created,
      create_event_slot = EXCLUDED.create_event_slot;
  `;

  const values = mintEvents
    .filter((event) => event.type == GenericEventType.Mint)
    .flatMap((event) => {
      const { eventObj } = event;
      let { decodedMint } = eventObj;
      if (decodedMint == undefined) {
        // is a MintEvent (readed from logs)
        decodedMint = eventObj;
      }

      return [
        decodedMint.mint.toBase58(),
        cleanString(decodedMint.name),
        cleanString(decodedMint.symbol),
        cleanString(decodedMint.uri),
        decodedMint.bondingCurve.toBase58(),
        decodedMint.user.toBase58(),
        blockTime,
        slot,
      ];
    });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting pump_data:", err);
    throw err;
  }

  return { rowsCount };
}

export async function saveMintEvents(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (mintEvents.length === 0) return { rowsCount: 0 };

  let rowsCount = 0;

  rowsCount += (await saveTokens(client, mintEvents, blockData)).rowsCount;

  return { rowsCount };
}
