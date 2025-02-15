import { IEvent, stringifyObj } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

interface IPumpfunHeldBatch {
  timestamp: number;
  tokenAmount: number;
  price: number;
}

interface IDiamondHandsData {
  heldBatches: IPumpfunHeldBatch[];
  soldHoldingSum: number;
  totalTokens: number;
  realizedProfit: number;
  averageHoldingTime: number;
  totalProfit: number;
  buyCount: number;
  sellCount: number;
}

async function readCurrentDiamondHandsData(
  client: Client,
  tradeEvents: IEvent[],
): Promise<{ [mint: string]: { [wallet: string]: IDiamondHandsData } }> {
  const mintAndWalletPairs = tradeEvents.map((event) => [
    event.eventObj.mint.toBase58(),
    event.eventObj.user.toBase58(),
  ]);

  const placeholders = mintAndWalletPairs
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(",");

  const selectQuery = `
    SELECT mint, wallet, held_batches, sold_holding_sum, total_tokens, realized_profit, average_holding_time, total_profit, buy_count, sell_count
    FROM diamond_hands 
    WHERE (mint, wallet) IN (${placeholders});
  `;

  const mintToWalletsDataMap: {
    [mint: string]: { [wallet: string]: IDiamondHandsData };
  } = {};

  const queryValues = mintAndWalletPairs.flat();

  try {
    const result = await dbQueryWithValues(client, selectQuery, queryValues);
    for (const row of result.rows) {
      mintToWalletsDataMap[row.mint] ??= {};
      mintToWalletsDataMap[row.mint][row.wallet] = {
        heldBatches: row.held_batches,
        soldHoldingSum: Number(row.sold_holding_sum),
        totalTokens: Number(row.total_tokens),
        realizedProfit: Number(row.realized_profit),
        averageHoldingTime: Number(row.average_holding_time),
        totalProfit: Number(row.total_profit),
        buyCount: Number(row.buy_count),
        sellCount: Number(row.sell_count),
      };
    }
  } catch (err) {
    console.error("Error fetching diamond_hands: ", err);
    throw err;
  }

  return mintToWalletsDataMap;
}

async function updateDiamondHandsData(
  client: Client,
  mintToWalletsDataMap: {
    [mint: string]: { [wallet: string]: IDiamondHandsData };
  },
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (Object.keys(mintToWalletsDataMap).length === 0) return { rowsCount: 0 };

  const { blockTime } = blockData;

  const entries = Object.keys(mintToWalletsDataMap).flatMap((mint) => {
    return Object.keys(mintToWalletsDataMap[mint]).map((wallet) => {
      const walletData = mintToWalletsDataMap[mint][wallet];
      return [
        mint,
        wallet,
        stringifyObj(walletData.heldBatches),
        walletData.soldHoldingSum,
        walletData.totalTokens,
        walletData.realizedProfit,
        walletData.averageHoldingTime,
        walletData.totalProfit,
        walletData.buyCount,
        walletData.sellCount,
        blockTime,
      ];
    });
  });

  const insertQuery = `
    INSERT INTO diamond_hands (
      mint,
      wallet,
      held_batches,
      sold_holding_sum,
      total_tokens,
      realized_profit,
      average_holding_time,
      total_profit,
      buy_count,
      sell_count,
      updated
    ) VALUES
    ${entries
      .map(
        (_, index) =>
          `($${index * 11 + 1}::varchar, $${index * 11 + 2}::varchar, 
            $${index * 11 + 3}::jsonb, 
            $${index * 11 + 4}::numeric, $${index * 11 + 5}::numeric, 
            $${index * 11 + 6}::numeric, $${index * 11 + 7}::numeric, 
            $${index * 11 + 8}::numeric, $${index * 11 + 9}::numeric, 
            $${index * 11 + 10}::numeric, 
            $${index * 11 + 11}::bigint)`,
      )
      .join(", ")}
    ON CONFLICT (mint, wallet) DO UPDATE SET
      held_batches = EXCLUDED.held_batches,
      sold_holding_sum = EXCLUDED.sold_holding_sum,
      total_tokens = EXCLUDED.total_tokens,
      realized_profit = EXCLUDED.realized_profit,
      average_holding_time = EXCLUDED.average_holding_time,
      total_profit = EXCLUDED.total_profit,
      buy_count = EXCLUDED.buy_count,
      sell_count = EXCLUDED.sell_count,
      updated = EXCLUDED.updated;
    `;

  let rowsCount = 0;

  const values = entries.flatMap((entry) => entry);

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting/updating diamond_hands:", err);
    throw err;
  }

  return { rowsCount };
}

