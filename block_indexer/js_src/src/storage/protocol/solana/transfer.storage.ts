import { Client } from "pg";
import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { dbQueryWithValues } from "../../wrapper";

/**
 * Filter the SOL and SPL token transfers of Cooking users wallets.
 *
 * @param backendClient The backend database connection client.
 * @param transferEvents The transfer events to filter. We really care about the from and to addresses.
 * @returns The filtered transfer events.
 */
async function filterTransfersOfCookingWallets(
  backendClient: Client,
  transferEvents: { eventMeta: { fromAddress: string; toAddress: string } }[],
): Promise<IEvent[]> {
  const users = transferEvents.flatMap((event) => {
    const { eventMeta } = event;
    return [eventMeta.fromAddress, eventMeta.toAddress];
  });

  const uniqueUsers = [...new Set(users)];

  const activeWalletsMap: Record<string, boolean> = {};

  try {
    const selectQuery = `
        SELECT address
        FROM wallets 
        WHERE address IN (
          ${uniqueUsers.map((_, index) => `$${index + 1}`).join(", ")}
        )
      `;

    const result = await dbQueryWithValues(
      backendClient,
      selectQuery,
      uniqueUsers,
    );

    result.rows.forEach((row) => {
      activeWalletsMap[row.address] = true;
    });
  } catch (err) {
    console.error("Error reading wallets:", err);
    throw err;
  }

  const transferEventsOfCookingWallets: IEvent[] = [];

  transferEvents.forEach((event) => {
    const { eventMeta } = event;
    if (
      activeWalletsMap[eventMeta.fromAddress] ||
      activeWalletsMap[eventMeta.toAddress]
    ) {
      transferEventsOfCookingWallets.push(event as IEvent);
    }
  });

  return transferEventsOfCookingWallets;
}

/**
 * Save the SOL transfers of Cooking users wallets.
 *
 * @param client The indexer database connection client.
 * @param backendClient The backend database connection client.
 * @param solTransferEvents The SOL transfer events to save.
 * @param blockTime The block time of the block that contains the SOL transfer events.
 * @returns The number of rows inserted into the transfers table.
 */
export async function saveSolTransferEvents(
  client: Client,
  backendClient: Client,
  solTransferEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (solTransferEvents.length === 0) return { rowsCount: 0 };

  const { blockTime } = blockData;

  const solTransferEventsOfCookingWallets =
    await filterTransfersOfCookingWallets(backendClient, solTransferEvents);

  if (solTransferEventsOfCookingWallets.length === 0) return { rowsCount: 0 };

  const insertQuery = `
    INSERT INTO transfers (
        from_address, to_address, from_token_account, to_token_account, mint, amount, decimals, created, slot, transaction_id, failed_transaction
    ) VALUES ${solTransferEventsOfCookingWallets
      .map(
        (_, index) =>
          `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
            $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, 
            $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`,
      )
      .join(", ")}
  `;

  const values = solTransferEventsOfCookingWallets.flatMap((event) => {
    const { eventMeta, eventObj, slot, signature } = event;
    const { fromAddress, toAddress, failedTransaction } = eventMeta;
    const { instructionValues } = eventObj;
    const { lamports } = instructionValues;

    return [
      fromAddress,
      toAddress,
      null,
      null,
      null,
      lamports,
      9,
      blockTime,
      slot,
      signature,
      failedTransaction,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error(
      "Error inserting SOL transfers into the transfers table:",
      err,
    );
    throw err;
  }

  return { rowsCount };
}

/**
 * Save the SPL token transfers of Cooking users wallets.
 *
 * @param client The indexer database connection client.
 * @param backendClient The backend database connection client.
 * @param splTokenTransferEvents The SPL token transfer events to save.
 * @param blockTime The block time of the block that contains the SPL token transfer events.
 * @returns The number of rows inserted into the transfers table.
 */
export async function saveSplTokenTransferEvents(
  client: Client,
  backendClient: Client,
  splTokenTransferEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (splTokenTransferEvents.length === 0) return { rowsCount: 0 };

  const { blockTime } = blockData;

  const splTokenTransferEventsOfCookingWallets =
    await filterTransfersOfCookingWallets(
      backendClient,
      splTokenTransferEvents,
    );

  if (splTokenTransferEventsOfCookingWallets.length === 0)
    return { rowsCount: 0 };

  const insertQuery = `
    INSERT INTO transfers (
        from_address, to_address, from_token_account, to_token_account, mint, amount, decimals, created, slot, transaction_id, failed_transaction
    ) VALUES ${splTokenTransferEventsOfCookingWallets
      .map(
        (_, index) =>
          `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
            $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, 
            $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`,
      )
      .join(", ")}
  `;

  const values = splTokenTransferEventsOfCookingWallets.flatMap((event) => {
    const { eventMeta, eventObj, slot, signature } = event;
    const {
      fromAddress,
      toAddress,
      fromTokenAccount,
      toTokenAccount,
      mint,
      decimals,
      failedTransaction,
    } = eventMeta;
    const { instructionValues } = eventObj;
    const { amount } = instructionValues;

    return [
      fromAddress,
      toAddress,
      fromTokenAccount,
      toTokenAccount,
      mint,
      amount,
      decimals,
      blockTime,
      slot,
      signature,
      failedTransaction,
    ];
  });

  let rowsCount = 0;

  try {
    const result = await dbQueryWithValues(client, insertQuery, values);
    if (result.rowCount) {
      rowsCount += result.rowCount;
    }
  } catch (err) {
    console.error(
      "Error inserting SOL transfers into the transfers table:",
      err,
    );
    throw err;
  }

  return { rowsCount };
}
