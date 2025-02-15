import { IEvent } from "../../../parsing/auxiliar/parsing";
import { IBlockData, IEventTypeSaveResult } from "../../storage";
import { Client } from "pg";
import { updateDiamondHands } from "./diamond-hands";

export async function updateIndicators(
  client: Client,
  tradeEvents: IEvent[],
  blockData: IBlockData,
): Promise<IEventTypeSaveResult> {
  if (tradeEvents.length === 0) return { rowsCount: 0 };

  let rowsCount = 0;

  rowsCount += (await updateDiamondHands(client, tradeEvents, blockData))
    .rowsCount;

  return { rowsCount };
}
