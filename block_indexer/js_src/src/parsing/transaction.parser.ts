import { IEvent, TransactionParserArguments } from "./auxiliar/parsing";
import { parseInstruction } from "./instruction.parser";
import { Instruction } from "./auxiliar/datatypes";
import {
  InstructionLogs,
  parseTransactionLogs,
} from "./transaction-log.parser";
import { PublicKey } from "@solana/web3.js";

const asStringArray = (keys: PublicKey[] | string[]): string[] => {
  if (keys.length == 0) return [];
  if (keys[0] instanceof PublicKey) {
    return (keys as PublicKey[]).map((key: PublicKey) => key.toBase58());
  }
  return keys as string[];
};

export const parseTransaction = (
  args: TransactionParserArguments,
): IEvent[] => {
  const { slot, blockObject, transactionObject, parsers } = args;
  const { transaction, meta } = transactionObject;

  // This join of accounts is the complete view of accounts used by all instructions (including inner ones at all levels)

  let addresses: string[];
  if (transaction.message.accountKeys) {
    addresses = [
      ...asStringArray(transaction.message.accountKeys),
      ...asStringArray(meta.loadedAddresses.writable),
      ...asStringArray(meta.loadedAddresses.readonly),
    ];
  } else {
    addresses = [
      ...asStringArray(transaction.message.staticAccountKeys),
      ...asStringArray(meta.loadedAddresses.writable),
      ...asStringArray(meta.loadedAddresses.readonly),
    ];
  }

  const events: IEvent[] = [];

  const instructionsLogMessages: InstructionLogs[] =
    parseTransactionLogs(transactionObject);

  parsers.forEach((parser) => {
    events.push(
      ...parser.parseTransaction({
        slot,
        blockObject,
        transactionObject,
        instructionsLogMessages,
        addresses,
      }),
    );
  });

  let instructions = transaction.message.instructions;
  if (instructions == undefined) {
    instructions = transaction.message.compiledInstructions;
  }

  // indexedLogMessages will be mutated within this call (shift)
  instructions.forEach((instruction: Instruction, instructionIndex: number) => {
    events.push(
      ...parseInstruction({
        slot,
        blockObject,
        transactionObject,
        instruction,
        instructionIndex,
        parsers,
        addresses,
        instructionsLogMessages,
      }),
    );
  });

  if (instructionsLogMessages.length > 0) {
    console.error("There are pending log messages!");
  }

  return events;
};