export async function updateDiamondHands(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const { blockTime } = blockData;

  const mintToWalletsDataMap = await readCurrentDiamondHandsData(
    client,
    tradeEvents,
  );

  for (const tradeEvent of tradeEvents) {
    const { eventObj } = tradeEvent;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const data = decodedTrade as PumpfunTradeEventValues;

    if (!(data.solAmount > 0n && data.tokenAmount > 0n)) {
      continue;
    }

    // add the new batch of bought tokens
    const mint = data.mint.toBase58();
    const wallet = data.user.toBase58();
    mintToWalletsDataMap[mint] ??= {};
    mintToWalletsDataMap[mint][wallet] ??= {
      heldBatches: [],
      soldHoldingSum: 0,
      totalTokens: 0,
      realizedProfit: 0,
      averageHoldingTime: 0,
      totalProfit: 0,
      buyCount: 0,
      sellCount: 0,
    };
    const walletData = mintToWalletsDataMap[mint][wallet];
    if (data.isBuy) {
      walletData.heldBatches.push({
        timestamp: data.timestamp,
        tokenAmount: Number(data.tokenAmount),
        price: Number(data.solAmount) / Number(data.tokenAmount),
      });
      walletData.totalTokens += Number(data.tokenAmount);
      walletData.buyCount++;
    } else {
      // sell
      const sellAmount = Number(data.tokenAmount);
      let remainingToSell = sellAmount;

      // sells the oldest batch first (if there isn't any batch, the sell is ignored)
      while (remainingToSell > 0 && walletData.heldBatches.length > 0) {
        const oldestBatch = walletData.heldBatches[0];
        const timeHeld = data.timestamp - oldestBatch.timestamp;
        const currentPrice = Number(data.solAmount) / Number(data.tokenAmount);
        if (oldestBatch.tokenAmount <= remainingToSell) {
          walletData.realizedProfit +=
            (currentPrice - oldestBatch.price) *
            Number(oldestBatch.tokenAmount);
          walletData.soldHoldingSum += oldestBatch.tokenAmount * timeHeld;
          remainingToSell -= oldestBatch.tokenAmount;
          walletData.heldBatches.shift();
        } else {
          walletData.realizedProfit +=
            (currentPrice - oldestBatch.price) * Number(remainingToSell);
          walletData.soldHoldingSum += remainingToSell * timeHeld;
          oldestBatch.tokenAmount -= remainingToSell;
          remainingToSell = 0;
        }
      }

      walletData.sellCount++;
    }

    // calculate the holding sum for currently held tokens and potential profit

    let heldHoldingSum = 0;
    let potentialProfit = 0;

    for (const batch of walletData.heldBatches) {
      const currentPrice = Number(data.solAmount) / Number(data.tokenAmount);
      heldHoldingSum += (blockTime - batch.timestamp) * batch.tokenAmount;
      potentialProfit += (currentPrice - batch.price) * batch.tokenAmount;
    }

    if (walletData.totalTokens > 0) {
      walletData.averageHoldingTime =
        (walletData.soldHoldingSum + heldHoldingSum) / walletData.totalTokens;
    } else {
      walletData.averageHoldingTime = 0;
    }

    walletData.totalProfit = walletData.realizedProfit + potentialProfit;
  }

  return await updateDiamondHandsData(client, mintToWalletsDataMap, blockData);
}
