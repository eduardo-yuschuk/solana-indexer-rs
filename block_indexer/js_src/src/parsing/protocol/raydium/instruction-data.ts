export enum RaydiumInstructionType {
  Initialize = "Initialize",
  Initialize2 = "Initialize2",
  MonitorStep = "MonitorStep",
  Deposit = "Deposit",
  Withdraw = "Withdraw",
  MigrateToOpenBook = "MigrateToOpenBook",
  SetParams = "SetParams",
  WithdrawPnl = "WithdrawPnl",
  WithdrawSrm = "WithdrawSrm",
  SwapBaseIn = "SwapBaseIn",
  PreInitialize = "PreInitialize",
  SwapBaseOut = "SwapBaseOut",
  SimulateInfo = "SimulateInfo",
  AdminCancelOrders = "AdminCancelOrders",
  CreateConfigAccount = "CreateConfigAccount",
  UpdateConfigAccount = "UpdateConfigAccount",
  Unknown = "Unknown",
}

export interface RaydiumInstructionData {
  instructionType: RaydiumInstructionType;
  instructionValues: IRaydiumInstructionValues | undefined;
}

export interface IPumpfunInstructionValues {}

export interface IRaydiumInstructionValues {}

// tokenAmount: u64
// collateralAmount: u64
// fixedSide: u8
// slippageBps: u64

export interface RaydiumInitialize2Values extends IRaydiumInstructionValues {
  discriminator: number;
  nonce: number;
  openTime: bigint;
  initPcAmount: bigint;
  initCoinAmount: bigint;
}

export interface RaydiumSwapBaseInValues extends IRaydiumInstructionValues {
  discriminator: number;
  amountIn: bigint;
  minimumAmountOut: bigint;
}

export interface RaydiumSwapBaseOutValues extends IRaydiumInstructionValues {
  discriminator: number;
  maxAmountIn: bigint;
  amountOut: bigint;
}
