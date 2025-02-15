import {
  IEvent,
  IParser,
  ParseInstructionArguments,
  ParseTransactionArguments,
  getAddressAsString,
} from "../../auxiliar/parsing";
import {
  decodeSplProgramInstructionData,
  decodeSystemProgramInstructionData,
} from "./solana.decoder";
import {
  SplInstructionData,
  SplInstructionType,
  SystemInstructionData,
  SystemInstructionType,
} from "./instruction-data";
import { GenericEventType, IndexerEventSource } from "../../../event";

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

export const SolanaParser: IParser = {
  parseInstruction(args: ParseInstructionArguments): IEvent[] {
    return parseInstructionImpl(args);
  },

  parseTransaction(args: ParseTransactionArguments): IEvent[] {
    return parseTransactionImpl(args);
  },
};

export function getTokenBalances(
  meta: any,
  accountId: number,
): {
  preBalances: any[];
  postBalances: any[];
} {
  const preBalances: any[] = meta.preTokenBalances.filter(
    (balance: any) => balance.accountIndex === accountId,
  );
  const postBalances: any[] = meta.postTokenBalances.filter(
    (balance: any) => balance.accountIndex === accountId,
  );
  return {
    preBalances,
    postBalances,
  };
}

export function getBalances(
  meta: any,
  accountId: number,
): {
  preBalance: any;
  postBalance: any;
} {
  const preBalance = meta.preBalances[accountId];
  const postBalance = meta.postBalances[accountId];
  return {
    preBalance,
    postBalance,
  };
}

const parseInstructionImpl = (args: ParseInstructionArguments): IEvent[] => {
  const { addresses, instruction } = args;

  const programId = addresses[instruction.programIdIndex];

  if (programId == SPL_TOKEN_PROGRAM_ID) {
    return parseTokenProgramCall(args);
  }

  if (programId == SYSTEM_PROGRAM_ID) {
    return parseSystemProgramCall(args);
  }

  if (programId == ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID) {
    return parseAssociatedTokenAccountProgramCall(args);
  }

  return [];
};

