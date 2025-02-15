import { Client } from "pg";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import { dbQueryWithValues } from "../../wrapper";

export async function filterAndCompleteData(
  client: Client,
  splTokenBalanceChangeEvents: IEvent[],
): Promise<IEvent[]> {
  if (splTokenBalanceChangeEvents.length === 0) return [];

  const mints = splTokenBalanceChangeEvents.map((event) => event.eventObj.mint);

  const uniqueMints = [...new Set(mints)];
  const placeholders = uniqueMints.map((_, i) => `$${i + 1}`).join(",");

  const selectQuery = `
    SELECT mint, curve_account, sender as developer, 'Moonshot' as source
    FROM moonshot_data 
    WHERE mint IN (${placeholders})
    UNION
    SELECT mint, bonding_curve AS curve_account, user_public_key as developer, 'Pumpfun' as source
    FROM pump_data 
    WHERE mint IN (${placeholders});
  `;

  const result = await dbQueryWithValues(client, selectQuery, uniqueMints);
  const validTokensMap: Map<
    string,
    {
      mint: string;
      curveAccount: string;
      developer: string;
      source: string;
    }
  > = new Map();
  result.rows.forEach((row) => {
    validTokensMap.set(row.mint, {
      mint: row.mint,
      curveAccount: row.curve_account,
      developer: row.developer,
      source: row.source,
    });
  });

  const filteredEvents = splTokenBalanceChangeEvents.filter((event) => {
    const anyEvent = event as any;
    const { mint } = anyEvent.eventObj;
    return validTokensMap.has(mint);
  });

  filteredEvents.forEach((event) => {
    const anyEvent = event as any;
    const { mint, owner } = anyEvent.eventObj;
    if (validTokensMap.has(mint)) {
      const { curveAccount, developer, source } = validTokensMap.get(mint) as {
        curveAccount: string;
        developer: string;
        source: string;
      };
      anyEvent.isBondingCurve = curveAccount == owner;
      anyEvent.isDeveloper = developer == owner;
      anyEvent.source = source;
    }
  });

  return filteredEvents;
}
