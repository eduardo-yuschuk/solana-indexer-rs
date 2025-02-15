export enum Timeframe {
  S1 = 1,
  // S30 = 30,
  // M1 = 60,
  // M5 = 300,
  // M15 = 900,
  // M30 = 1800,
  // H1 = 3600,
  H4 = 14400,
  D1 = 86400,
}

export const Timeframes = [
  Timeframe.S1,
  // Timeframe.S30,
  // Timeframe.M1,
  // Timeframe.M5,
  // Timeframe.M15,
  // Timeframe.M30,
  // Timeframe.H1,
  Timeframe.H4,
  Timeframe.D1,
];

export interface IBar {
  timeframe: Timeframe;
  timestamp: number;
  mint: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  buy_count: bigint;
  sell_count: bigint;
}

// TODO fix pump tables and migrate everything to number volume
export interface IFixedBar {
  timeframe: Timeframe;
  timestamp: number;
  mint: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buy_count: number;
  sell_count: number;
}
