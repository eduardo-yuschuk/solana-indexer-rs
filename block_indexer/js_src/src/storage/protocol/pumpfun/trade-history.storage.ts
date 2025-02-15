import { IEvent } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

export async function saveTrades(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  const { blockTime } = blockData;

  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const insertQuery = `
      INSERT INTO pump_trade (
        signer,
        mint, 
        transaction_id,
        sol_amount,
        token_amount,
        is_buy,
        timestamp,
        virtual_token_reserves, 
        virtual_sol_reserves, 
        real_token_reserves, 
        real_sol_reserves, 
        created,
        failed_transaction
      ) VALUES
      ${tradeEvents
        .map(
          (_, index) =>
            `($${index * 13 + 1}, $${index * 13 + 2}, $${index * 13 + 3}, $${index * 13 + 4}, $${index * 13 + 5}, $${index * 13 + 6}, $${index * 13 + 7}, $${index * 13 + 8}, $${index * 13 + 9}, $${index * 13 + 10}, $${index * 13 + 11}, $${index * 13 + 12}, $${index * 13 + 13})`,
        )
        .join(", ")};
    `;

  const values = tradeEvents.flatMap((event) => {
    const { eventMeta } = event;
    const { failedTransaction } = eventMeta;
    if (failedTransaction) {
      const { signature, eventObj } = event;
      const { user, mint } = eventObj;
      return [
        user.toBase58(),
        mint.toBase58(),
        signature,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        blockTime,
        eventMeta.failedTransaction,
      ];
    } else {
      const { eventObj, signature } = event;
      let { decodedTrade } = eventObj;
      if (decodedTrade == undefined) decodedTrade = eventObj;
      const data = decodedTrade as PumpfunTradeEventValues;
      return [
        data.user.toBase58(),
        data.mint.toBase58(),
        signature,
        data.solAmount,
        data.tokenAmount,
        data.isBuy,
        data.timestamp,
        data.virtualTokenReserves.toString(),
        data.virtualSolReserves.toString(),
        data.realTokenReserves.toString(),
        data.realSolReserves.toString(),
        blockTime,
        eventMeta.failedTransaction,
      ];
    }
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting pump_trade:", err);
    throw err;
  }

  return { rowsCount };
}
