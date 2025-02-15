import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import Decimal from "decimal.js";
import { dbQueryWithValues } from "../../wrapper";

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
    const { eventLog, eventMeta, eventObj } = event as any;

    const userWallet = eventMeta.sender;
    const tokenMint = eventMeta.mint;
    const tokenAmount = new Decimal(eventLog.amount.toString());
    // skip if tokenAmount is 0 (div by 0)
    if (tokenAmount.eq(0)) continue;
    const solAmount = new Decimal(eventLog.collateralAmount.toString());
    const price = solAmount.div(tokenAmount);

    const isBuy = eventObj.instructionType === "Buy";

    const values = isBuy
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
        isBuy ? buyInsertQuery : sellUpdateQuery,
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
