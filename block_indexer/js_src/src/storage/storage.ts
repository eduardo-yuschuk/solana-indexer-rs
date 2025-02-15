import dotenv from "dotenv";
import { IEvent } from "../parsing/auxiliar/parsing";
import { RaydiumStorage } from "./protocol/raydium/storage";
import { PumpFunStorage } from "./protocol/pumpfun/storage";
import { MoonshotStorage } from "./protocol/moonshot/storage";
import { SolanaStorage } from "./protocol/solana/storage";
import { Client, DatabaseError } from "pg";
import {
  GENERIC_EVENT_TYPE_PRIORITY_ORDER,
  GenericEventType,
  INDEXER_EVENT_SOURCE_PRIORITY_ORDER,
  IndexerEventSource,
} from "../event";
import { dbQuery, dbQueryWithValues } from "./wrapper";

dotenv.config();

const UNIQUE_VIOLATION_ERROR_CODE = "23505";

const storage: { [id: string]: IStorage } = {};

if (process.env.INDEXERS?.includes(IndexerEventSource.Raydium.toLowerCase())) {
  console.log("Storage, loading RaydiumStorage");
  storage[IndexerEventSource.Raydium] = RaydiumStorage;
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Moonshot.toLowerCase())) {
  console.log("Storage, loading MoonshotStorage");
  storage[IndexerEventSource.Moonshot] = MoonshotStorage;
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Pumpfun.toLowerCase())) {
  console.log("Storage, loading PumpFunStorage");
  storage[IndexerEventSource.Pumpfun] = PumpFunStorage;
}

if (process.env.INDEXERS?.includes(IndexerEventSource.Solana.toLowerCase())) {
  console.log("Storage, loading SolanaStorage");
  storage[IndexerEventSource.Solana] = SolanaStorage;
}

export function arrangeEventsBySource(events: IEvent[]): {
  [id: string]: IEvent[];
} {
  const eventsBySource: { [id: string]: IEvent[] } = {};
  events.forEach((event) => {
    if (event.source in eventsBySource) {
      eventsBySource[event.source].push(event);
    } else {
      eventsBySource[event.source] = [event];
    }
  });
  return eventsBySource;
}

export function arrangeEventsByType(events: IEvent[]): {
  [id: string]: IEvent[];
} {
  const eventsByType: { [id: string]: IEvent[] } = {};
  events.forEach((event) => {
    if (event.type in eventsByType) {
      eventsByType[event.type].push(event);
    } else {
      eventsByType[event.type] = [event];
    }
  });
  return eventsByType;
}

export function getSortedEventTypes(eventsByType: {
  [id: string]: IEvent[];
}): GenericEventType[] {
  const orderedEventTypes = Object.keys(eventsByType).sort(
    (a, b) =>
      GENERIC_EVENT_TYPE_PRIORITY_ORDER.indexOf(a as GenericEventType) -
      GENERIC_EVENT_TYPE_PRIORITY_ORDER.indexOf(b as GenericEventType),
  );
  return orderedEventTypes.map((type) => type as GenericEventType);
}

export function getSortedEventSources(eventsBySource: {
  [id: string]: IEvent[];
}): IndexerEventSource[] {
  const orderedEventSources = Object.keys(eventsBySource).sort(
    (a, b) =>
      INDEXER_EVENT_SOURCE_PRIORITY_ORDER.indexOf(a as IndexerEventSource) -
      INDEXER_EVENT_SOURCE_PRIORITY_ORDER.indexOf(b as IndexerEventSource),
  );
  return orderedEventSources.map((source) => source as IndexerEventSource);
}

// event type level interface

export interface IEventTypeSaveResult {
  rowsCount: number;
}

// protocol level interface

export interface IProtocolSaveResult {
  rowsCount: number;
  eventsByType: { [id: string]: number };
}

export interface IBlockData {
  slot: number;
  blockTime: number;
}

export interface IStorage {
  saveProtocolEvents(
    client: Client,
    backendClient: Client,
    args: IEvent[],
    blockData: IBlockData,
  ): Promise<IProtocolSaveResult>;
}

// global interface

export interface ISaveResult {
  rowsCount: number;
  eventsBySourceAndType: { [id: string]: { [id: string]: number } };
}

async function saveBlock(
  client: Client,
  blockData: IBlockData,
): Promise<{ duplicated: boolean }> {
  const { slot, blockTime } = blockData;
  const values = [
    slot,
    blockTime,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now()),
    null,
  ];

  const insertQuery = `
    INSERT INTO public.blocks (
        slot, status, block_time, indexing_time, created, verified
    ) VALUES ($1, 'I', $2, $3, $4, $5)
  `;

  try {
    await dbQueryWithValues(client, insertQuery, values);
  } catch (err) {
    if (err instanceof DatabaseError) {
      if (err.code === UNIQUE_VIOLATION_ERROR_CODE) {
        return { duplicated: true };
      }
    }
    console.error("Error inserting/updating blocks:", err);
    throw err;
  }

  return { duplicated: false };
}

export async function saveEvents(
  client: Client,
  backendClient: Client,
  blockData: IBlockData,
  events: IEvent[],
): Promise<ISaveResult> {
  const eventsBySource = arrangeEventsBySource(events);

  let rowsCount = 0;
  const eventsBySourceAndType: { [id: string]: { [id: string]: number } } = {};

  if (process.env.BYPASS_STORAGE) {
    return { rowsCount, eventsBySourceAndType };
  }

  try {
    await dbQuery(client, "BEGIN");
  } catch (err) {
    console.error(err);
    throw err;
  }

  const orderedEventSources = getSortedEventSources(eventsBySource);

  for (const source of orderedEventSources) {
    const result = await storage[source].saveProtocolEvents(
      client,
      backendClient,
      eventsBySource[source],
      blockData,
    );
    rowsCount += result.rowsCount;
    eventsBySourceAndType[source] = result.eventsByType;
  }

  const result = await saveBlock(client, blockData);

  if (result.duplicated) {
    console.log(`Block ${blockData.slot} was already indexed, rolling back`);
    try {
      await dbQuery(client, "ROLLBACK");
    } catch (err) {
      console.error(err);
      throw err;
    }

    return { rowsCount: 0, eventsBySourceAndType: {} };
  }

  try {
    await dbQuery(client, "COMMIT");
  } catch (err) {
    console.error(err);
    throw err;
  }

  return { rowsCount, eventsBySourceAndType };
}
