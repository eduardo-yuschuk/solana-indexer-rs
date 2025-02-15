import { Client } from "pg";
import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { dbQueryWithValues } from "../../wrapper";

async function filterMintEventsOfProtocolsOfInterest(
  client: Client,
  events: IEvent[],
): Promise<IEvent[]> {
  if (events.length === 0) return [];

  const addresses = events.flatMap((event) => {
    const { eventMeta } = event as any;
    const { coinMint, pcMint } = eventMeta;
    return [coinMint, pcMint];
  });

  const uniqueAddresses = [...new Set(addresses)];
  const uniqueAddressesString = uniqueAddresses
    .map((address) => `'${address}'`)
    .join(",");

  const selectQuery = `
    SELECT mint 
    FROM moonshot_data 
    WHERE mint IN (${uniqueAddressesString})
    UNION
    SELECT mint
    FROM pump_data 
    WHERE mint IN (${uniqueAddressesString});
  `;

  interface MintRow {
    mint: string;
  }

  const result = await client.query<MintRow>(selectQuery);
  const mintsOfInterest: Record<string, boolean> = {};
  result.rows.forEach((row) => {
    mintsOfInterest[row.mint] = true;
  });

  const eventsOfInterest: IEvent[] = [];

  events.forEach((event) => {
    const { eventMeta } = event as any;
    const { coinMint, pcMint } = eventMeta;
    if (mintsOfInterest[coinMint] || mintsOfInterest[pcMint]) {
      eventsOfInterest.push(event);
    }
  });

  return eventsOfInterest;
}

export async function saveRaydiumData(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (mintEvents.length === 0) return { rowsCount: 0 };

  const { blockTime, slot } = blockData;

  let rowsCount = 0;

  const mintEventsOfInterest = await filterMintEventsOfProtocolsOfInterest(
    client,
    mintEvents,
  );

  for (const event of mintEventsOfInterest) {
    const { eventObj, eventMeta, rayLogEventData } = event as any;

    if (eventMeta.decodedRayLog) {
      // raylog
    } else {
      // AMM accounts

      const insertQuery = `
        INSERT INTO raydium_data (
            amm, amm_open_orders, lp_mint, coin_mint, pc_mint, pool_coin_token_account, pool_pc_token_account, 
            pool_withdraw_queue, amm_target_orders, pool_temp_lp, open_time, init_pc_amount, init_coin_amount, 
            pc_decimals, coin_decimals, pc_lot_size, coin_lot_size, pc_amount, coin_amount, market, price, created, updated, create_event_slot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (amm) DO NOTHING;
      `;

      // TODO: ON CONFLICT (amm) update the fields (because the re-indexing of old blocks when new blocks with prices are indexed)

      const {
        amm,
        ammOpenOrders,
        lpMint,
        coinMint,
        pcMint,
        poolCoinTokenAccount,
        poolPcTokenAccount,
        poolWithdrawQueue,
        ammTargetOrders,
        poolTempLp,
      } = eventMeta;
      const { instructionValues } = eventObj;
      const { openTime, initPcAmount, initCoinAmount } = instructionValues;
      const {
        pc_decimals,
        coin_decimals,
        pc_lot_size,
        coin_lot_size,
        pc_amount,
        coin_amount,
        market,
      } = rayLogEventData;

      const values = [
        amm,
        ammOpenOrders,
        lpMint,
        coinMint,
        pcMint,
        poolCoinTokenAccount,
        poolPcTokenAccount,
        poolWithdrawQueue,
        ammTargetOrders,
        poolTempLp,
        openTime,
        initPcAmount,
        initCoinAmount,
        pc_decimals,
        coin_decimals,
        pc_lot_size,
        coin_lot_size,
        pc_amount,
        coin_amount,
        market,
        null,
        blockTime,
        blockTime,
        slot,
      ];

      try {
        const result = await dbQueryWithValues(client, insertQuery, values);
        if (result.rowCount) {
          rowsCount += result.rowCount;
        }
      } catch (err) {
        console.error("Error inserting raydium_data:", err);
        throw err;
      }
    }
  }

  return { rowsCount };
}

export async function saveMintEvents(
  client: Client,
  mintEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (mintEvents.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(mintEvents);

  let rowsCount = 0;

  rowsCount += (await saveRaydiumData(client, mintEvents, blockData)).rowsCount;

  return { rowsCount };
}
