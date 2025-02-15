import dotenv from "dotenv";
import * as fs from "fs";
import { Client } from "pg";
import { exit } from "node:process";
import { sleep } from "../util";
import { dbQuery, dbQueryWithValues } from "../storage/wrapper";

dotenv.config();

const indexerDbClient = new Client({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
  ssl:
    process.env.DB_DISABLE_SSL == "true"
      ? undefined
      : {
          ca: fs.readFileSync("aws/rds-global-bundle.pem").toString(),
        },
});

indexerDbClient
  .connect()
  .then(() => {
    console.log("Verifier, connected to DB");
  })
  .catch((err) => {
    console.error("Verifier, connection error", err.stack);
    exit(1);
  });

export async function runArchiver() {
  if (process.env.RUN_ARCHIVER) {
    while (true) {
      await archiveData(indexerDbClient);
      await sleep(1000);
    }
  }
}

async function getTokensToArchive(client: Client): Promise<string[]> {
  const query = `
    SELECT mint
    FROM public.pump_data
    where 
    updated < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 day')
      and archived is false;
  `;

  try {
    const result = await dbQuery(client, query);
    return result.rows.map((row: any) => row.mint);
  } catch (err) {
    console.error("Verifier, error fetching tokens to archive: ", err);
    return [];
  }
}

async function archiveToken(token: string, indexerDbClient: Client) {
  try {
    await dbQuery(indexerDbClient, "BEGIN");
  } catch (err) {
    console.error(err);
    throw err;
  }

  console.log("Archiving token", token);

  await deleteTokenBars(token, indexerDbClient);
  await markTokenAsArchived(token, indexerDbClient);

  try {
    await dbQuery(indexerDbClient, "COMMIT");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function archiveData(indexerDbClient: Client) {
  console.log("Archiving data");

  const tokensToArchive = await getTokensToArchive(indexerDbClient);

  for (const token of tokensToArchive) {
    await archiveToken(token, indexerDbClient);
  }
}

async function deleteTokenBars(token: string, indexerDbClient: Client) {
  const query = `DELETE FROM public.pump_price_bars WHERE mint = $1 and timeframe != 1 and timeframe != 60`;
  await dbQueryWithValues(indexerDbClient, query, [token]);
}

async function markTokenAsArchived(token: string, indexerDbClient: Client) {
  const query = `UPDATE public.pump_data SET archived = true WHERE mint = $1`;
  await dbQueryWithValues(indexerDbClient, query, [token]);
}
