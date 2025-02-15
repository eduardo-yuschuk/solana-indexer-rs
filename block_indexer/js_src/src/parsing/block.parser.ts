import { Block, Transaction2 } from "./auxiliar/datatypes";
import { IEvent, IParser } from "./auxiliar/parsing";
import { parseTransaction } from "./transaction.parser";

export const parseBlock = (
  slot: number,
  blockObject: Block,
  parsers: IParser[],
): { events: IEvent[]; elapsedTime: number } => {
  const begin = performance.now();

  const events: IEvent[] = [];

  const { transactions } = blockObject;

  transactions.forEach(
    (transactionObject: Transaction2, transactionIndex: number) => {
      events.push(
        ...parseTransaction({
          slot,
          blockObject,
          transactionObject,
          transactionIndex,
          parsers,
        }),
      );
    },
  );

  const end = performance.now();

  return { events, elapsedTime: end - begin };
};
