import { Client } from "pg";
import { IndexerEventSource } from "../../../event";
import { dbQueryWithValues } from "../../wrapper";

interface IMintData {
  mint: string;
  bondingCurve: string;
  developer: string;
  protocol: IndexerEventSource;
}

const mintsCache: Map<string, IMintData> = new Map();
const mintsNotFoundCache: Map<string, boolean> = new Map();

export async function getMintData(
  client: Client,
  mints: string[],
): Promise<IMintData[]> {
  console.log(`Getting mint data for ${mints.length} mints`);

  //
  // pump.fun search
  //
  const mintsToSearchInPump = mints.filter(
    (mint) => !mintsCache.has(mint) && !mintsNotFoundCache.has(mint),
  );

  console.log(`Mint to search in pump.fun: ${mintsToSearchInPump.length}`);

  const placeholdersForPump = mintsToSearchInPump
    .map((_, index) => `$${index + 1}`)
    .join(",");

  const pumpMintDataQuery = await dbQueryWithValues(
    client,
    `SELECT mint, bonding_curve, user_public_key FROM pump_data WHERE mint IN (${placeholdersForPump})`,
    mintsToSearchInPump,
  );

  console.log(`Found ${pumpMintDataQuery.rows.length} mints in pump.fun`);

  pumpMintDataQuery.rows.forEach((row: any) => {
    mintsCache.set(row.mint, {
      mint: row.mint,
      bondingCurve: row.bonding_curve,
      developer: row.user_public_key,
      protocol: IndexerEventSource.Pumpfun,
    });
  });

  //
  // moonshot search
  //

  const mintsToSearchInMoonshot = mints.filter(
    (mint) => !mintsCache.has(mint) && !mintsNotFoundCache.has(mint),
  );

  console.log(`Mint to search in moonshot: ${mintsToSearchInMoonshot.length}`);

  const placeholdersForMoonshot = mintsToSearchInMoonshot
    .map((_, index) => `$${index + 1}`)
    .join(",");

  const moonshotMintDataQuery = await dbQueryWithValues(
    client,
    `SELECT mint, curve_account, sender FROM moonshot_data WHERE mint IN (${placeholdersForMoonshot})`,
    mintsToSearchInMoonshot,
  );

  console.log(`Found ${moonshotMintDataQuery.rows.length} mints in moonshot`);

  moonshotMintDataQuery.rows.forEach((row: any) => {
    mintsCache.set(row.mint, {
      mint: row.mint,
      bondingCurve: row.curve_account,
      developer: row.sender,
      protocol: IndexerEventSource.Moonshot,
    });
  });

  const mintsNotFound = mints.filter((mint) => !mintsCache.has(mint));

  mintsNotFound.forEach((mint) => {
    mintsNotFoundCache.set(mint, true);
  });

  console.log(`Mints not found cache has ${mintsNotFoundCache.size} mints`);

  console.log(`Mint cache has ${mintsCache.size} mints in total`);

  return mints
    .filter((mint) => mintsCache.has(mint))
    .map((mint) => mintsCache.get(mint) as IMintData);
}
