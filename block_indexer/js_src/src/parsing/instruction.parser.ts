import { IEvent, InstructionParserArguments } from "./auxiliar/parsing";

const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";
// const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

const PROGRAM_IDS_TO_IGNORE = [
  VOTE_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  // Note: System program is not ignored because it is used in the transfers parsing
  //SYSTEM_PROGRAM_ID,
];

export const parseInstruction = (
  args: InstructionParserArguments,
): IEvent[] => {
  const {
    slot,
    blockObject,
    transactionObject,
    instruction,
    instructionIndex,
    parsers,
    addresses,
    instructionsLogMessages,
  } = args;

  const events: IEvent[] = [];

  const programId = addresses[instruction.programIdIndex];

  if (!PROGRAM_IDS_TO_IGNORE.includes(programId)) {
    // parse the instruction
    parsers.forEach((parser) => {
      events.push(
        ...parser.parseInstruction({
          slot,
          blockObject,
          transactionObject,
          instruction,
          instructionIndex,
          parentInstruction: undefined,
          addresses,
          instructionsLogMessages,
        }),
      );
    });
  }

  // remove log message reference after parsing
  instructionsLogMessages.shift();

  const { meta } = transactionObject;
  const innerInstructions = meta.innerInstructions;

  // look for inner instructions
  const innerGroup = innerInstructions.find(
    (group: any) => group.index == instructionIndex,
  );

  if (innerGroup !== undefined) {
    innerGroup.instructions.forEach(
      (innerInstruction: any, innerInstructionIndex: number) => {
        const programId = addresses[innerInstruction.programIdIndex];

        if (!PROGRAM_IDS_TO_IGNORE.includes(programId)) {
          // parse every inner instruction
          parsers.forEach((parser) => {
            events.push(
              ...parser.parseInstruction({
                slot,
                blockObject,
                transactionObject,
                instruction: innerInstruction,
                instructionIndex: innerInstructionIndex,
                parentInstruction: instruction,
                addresses,
                instructionsLogMessages,
              }),
            );
          });
        }

        // remove log message reference after parsing
        instructionsLogMessages.shift();
      },
    );
  }

  return events;
};
