import dotenv from "dotenv";
import {
  CurveAccount,
  Environment,
  Moonshot,
} from "@wen-moon-ser/moonshot-sdk";
import * as fs from "fs";
import { Client } from "pg";
import { exit } from "node:process";
import { sleep } from "../../../util";
import { getCurvePercentage } from "../../../auxiliar/moonshot";
import { IndexerEventSource } from "../../../event";
import { dbQuery } from "../../../storage/wrapper";

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
    console.log("Moonshot bonding fetcher, connected to indexer DB");
  })
  .catch((err) => {
    console.error(
      "Moonshot bonding fetcher, connection to indexer DB error",
      err,
    );
    exit(1);
  });

const moonshot = new Moonshot({
  rpcUrl: process.env.RPC_URL || "",
  environment: Environment.MAINNET,
  chainOptions: {
    solana: { confirmOptions: { commitment: "confirmed" } },
  },
});

const updateBondingCurves = async (): Promise<void> => {
  const tokensWithoutBondingCurve = await dbQuery(
    indexerDbClient,
    `
    SELECT mint, price 
    FROM moonshot_data 
    WHERE created IS NOT NULL 
      AND (bonding_updated IS NULL OR bonding_updated < updated)
    ORDER BY created DESC LIMIT 1
  `,
  );

  for (const token of tokensWithoutBondingCurve.rows) {
    let curveAccount: CurveAccount | undefined = undefined;

    try {
      const moonshotToken = moonshot.Token({
        mintAddress: token.mint,
      });

      curveAccount = await moonshotToken.getCurveAccount();

      const curvePosition = curveAccount.totalSupply - curveAccount.curveAmount;
      const initialVirtualTokenReserves = 1073000000000000000n;
      const initialVirtualCollateralReserves = 30000000000n;
      const constantProduct =
        initialVirtualTokenReserves * initialVirtualCollateralReserves;
      const currentVirtualTokenReserves =
        initialVirtualTokenReserves - curvePosition;
      const currentVirtualCollateralReserves =
        constantProduct / currentVirtualTokenReserves;
      // const tokenAmount = 1000000000n;
      // const newTokenReserves = currentVirtualTokenReserves - tokenAmount;
      // const ratio = constantProduct / newTokenReserves;
      // const lamportsToSpend = ratio - currentVirtualCollateralReserves;
      // const priceInSol = Number(lamportsToSpend) / Number(1000000000n);
      // const marketcap = priceInSol * Number(1000000000n);

      const priceInSol = Number(token.price);
      const marketcap = priceInSol * Number(1000000000n);
      let percentage = getCurvePercentage(priceInSol);
      const liquidity =
        Number(currentVirtualCollateralReserves) / Number(1000000000n) +
        (Number(currentVirtualTokenReserves) / Number(1000000000n)) *
          priceInSol;

      if (percentage < 0) {
        // console.error(
        //   `Moonshot bonding fetcher, percentage < 0 (${percentage}) for mint: ${token.mint}`,
        // );
        percentage = 0;
      }

      if (percentage > 100) {
        // console.error(
        //   `Moonshot bonding fetcher, percentage > 100 (${percentage}) for mint: ${token.mint}`,
        // );
        percentage = 100;
      }

      await dbQuery(
        indexerDbClient,
        `
        UPDATE moonshot_data 
        SET 
          total_supply = ${curveAccount.totalSupply},
          curve_amount = ${curveAccount.curveAmount},
          marketcap_threshold = ${curveAccount.marketcapThreshold},
          marketcap_currency = ${curveAccount.marketcapCurrency},
          migration_fee = ${curveAccount.migrationFee},
          coef_b = ${curveAccount.coefB},
          bump = ${curveAccount.bump},
          marketcap = ${marketcap}::numeric,
          percentage = ${percentage}::numeric,
          liquidity = ${liquidity}::numeric,
          bonding_updated = ${Math.floor(Date.now() / 1000)}
        WHERE mint = '${token.mint}'
      `,
      );

      if (process.env.VERBOSE) {
        console.log(` Moonshot bonding fetcher, mint: ${token.mint}`);
      }
    } catch (err: any) {
      console.error(
        ` Moonshot bonding fetcher, error updating moonshot_data for mint: ${token.mint}`,
        err.message,
      );
      if (curveAccount === undefined) {
        await dbQuery(
          indexerDbClient,
          `
          UPDATE moonshot_data 
          SET bonding_updated = ${Math.floor(Date.now() / 1000)}
          WHERE mint = '${token.mint}'
        `,
        );
      }
    }
  }
};

export async function runMoonshotBondingFetcher() {
  if (
    process.env.INDEXERS?.includes(IndexerEventSource.Moonshot.toLowerCase())
  ) {
    while (true) {
      await updateBondingCurves();
      await sleep(1000);
    }
  }
}
