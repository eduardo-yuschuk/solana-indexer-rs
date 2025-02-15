export interface IConsolidatedTradeEvent {
  userWallet: string;
  tokenMint: string;
  solReceived: bigint;
  tokenReceived: bigint;
  solSent: bigint;
  tokenSent: bigint;
  costBasis: bigint;
  realizedPnl: number;
  unrealizedPnl: number;
  currentPrice: bigint;
  lastBuy: number | null;
  isBondingCurve: boolean | null;
}

export interface IConsolidatedSplTokenBalanceChangeEvent {
  wallet: string;
  mint: string;
  tokenAccount: string;
  decimals: number;
  oldAmount: bigint;
  newAmount: bigint;
  isBondingCurve: boolean | null;
  isDeveloper: boolean | null;
}

export interface IConsolidatedTradeEventForPositionsFull {
  userWallet: string;
  tokenMint: string;
  solReceived: bigint;
  tokenReceived: bigint;
  solSent: bigint;
  tokenSent: bigint;
  buyCount: number;
  sellCount: number;
}

export interface IAggregatedSplTokenBalanceChangeEvent {
  mint: string;
  devHoldSum: bigint;
  totalAmount: bigint;
  totalHolders: number;
}
