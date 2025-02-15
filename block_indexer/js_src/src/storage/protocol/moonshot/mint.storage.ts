import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { dbQueryWithValues } from "../../wrapper";

const cleanString = (str: string): string => str.replace(/\0/g, "");

export async function saveMintEvents(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (mintEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(mintEvents);

  const { blockTime, slot } = blockData;

  const insertQuery = `
      INSERT INTO moonshot_data (
          mint, 
          name, 
          symbol, 
          uri, 
          curve_account, 
          sender, 
          amount, 
          collateral_currency, 
          curve_type, 
          decimals, 
          migration_target, 
          created,
          create_event_slot
      ) VALUES
      ${mintEvents
        .map(
          (_, index) =>
            `($${index * 13 + 1}, $${index * 13 + 2}, $${index * 13 + 3}, $${index * 13 + 4}, $${index * 13 + 5}, $${index * 13 + 6}, $${index * 13 + 7}, $${index * 13 + 8}, $${index * 13 + 9}, $${index * 13 + 10}, $${index * 13 + 11}, $${index * 13 + 12}, $${index * 13 + 13})`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO NOTHING;
    `;

  // TODO: ON CONFLICT (mint) update the fields (because the re-indexing of old blocks when new blocks with prices are indexed)

  const values = mintEvents.flatMap((event) => {
    const { eventObj, eventMeta } = event;
    const { instructionValues } = eventObj;

    return [
      eventMeta.mint,
      cleanString(instructionValues.name),
      cleanString(instructionValues.symbol),
      instructionValues.uri,
      eventMeta.curveAccount,
      eventMeta.sender,
      instructionValues.amount,
      instructionValues.collateralCurrency,
      instructionValues.curveType,
      instructionValues.decimals,
      instructionValues.migrationTarget,
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
    console.error("Error inserting moonshot_data:", err);
    throw err;
  }

  return { rowsCount };
}