const parseTokenProgramCall = (args: ParseInstructionArguments): IEvent[] => {
  const {
    slot,
    blockObject: _blockObject,
    transactionObject,
    addresses,
    instruction,
  } = args;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  const decodedInstruction = decodeSplProgramInstructionData(instruction.data);
  switch (decodedInstruction.instructionType) {
    case SplInstructionType.Transfer: {
      const transferEvent = createSplProgramTransferEvent(
        slot,
        signature,
        decodedInstruction,
        addresses,
        instruction,
        failedTransaction,
      );

      // those are the account indexes in the instruction
      // 0 - source
      // 1 - destination
      // 2 - authority

      const accountIndexes =
        instruction.accounts ?? instruction.accountKeyIndexes;

      const sourceAccountId = accountIndexes[0];
      const destinationAccountId = accountIndexes[1];

      const sourceBalances = getTokenBalances(meta, sourceAccountId);
      const sourceAccount = transferEvent.eventMeta.source;
      const sourceBalance =
        sourceBalances.postBalances[0] ?? sourceBalances.preBalances[0];
      const sourceMint = sourceBalance?.mint;
      const sourceOwner = sourceBalance?.owner;
      const sourceDecimals = sourceBalance?.uiTokenAmount?.decimals;

      const destinationBalances = getTokenBalances(meta, destinationAccountId);
      const destinationAccount = transferEvent.eventMeta.destination;
      const destinationBalance =
        destinationBalances.postBalances[0] ??
        destinationBalances.preBalances[0];
      const destinationMint = destinationBalance?.mint;
      const destinationOwner = destinationBalance?.owner;
      const destinationDecimals = destinationBalance?.uiTokenAmount?.decimals;

      const mint = sourceMint ?? destinationMint;
      const from = sourceOwner ?? transferEvent.eventMeta.authority;
      const decimals = sourceDecimals ?? destinationDecimals;

      if (
        mint &&
        from &&
        destinationOwner &&
        sourceAccount &&
        destinationAccount &&
        decimals
      ) {
        (transferEvent.eventMeta as any).mint = mint;
        (transferEvent.eventMeta as any).fromAddress = from;
        (transferEvent.eventMeta as any).toAddress = destinationOwner;
        (transferEvent.eventMeta as any).fromTokenAccount = sourceAccount;
        (transferEvent.eventMeta as any).toTokenAccount = destinationAccount;
        (transferEvent.eventMeta as any).decimals = decimals;

        events.push(transferEvent);
      }
      break;
    }
    case SplInstructionType.TransferChecked: {
      const transferCheckedEvent = createSplProgramTransferCheckedEvent(
        slot,
        signature,
        decodedInstruction,
        addresses,
        instruction,
        failedTransaction,
      );

      // those are the account indexes in the instruction
      // 0 - source
      // 1 - mint
      // 2 - destination
      // 3 - authority

      const accountIndexes =
        instruction.accounts ?? instruction.accountKeyIndexes;

      const sourceAccountId = accountIndexes[0];
      const destinationAccountId = accountIndexes[2];

      // retrieve the mint and owners of the source and destination token accounts
      // we disregard the amounts in this case

      const sourceBalances = getTokenBalances(meta, sourceAccountId);
      const sourceAccount = transferCheckedEvent.eventMeta.source;
      const sourceBalance =
        sourceBalances.postBalances[0] ?? sourceBalances.preBalances[0];
      const sourceMint = sourceBalance?.mint;
      const sourceOwner = sourceBalance?.owner;
      const sourceDecimals = sourceBalance?.uiTokenAmount?.decimals;

      const destinationBalances = getTokenBalances(meta, destinationAccountId);
      const destinationAccount = transferCheckedEvent.eventMeta.destination;
      const destinationBalance =
        destinationBalances.postBalances[0] ??
        destinationBalances.preBalances[0];
      const destinationMint = destinationBalance?.mint;
      const destinationOwner = destinationBalance?.owner;
      const destinationDecimals = destinationBalance?.uiTokenAmount?.decimals;

      const mint = sourceMint ?? destinationMint;
      const from = sourceOwner ?? transferCheckedEvent.eventMeta.authority;
      const decimals = sourceDecimals ?? destinationDecimals;

      if (
        mint &&
        from &&
        destinationOwner &&
        sourceAccount &&
        destinationAccount &&
        decimals
      ) {
        (transferCheckedEvent.eventMeta as any).mint = mint;
        (transferCheckedEvent.eventMeta as any).fromAddress = from;
        (transferCheckedEvent.eventMeta as any).toAddress = destinationOwner;
        (transferCheckedEvent.eventMeta as any).fromTokenAccount =
          sourceAccount;
        (transferCheckedEvent.eventMeta as any).toTokenAccount =
          destinationAccount;
        (transferCheckedEvent.eventMeta as any).decimals = decimals;

        events.push(transferCheckedEvent);
      }
      break;
    }
    default: {
    }
  }

  return events;
};

const parseSystemProgramCall = (args: ParseInstructionArguments): IEvent[] => {
  const {
    slot,
    blockObject: _blockObject,
    transactionObject,
    addresses,
    instruction,
  } = args;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const failedTransaction = meta.err != null;

  const events: IEvent[] = [];

  const decodedInstruction = decodeSystemProgramInstructionData(
    instruction.data,
  );

  switch (decodedInstruction.instructionType) {
    case SystemInstructionType.Transfer: {
      const transferEvent = createSystemProgramTransferEvent(
        slot,
        signature,
        decodedInstruction,
        addresses,
        instruction,
        failedTransaction,
      );
      events.push(transferEvent);
      break;
    }
    default: {
    }
  }

  return events;
};

const createSplProgramTransferEvent = (
  slot: number,
  signature: string,
  decodedInstruction: SplInstructionData,
  addresses: string[],
  instruction: any,
  failedTransaction: boolean,
) => {
  return {
    source: IndexerEventSource.Solana,
    type: GenericEventType.SplTokenTransfer,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      source: getAddressAsString(0, addresses, instruction),
      destination: getAddressAsString(1, addresses, instruction),
      authority: getAddressAsString(2, addresses, instruction),
      failedTransaction,
    },
  };
};

