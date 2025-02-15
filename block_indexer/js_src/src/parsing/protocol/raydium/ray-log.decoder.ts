import { PublicKey } from "@solana/web3.js";
import { decode } from "base-64";

export enum LogType {
  Init = "Init",
  Deposit = "Deposit",
  Withdraw = "Withdraw",
  SwapBaseIn = "SwapBaseIn",
  SwapBaseOut = "SwapBaseOut",
}

function from_u8(log_type: number): LogType {
  switch (log_type) {
    case 0:
      return LogType.Init;
    case 1:
      return LogType.Deposit;
    case 2:
      return LogType.Withdraw;
    case 3:
      return LogType.SwapBaseIn;
    case 4:
      return LogType.SwapBaseOut;
    default:
      throw new Error("Invalid log type value");
  }
}

export interface Log {
  log_type: LogType;
}

export interface InitLog extends Log {
  time: bigint; // u64
  pc_decimals: number; // u8
  coin_decimals: number; // u8
  pc_lot_size: bigint; // u64
  coin_lot_size: bigint; // u64
  pc_amount: bigint; // u64
  coin_amount: bigint; // u64
  market: string; // Pubkey
}

export interface DepositLog extends Log {
  // input
  max_coin: bigint; // u64
  max_pc: bigint; // u64
  base: bigint; // u64
  // pool info
  pool_coin: bigint; // u64
  pool_pc: bigint; // u64
  pool_lp: bigint; // u64
  calc_pnl_x: bigint; // u128
  calc_pnl_y: bigint; // u128
  // calc result
  deduct_coin: bigint; // u64
  deduct_pc: bigint; // u64
  mint_lp: bigint; // u64
}

export interface WithdrawLog extends Log {
  // input
  withdraw_lp: bigint; // u64
  // user info
  user_lp: bigint; // u64
  // pool info
  pool_coin: bigint; // u64
  pool_pc: bigint; // u64
  pool_lp: bigint; // u64
  calc_pnl_x: bigint; // u128
  calc_pnl_y: bigint; // u128
  // calc result
  out_coin: bigint; // u64
  out_pc: bigint; // u64
}

export interface SwapBaseInLog extends Log {
  // input
  amount_in: bigint;
  minimum_out: bigint;
  direction: bigint;
  // user info
  user_source: bigint;
  // pool info
  pool_coin: bigint;
  pool_pc: bigint;
  // calc result
  out_amount: bigint;
}

export interface SwapBaseOutLog extends Log {
  // input
  max_in: bigint; // u64
  amount_out: bigint; // u64
  direction: bigint; // u64
  // user info
  user_source: bigint; // u64
  // pool info
  pool_coin: bigint; // u64
  pool_pc: bigint; // u64
  // calc result
  deduct_in: bigint; // u64
}

const u64BytesToBigInt = (bytes: Uint8Array, offset: number): bigint => {
  return BigInt.asUintN(
    64,
    (BigInt(bytes[offset + 7]) << 56n) |
      (BigInt(bytes[offset + 6]) << 48n) |
      (BigInt(bytes[offset + 5]) << 40n) |
      (BigInt(bytes[offset + 4]) << 32n) |
      (BigInt(bytes[offset + 3]) << 24n) |
      (BigInt(bytes[offset + 2]) << 16n) |
      (BigInt(bytes[offset + 1]) << 8n) |
      BigInt(bytes[offset + 0]),
  );
};

const deserializeInitLog = (bytes: Uint8Array): InitLog => {
  let offset = 0;
  const log_type = from_u8(bytes[offset]);
  offset += 1;
  const time = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pc_decimals = bytes[offset];
  offset += 1;
  const coin_decimals = bytes[offset];
  offset += 1;
  const pc_lot_size = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const coin_lot_size = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pc_amount = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const coin_amount = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const market = new PublicKey(bytes.slice(offset)).toBase58();

  return {
    log_type,
    time,
    pc_decimals,
    coin_decimals,
    pc_lot_size,
    coin_lot_size,
    pc_amount,
    coin_amount,
    market,
  };
};

const deserializeDepositLog = (bytes: Uint8Array): DepositLog => {
  const offset = 0;
  const log_type = from_u8(bytes[offset]);

  return {
    log_type,
    max_coin: 0n,
    max_pc: 0n,
    base: 0n,
    pool_coin: 0n,
    pool_pc: 0n,
    pool_lp: 0n,
    calc_pnl_x: 0n,
    calc_pnl_y: 0n,
    deduct_coin: 0n,
    deduct_pc: 0n,
    mint_lp: 0n,
  };
};

const deserializeWithdrawLog = (bytes: Uint8Array): WithdrawLog => {
  const offset = 0;
  const log_type = from_u8(bytes[offset]);

  return {
    log_type,
    withdraw_lp: 0n,
    user_lp: 0n,
    pool_coin: 0n,
    pool_pc: 0n,
    pool_lp: 0n,
    calc_pnl_x: 0n,
    calc_pnl_y: 0n,
    out_coin: 0n,
    out_pc: 0n,
  };
};

const deserializeSwapBaseInLog = (bytes: Uint8Array): SwapBaseInLog => {
  let offset = 0;
  const log_type = from_u8(bytes[offset]);
  offset += 1;
  const amount_in = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const minimum_out = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const direction = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const user_source = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pool_coin = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pool_pc = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const out_amount = u64BytesToBigInt(bytes, offset);

  return {
    log_type,
    amount_in,
    minimum_out,
    direction,
    user_source,
    pool_coin,
    pool_pc,
    out_amount,
  };
};

const deserializeSwapBaseOutLog = (bytes: Uint8Array): SwapBaseOutLog => {
  let offset = 0;
  const log_type = from_u8(bytes[offset]);
  offset += 1;
  const max_in = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const amount_out = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const direction = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const user_source = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pool_coin = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const pool_pc = u64BytesToBigInt(bytes, offset);
  offset += 8;
  const deduct_in = u64BytesToBigInt(bytes, offset);

  return {
    log_type,
    max_in,
    amount_out,
    direction,
    user_source,
    pool_coin,
    pool_pc,
    deduct_in,
  };
};

const processLog = (bytes: Uint8Array): Log => {
  const logType = from_u8(bytes[0]);

  switch (logType) {
    case LogType.Init:
      return deserializeInitLog(bytes);
    case LogType.Deposit:
      return deserializeDepositLog(bytes);
    case LogType.Withdraw:
      return deserializeWithdrawLog(bytes);
    case LogType.SwapBaseIn:
      return deserializeSwapBaseInLog(bytes);
    case LogType.SwapBaseOut:
      return deserializeSwapBaseOutLog(bytes);
    default:
      throw new Error("Unknown LogType");
  }
};

function safeDecode(toDecode: string): string | undefined {
  try {
    return decode(toDecode);
  } catch {
    return undefined;
  }
}

export const decodeRayLog = (log: string): Log | undefined => {
  const decoded = safeDecode(log);
  if (decoded == undefined) return undefined;
  const intArray = [];
  for (let i = 0; i < decoded.length; i++) {
    intArray.push(decoded.charCodeAt(i));
  }
  return processLog(new Uint8Array(intArray));
};
