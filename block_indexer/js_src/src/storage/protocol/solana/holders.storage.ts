import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
  stringifyObj,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { consolidateSplTokenBalanceChangeEvents } from "./consolidation";
import { dbQueryWithValues } from "../../wrapper";

export async function saveSplTokenHolders(
  client: Client,
  _backendClient: Client,
  filteredSplTokenBalanceChangeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (filteredSplTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(filteredSplTokenBalanceChangeEvents);

  const { blockTime } = blockData;

  const consolidatedSplTokenBalanceChangeEvents =
    consolidateSplTokenBalanceChangeEvents(filteredSplTokenBalanceChangeEvents);

  const insertQuery = `
      INSERT INTO holders (
          wallet,
          mint,
          decimals,
          is_bonding_curve,
          is_developer,
          token_amount,
          updated
      ) VALUES
      ${consolidatedSplTokenBalanceChangeEvents
        .map(
          (_, index) =>
            `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`,
        )
        .join(", ")}
      ON CONFLICT (wallet, mint)
      DO UPDATE SET
          token_amount = EXCLUDED.token_amount + holders.token_amount,
          is_bonding_curve = EXCLUDED.is_bonding_curve,
          is_developer = EXCLUDED.is_developer,
          updated = EXCLUDED.updated;
    `;

  const values = consolidatedSplTokenBalanceChangeEvents.flatMap((event) => {
    const {
      wallet,
      mint,
      tokenAccount: _tokenAccount,
      decimals,
      oldAmount: _oldAmount,
      newAmount,
      isBondingCurve,
      isDeveloper,
    } = event;
    return [
      wallet,
      mint,
      decimals,
      isBondingCurve,
      isDeveloper,
      newAmount,
      blockTime,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating holders:", err);
    throw err;
  }

  return { rowsCount };
}

const TOP_HOLDERS_COUNT = 50;

export interface IPumpfunHoldersValues {
  wallet: string;
  tokenAmount: bigint;
  decimals: number;
  isBondingCurve: boolean;
  isDeveloper: boolean;
}

export async function saveSplTokenHoldersJsonb(
  client: Client,
  _backendClient: Client,
  filteredSplTokenBalanceChangeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (filteredSplTokenBalanceChangeEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(filteredSplTokenBalanceChangeEvents);

  const { blockTime } = blockData;

  const consolidatedSplTokenBalanceChangeEvents =
    consolidateSplTokenBalanceChangeEvents(filteredSplTokenBalanceChangeEvents);

  const eventsMints = [
    ...new Set(
      consolidatedSplTokenBalanceChangeEvents.map((event) => event.mint),
    ),
  ];

  // read current holders from db

  const placeholders = eventsMints.map((_, i) => `$${i + 1}`).join(",");

  const mintsQuery = `SELECT mint, holders FROM holders_jsonb WHERE mint IN (${placeholders});`;

  const mintToHoldersMap: { [mint: string]: IPumpfunHoldersValues[] } = {};

  try {
    const result = await dbQueryWithValues(client, mintsQuery, eventsMints);
    for (const row of result.rows) {
      mintToHoldersMap[row.mint] = row.holders;
    }
  } catch (err) {
    console.error("Error fetching holders_jsonb: ", err);
    throw err;
  }

  // merge the new holders with the current ones

  for (const event of consolidatedSplTokenBalanceChangeEvents) {
    const {
      wallet,
      mint,
      oldAmount: _oldAmount,
      newAmount,
      decimals,
      isBondingCurve,
      isDeveloper,
    } = event;
    const holders = mintToHoldersMap[mint];
    if (holders) {
      const holder = holders.find((h) => h.wallet === wallet);
      if (holder) {
        // update holder
        holder.tokenAmount = newAmount;
        holder.decimals = decimals;
        holder.isBondingCurve = isBondingCurve ?? false;
        holder.isDeveloper = isDeveloper ?? false;
      } else {
        // add new holder
        holders.push({
          wallet,
          tokenAmount: newAmount,
          decimals,
          isBondingCurve: isBondingCurve ?? false,
          isDeveloper: isDeveloper ?? false,
        });
      }
    } else {
      // first holder
      mintToHoldersMap[mint] = [
        {
          wallet,
          tokenAmount: newAmount,
          decimals,
          isBondingCurve: isBondingCurve ?? false,
          isDeveloper: isDeveloper ?? false,
        },
      ];
    }
  }

  // update the db

  const insertQuery = `
      INSERT INTO holders_jsonb (
        mint,
        holders,
        updated
      ) VALUES
      ${eventsMints
        .map(
          (_, index) =>
            `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
        )
        .join(", ")}
      ON CONFLICT (mint) DO UPDATE SET holders = EXCLUDED.holders, updated = EXCLUDED.updated;
    `;

  const values = Object.keys(mintToHoldersMap).flatMap((mint) => {
    const holders = mintToHoldersMap[mint];
    // sort holders by token amount in descending order
    // (tokenAmount can be a bigint or a string depending on whether it is an already stored holder or a new one)
    holders.sort((a, b) =>
      b.tokenAmount.toString().localeCompare(a.tokenAmount.toString()),
    );
    const topHolders = holders.slice(0, TOP_HOLDERS_COUNT);
    return [mint, stringifyObj(topHolders), blockTime];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating holders_jsonb:", err);
    throw err;
  }

  return { rowsCount };
}
