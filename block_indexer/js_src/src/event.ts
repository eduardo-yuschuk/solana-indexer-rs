export enum GenericEventType {
  Trade = "Trade",
  Mint = "Mint",
  Complete = "Complete",
  Info = "Info",
  Transfer = "Transfer",
  SplTokenBalanceChange = "SplTokenBalanceChange",
  SplTokenTransfer = "SplTokenTransfer",
  SolTransfer = "SolTransfer",
}

export enum IndexerEventSource {
  Pumpfun = "Pumpfun",
  Moonshot = "Moonshot",
  Raydium = "Raydium",
  Solana = "Solana",
}

export const GENERIC_EVENT_TYPE_PRIORITY_ORDER: GenericEventType[] = [
  GenericEventType.Mint,
  GenericEventType.Trade,
  GenericEventType.Info,
  GenericEventType.Transfer,
  GenericEventType.SplTokenBalanceChange,
  GenericEventType.SplTokenTransfer,
  GenericEventType.SolTransfer,
  GenericEventType.Complete,
];

export const INDEXER_EVENT_SOURCE_PRIORITY_ORDER: IndexerEventSource[] = [
  IndexerEventSource.Pumpfun,
  IndexerEventSource.Moonshot,
  IndexerEventSource.Raydium,
  IndexerEventSource.Solana,
];
