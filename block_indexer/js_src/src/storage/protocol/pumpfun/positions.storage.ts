import {
  assertNonFailedTransaction,
  IEvent,
} from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { consolidateTradeEvents } from "./consolidation";
import { IConsolidatedTradeEvent } from "../../consolidation";
import { dbQueryWithValues } from "../../wrapper";

export async function updatePositions(
  client: Client,
  tradeEventsOfCookingWallets: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEventsOfCookingWallets.length === 0) return { rowsCount: 0 };

  assertNonFailedTransaction(tradeEventsOfCookingWallets);

  const consolidatedTradeEvents: IConsolidatedTradeEvent[] =
    consolidateTradeEvents(tradeEventsOfCookingWallets, blockData);

  const insertQuery = `
        INSERT INTO positions (
            user_wallet,
            token_mint,
            sol_received,
            token_received,
            sol_sent,
            token_sent,
            cost_basis,
            realized_pnl,
            unrealized_pnl,
            current_price,
            last_buy
        ) VALUES
        ${consolidatedTradeEvents
          .map(
            (_, index) =>
              `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`,
          )
          .join(", ")}
        ON CONFLICT (user_wallet, token_mint)
        DO UPDATE SET
            sol_received = EXCLUDED.sol_received + positions.sol_received,
            token_received = EXCLUDED.token_received + positions.token_received,
            sol_sent = EXCLUDED.sol_sent + positions.sol_sent,
            token_sent = EXCLUDED.token_sent + positions.token_sent,
            last_buy = CASE 
                WHEN EXCLUDED.last_buy IS NOT NULL THEN EXCLUDED.last_buy 
                ELSE positions.last_buy
            END;
      `;

  const values = consolidatedTradeEvents.flatMap((event) => {
    return [
      event.userWallet,
      event.tokenMint,
      event.solReceived,
      event.tokenReceived,
      event.solSent,
      event.tokenSent,
      event.costBasis,
      event.realizedPnl,
      event.unrealizedPnl,
      event.currentPrice,
      event.lastBuy,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting positions:", err);
    throw err;
  }

  return { rowsCount };
}
