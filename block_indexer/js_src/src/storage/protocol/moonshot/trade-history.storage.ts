import { Client } from "pg";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { filterTradesOfCookingWallets } from "./wallets";
import { dbQueryWithValues } from "../../wrapper";

export async function saveTradesOfCookingWallets(
  client: Client,
  backendClient: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  const filteredTrades = await filterTradesOfCookingWallets(
    backendClient,
    tradeEvents,
  );

  if (filteredTrades.length == 0) {
    return { rowsCount: 0 };
  }

  const insertQuery = `
      INSERT INTO moonshot_trade (
        signer,
        mint, 
        transaction_id,
        allocation,
        amount,
        collateral_amount,
        cost_token,
        curve,
        dex_fee,
        helio_fee,
        type,
        is_buy,
        timestamp,
        created,
        failed_transaction
      ) VALUES
      ${filteredTrades
        .map(
          (_, index) =>
            `($${index * 15 + 1}, $${index * 15 + 2}, $${index * 15 + 3}, $${index * 15 + 4}, $${index * 15 + 5}, $${index * 15 + 6}, $${index * 15 + 7}, $${index * 15 + 8}, $${index * 15 + 9}, $${index * 15 + 10}, $${index * 15 + 11}, $${index * 15 + 12}, $${index * 15 + 13}, $${index * 15 + 14}, $${index * 15 + 15})`,
        )
        .join(", ")};
    `;

  const values = filteredTrades.flatMap((event) => {
    const { eventObj, eventMeta, eventLog, signature } = event as any;

    const isBuy = eventObj.instructionType === "Buy";

    return [
      eventMeta.sender,
      eventMeta.mint,
      signature,
      eventLog?.allocation,
      eventLog?.amount,
      eventLog?.collateralAmount,
      eventLog?.costToken,
      eventLog?.curve,
      eventLog?.dexFee,
      eventLog?.helioFee,
      eventLog?.type,
      isBuy,
      eventMeta.blockTime,
      blockData.blockTime,
      eventMeta.failedTransaction,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error("Error inserting moonshot_trade:", err);
    throw err;
  }

  return { rowsCount };
}
