import { IEvent } from "../../../parsing/auxiliar/parsing";
import { PumpfunTradeEventValues } from "../../../parsing/protocol/pumpfun/instruction-data";
import { Client } from "pg";
import { dbQueryWithValues } from "../../wrapper";

export async function filterTradesOfCookingWallets(
  backendClient: Client,
  tradeEvents: IEvent[],
): Promise<IEvent[]> {
  if (tradeEvents.length === 0) return [];

  const users = [
    ...new Set(
      tradeEvents.flatMap((event) => {
        const { eventObj } = event;
        let { decodedTrade } = eventObj;
        if (decodedTrade == undefined) decodedTrade = eventObj;
        const data = decodedTrade as PumpfunTradeEventValues;
        return data.user.toBase58();
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
    const { eventObj } = event;
    let { decodedTrade } = eventObj;
    if (decodedTrade == undefined) decodedTrade = eventObj;
    const data = decodedTrade as PumpfunTradeEventValues;
    if (activeWalletsMap[data.user.toBase58()]) {
      relevantTradeEvents.push(event);
    }
  });

  return relevantTradeEvents;
}
