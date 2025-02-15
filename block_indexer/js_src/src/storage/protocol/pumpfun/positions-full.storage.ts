import { IEvent } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IConsolidatedTradeEventForPositionsFull } from "../../consolidation";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { consolidateTradeEventsForPositionsFull } from "./consolidation";
import Decimal from "decimal.js";
import { dbQueryWithValues } from "../../wrapper";

export async function updatePositionsFull(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const consolidatedTradeEvents: IConsolidatedTradeEventForPositionsFull[] =
    consolidateTradeEventsForPositionsFull(tradeEvents);

  const insertQuery = `
    INSERT INTO positions_full (
        user_wallet,
        token_mint,
        token_received,
        token_sent,
        sol_received,
        sol_sent,
        updated_slot,
        buy_count,
        sell_count
    ) VALUES 
    ${consolidatedTradeEvents
      .map(
        (_, index) =>
          `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9})`,
      )
      .join(", ")} 
    ON CONFLICT (user_wallet, token_mint)
    DO UPDATE SET
        token_received = positions_full.token_received + EXCLUDED.token_received,
        token_sent = positions_full.token_sent + EXCLUDED.token_sent,
        sol_received = positions_full.sol_received + EXCLUDED.sol_received,
        sol_sent = positions_full.sol_sent + EXCLUDED.sol_sent,
        updated_slot = EXCLUDED.updated_slot,
        buy_count = positions_full.buy_count + EXCLUDED.buy_count,
        sell_count = positions_full.sell_count + EXCLUDED.sell_count;
  `;

  const { slot } = blockData;

  const values = consolidatedTradeEvents.flatMap((consolidatedEvent) => {
    return [
      consolidatedEvent.userWallet,
      consolidatedEvent.tokenMint,
      consolidatedEvent.tokenReceived,
      consolidatedEvent.tokenSent,
      consolidatedEvent.solReceived,
      consolidatedEvent.solSent,
      slot,
      consolidatedEvent.buyCount,
      consolidatedEvent.sellCount,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting positions_full:", err);
    throw err;
  }

  return { rowsCount };
}

// TODO: non required (the computed values are expensive in database space)
export async function updatePositionsFullWithComputedValues(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { blockTime } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const buyInsertQuery = `
    INSERT INTO positions_full (
        user_wallet,
        token_mint,
        total_received,
        net_position,
        cost_basis,
        last_buy,
        token_received,
        token_sent,
        sol_received,
        sol_sent
    ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_wallet, token_mint)
    DO UPDATE SET
        total_received = positions_full.total_received + EXCLUDED.total_received,
        net_position = positions_full.total_received - positions_full.total_sent,
        cost_basis = positions_full.cost_basis + EXCLUDED.cost_basis,
        last_buy = EXCLUDED.last_buy,
        token_received = positions_full.token_received + EXCLUDED.token_received,
        token_sent = positions_full.token_sent + EXCLUDED.token_sent,
        sol_received = positions_full.sol_received + EXCLUDED.sol_received,
        sol_sent = positions_full.sol_sent + EXCLUDED.sol_sent;
  `;

  const sellUpdateQuery = `
    UPDATE positions_full
    SET realized_pnl = positions_full.realized_pnl + ($3 - (positions_full.cost_basis / positions_full.net_position) * $4),
        net_position = positions_full.net_position - $4,
        cost_basis = positions_full.cost_basis - ((positions_full.cost_basis / positions_full.net_position) * $4),
        total_sent = positions_full.total_sent + $4,
        token_received = positions_full.token_received + $5,
        token_sent = positions_full.token_sent + $6,
        sol_received = positions_full.sol_received + $7,
        sol_sent = positions_full.sol_sent + $8
    WHERE positions_full.user_wallet = $1 AND positions_full.token_mint = $2;
  `;

  let rowsCount = 0;

  for (const event of tradeEvents) {
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) {
      // is a TradeEvent (readed from logs)
      decodedTrade = eventObj;
    }
    const data = decodedTrade as PumpfunTradeEventValues;

    const userWallet = data.user.toBase58();
    const tokenMint = data.mint.toBase58();

    let values: any[] = [];

    if (data.isBuy) {
      const tokenReceived = data.tokenAmount;
      const tokenSent = 0;
      const solReceived = 0;
      const solSent = data.solAmount;

      const totalReceived = data.tokenAmount;
      const costBasis = data.solAmount;
      const lastBuy = blockTime;
      values = [
        userWallet,
        tokenMint,
        totalReceived,
        costBasis,
        lastBuy,
        // to verify
        tokenReceived,
        tokenSent,
        solReceived,
        solSent,
      ];
    } else {
      const tokenReceived = 0;
      const tokenSent = data.tokenAmount;
      const solReceived = data.solAmount;
      const solSent = 0;

      // sell price in lamports * microtoken
      const sellPrice =
        Number(data.virtualSolReserves) / Number(data.virtualTokenReserves);
      const tradeAmount = data.tokenAmount;
      values = [
        userWallet,
        tokenMint,
        sellPrice,
        tradeAmount,
        // to verify
        tokenReceived,
        tokenSent,
        solReceived,
        solSent,
      ];
    }

    try {
      const result = await dbQueryWithValues(
        client,
        data.isBuy ? buyInsertQuery : sellUpdateQuery,
        values,
      );
      if (result.rowCount) {
        rowsCount += result.rowCount;
      }
    } catch (err) {
      console.error("Error inserting positions_full:", err);
      throw err;
    }
  }

  return { rowsCount };
}