const createSplProgramTransferCheckedEvent = (
  slot: number,
  signature: string,
  decodedInstruction: SplInstructionData,
  addresses: string[],
  instruction: any,
  failedTransaction: boolean,
) => {
  return {
    source: IndexerEventSource.Solana,
    type: GenericEventType.SplTokenTransfer,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      source: getAddressAsString(0, addresses, instruction),
      mint: getAddressAsString(1, addresses, instruction),
      destination: getAddressAsString(2, addresses, instruction),
      authority: getAddressAsString(3, addresses, instruction),
      failedTransaction,
    },
  };
};

const createSystemProgramTransferEvent = (
  slot: number,
  signature: string,
  decodedInstruction: SystemInstructionData,
  addresses: string[],
  instruction: any,
  failedTransaction: boolean,
) => {
  return {
    source: IndexerEventSource.Solana,
    type: GenericEventType.SolTransfer,
    slot,
    signature,
    eventObj: decodedInstruction,
    eventMeta: {
      fromAddress: getAddressAsString(0, addresses, instruction),
      toAddress: getAddressAsString(1, addresses, instruction),
      failedTransaction,
    },
  };
};

const parseAssociatedTokenAccountProgramCall = (
  _args: ParseInstructionArguments,
): IEvent[] => {
  return [];
};

const parseTransactionImpl = (args: ParseTransactionArguments): IEvent[] => {
  const { slot, transactionObject, addresses } = args;
  const { transaction, meta } = transactionObject;
  const signature = transaction.signatures[0];
  const failedTransaction = meta.err != null;

  if (failedTransaction) {
    return [];
  }

  const events: IEvent[] = [];

  for (const [index, address] of addresses.entries()) {
    const preBalances: any[] = meta.preTokenBalances.filter(
      (balance: any) => balance.accountIndex === index,
    );

    const postBalances: any[] = meta.postTokenBalances.filter(
      (balance: any) => balance.accountIndex === index,
    );

    if (preBalances.length == 0 && postBalances.length == 0) {
      continue;
    }

    const tokenAccount = address;
    const {
      owner: preOwner,
      mint: preMint,
      uiTokenAmount: preUiTokenAmount,
    } = preBalances[0] ?? {};
    const {
      owner: postOwner,
      mint: postMint,
      uiTokenAmount: postUiTokenAmount,
    } = postBalances[0] ?? {};

    const { decimals: preDecimals, amount: preAmount } = preUiTokenAmount ?? {};
    const { decimals: postDecimals, amount: postAmount } =
      postUiTokenAmount ?? {};

    const owner = postOwner ?? preOwner;
    const mint = postMint ?? preMint;
    const decimals = postDecimals ?? preDecimals;

    if (
      owner === undefined ||
      mint === undefined ||
      tokenAccount === undefined ||
      decimals === undefined
    ) {
      throw new Error("Invalid balance change event data");
    }

    const oldAmountStr = preAmount ?? "0";
    const newAmountStr = postAmount ?? "0";
    const oldAmount = BigInt(oldAmountStr);
    const newAmount = BigInt(newAmountStr);

    if (oldAmount == newAmount) {
      continue;
    }

    events.push(
      createSplTokenBalanceChangeEvent(
        slot,
        signature,
        owner,
        mint,
        tokenAccount,
        oldAmount,
        newAmount,
        decimals,
        failedTransaction,
      ),
    );
  }

  return events;
};

const createSplTokenBalanceChangeEvent = (
  slot: number,
  signature: string,
  owner: string,
  mint: string,
  tokenAccount: string,
  oldAmount: bigint,
  newAmount: bigint,
  decimals: number,
  failedTransaction: boolean,
) => {
  return {
    source: IndexerEventSource.Solana,
    type: GenericEventType.SplTokenBalanceChange,
    slot,
    signature,
    eventObj: {
      owner,
      mint,
      tokenAccount,
      oldAmount,
      newAmount,
      decimals,
    },
    eventMeta: {
      failedTransaction,
    },
  };
};
