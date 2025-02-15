import { IEvent } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

// TODO: very expensive in database space
export async function saveAllTrades(
  client: Client,
  tradeEvents: IEvent[],
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  let rowsCount = 0;

  // Inserción consolidada
  const insertQuery = `
    WITH inserted_wallets AS (
      INSERT INTO trades_user (wallet)
      VALUES ${tradeEvents.map((_trade, index) => `($${index + 1})`).join(", ")}
      ON CONFLICT (wallet) DO NOTHING
      RETURNING id AS user_id, wallet
    ),
    all_wallets AS (
      SELECT user_id, wallet
      FROM inserted_wallets
      UNION ALL
      SELECT id AS user_id, wallet
      FROM trades_user
      WHERE wallet IN (${tradeEvents.map((_trade, index) => `$${index + 1}`).join(", ")})
    ),
    inserted_mints AS (
      INSERT INTO trades_mint (mint)
      VALUES ${tradeEvents
        .map((_trade, index) => `($${index + 1 + tradeEvents.length})`)
        .join(", ")}
      ON CONFLICT (mint) DO NOTHING
      RETURNING id AS mint_id, mint
    ),
    all_mints AS (
      SELECT mint_id, mint
      FROM inserted_mints
      UNION ALL
      SELECT id AS mint_id, mint
      FROM trades_mint
      WHERE mint IN (${tradeEvents
        .map((_trade, index) => `$${index + 1 + tradeEvents.length}`)
        .join(", ")})
    )
    INSERT INTO trades (
      user_id, mint_id, slot, transaction_id, token_amount
    )
    SELECT 
      uw.user_id, um.mint_id, t.slot, t.transaction_id, t.token_amount
    FROM (VALUES ${tradeEvents
      .map(
        (_trade, index) => `(
          $${index * 5 + 1 + tradeEvents.length * 2},
          $${index * 5 + 2 + tradeEvents.length * 2},
          $${index * 5 + 3 + tradeEvents.length * 2}::bigint,
          $${index * 5 + 4 + tradeEvents.length * 2},
          $${index * 5 + 5 + tradeEvents.length * 2}::numeric
        )`,
      )
      .join(", ")}
    ) AS t(wallet, mint, slot, transaction_id, token_amount)
    LEFT JOIN all_wallets uw ON uw.wallet = t.wallet
    LEFT JOIN all_mints um ON um.mint = t.mint;
  `;

  const params = [
    // wallets
    ...tradeEvents.map((trade) => {
      const { eventObj } = trade;
      const data = eventObj as PumpfunTradeEventValues;
      return data.user.toBase58();
    }),

    // mints
    ...tradeEvents.map((trade) => {
      const { eventObj } = trade;
      const data = eventObj as PumpfunTradeEventValues;
      return data.mint.toBase58();
    }),

    // trades
    ...tradeEvents.flatMap((trade) => {
      const { eventObj } = trade;
      const data = eventObj as PumpfunTradeEventValues;
      return [
        data.user.toBase58(),
        data.mint.toBase58(),
        trade.slot,
        trade.signature,
        data.isBuy ? data.tokenAmount : -data.tokenAmount,
      ];
    }),
  ];

  try {
    const result = await dbQueryWithValues(client, insertQuery, params);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting trades_user, trades_mint and trades:", err);
    throw err;
  }

  return { rowsCount };
}