export async function updateWalletPositions(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const { slot } = blockData;

  const buyInsertQuery = `
    INSERT INTO wallet_positions (wallet, token, token_received, token_quantity, average_price, cost_basis, sol_sent, last_buy)
    VALUES ($1::text, $2::text, $3::numeric, $3::numeric, $4::numeric, ($3::numeric * $4::numeric), $5::numeric, $6::bigint)
    ON CONFLICT (wallet, token)
    DO UPDATE
    SET 
        token_received = wallet_positions.token_received + EXCLUDED.token_received,
        token_quantity = wallet_positions.token_quantity + EXCLUDED.token_quantity,
        cost_basis = wallet_positions.cost_basis + (EXCLUDED.token_quantity * EXCLUDED.average_price),
        average_price = (wallet_positions.cost_basis + (EXCLUDED.token_quantity * EXCLUDED.average_price)) / 
                        (wallet_positions.token_quantity + EXCLUDED.token_quantity),
        sol_sent = wallet_positions.sol_sent + EXCLUDED.sol_sent,
        last_buy = EXCLUDED.last_buy;
  `;

  const sellUpdateQuery = `
    WITH sold_data AS (
        SELECT 
            *,
            LEAST(token_quantity, $3::numeric) AS sell_quantity,
            (LEAST(token_quantity, $3::numeric) * average_price) AS sell_cost
        FROM wallet_positions
        WHERE wallet = $1::text AND token = $2::text
    )
    UPDATE wallet_positions
    SET
        token_sent = wallet_positions.token_sent + sold_data.sell_quantity,
        token_quantity = wallet_positions.token_quantity - sold_data.sell_quantity,
        cost_basis = wallet_positions.cost_basis - sold_data.sell_cost,
        realized_pnl = wallet_positions.realized_pnl + ($4::numeric * sold_data.sell_quantity) - sold_data.sell_cost,
        sol_received = wallet_positions.sol_received + $5::numeric
    FROM sold_data
    WHERE wallet_positions.wallet = sold_data.wallet AND wallet_positions.token = sold_data.token;
  `;

  let rowsCount = 0;

  for (const event of tradeEvents) {
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const data = decodedTrade as PumpfunTradeEventValues;

    const userWallet = data.user.toBase58();
    const tokenMint = data.mint.toBase58();
    const tokenAmount = new Decimal(data.tokenAmount.toString());
    // skip if tokenAmount is 0 (div by 0)
    if (tokenAmount.eq(0)) continue;
    const solAmount = new Decimal(data.solAmount.toString());
    const price = solAmount.div(tokenAmount);

    const values = data.isBuy
      ? [
          userWallet,
          tokenMint,
          tokenAmount.toString(),
          price.toString(),
          solAmount.toString(),
          slot,
        ]
      : [
          userWallet,
          tokenMint,
          tokenAmount.toString(),
          price.toString(),
          solAmount.toString(),
        ];

    try {
      const result = await dbQueryWithValues(
        client,
        data.isBuy ? buyInsertQuery : sellUpdateQuery,
        values,
      );
      if (result.rowCount) {
        rowsCount += result.rowCount;
      }
    } catch (err) {
      console.error("Error inserting wallet_positions:", err);
      throw err;
    }
  }

  return { rowsCount };
}
