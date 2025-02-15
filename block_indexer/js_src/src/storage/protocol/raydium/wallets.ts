import { IEvent } from "../../../parsing/auxiliar/parsing";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

export async function filterTradesOfCookingWallets(
  backendClient: Client,
  tradeEvents: IEvent[],
): Promise<IEvent[]> {
  if (tradeEvents.length == 0) return [];

  const users = [
    ...new Set(
      tradeEvents.flatMap((event) => {
        const { eventMeta } = event;
        return eventMeta.user;
      }),
    ),
  ];

  const activeWalletsMap: Record<string, boolean> = {};

  const selectQuery = `
    SELECT address
    FROM wallets 
    WHERE address IN (
      ${users.map((_, index) => `$${index + 1}`).join(", ")}
    )
  `;

  try {
    const result = await dbQueryWithValues(backendClient, selectQuery, users);

    result.rows.forEach((row) => {
      activeWalletsMap[row.address] = true;
    });
  } catch (err) {
    console.error("Error reading wallets:", err);
    throw err;
  }

  const relevantTradeEvents: IEvent[] = [];

  tradeEvents.forEach((event) => {
    const { eventMeta } = event;
    if (activeWalletsMap[eventMeta.user]) {
      relevantTradeEvents.push(event);
    }
  });

  return relevantTradeEvents;
}
