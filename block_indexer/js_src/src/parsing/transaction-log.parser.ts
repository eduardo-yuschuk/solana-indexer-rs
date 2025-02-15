import { PublicKey } from "@solana/web3.js";
import { Transaction2 } from "./auxiliar/datatypes";

class InvokeNode {
  address: PublicKey;
  stackHeight: number;
  logs: string[] = [];
  childNodes: InvokeNode[] = [];
  parentNode: InvokeNode | undefined;
  outcome: string | undefined;
  constructor(logMessage: string, address: PublicKey, stackHeight: number) {
    this.logs.push(logMessage);
    this.address = address;
    this.stackHeight = stackHeight;
  }
  addChild(node: InvokeNode) {
    this.childNodes.push(node);
    node.setParentNode(this);
  }
  setParentNode(node: InvokeNode) {
    if (this.parentNode != undefined) {
      throw new Error("Parent node set twice");
    }
    this.parentNode = node;
  }
  addLogMessage(logMessage: string) {
    this.logs.push(logMessage);
  }
  close(logMessage: string, address: PublicKey, outcome: string) {
    if (!this.address.equals(address)) {
      throw new Error("Closing a different node");
    }
    if (this.outcome != undefined) {
      throw new Error("Closing node twice");
    }
    this.addLogMessage(logMessage);
    this.outcome = outcome;
  }
  truncate(logMessage: string) {
    if (this.outcome != undefined) {
      throw new Error("Closing node twice");
    }
    this.addLogMessage(logMessage);
    this.outcome = "truncated";
  }
  toString(): string {
    return `${this.logs[0]}, parent: ${this.parentNode?.toString()}`;
  }
}

export interface InstructionLogs {
  address: string;
  logMessages: string[];
}

export const parseLogMessages = (logMessages: string[]): InstructionLogs[] => {
  // log representation
  const nodes: InvokeNode[] = [];
  let currentNode: InvokeNode | undefined;

  // log representation actions
  const addNewNode = (invokeResult: RegExpMatchArray) => {
    const logMessage = invokeResult[0];
    const address = new PublicKey(invokeResult[1]);
    const stackHeight = Number.parseInt(invokeResult[2]);
    const node = new InvokeNode(logMessage, address, stackHeight);
    if (currentNode == undefined) {
      currentNode = node;
      nodes.push(node);
    } else {
      currentNode.addChild(node);
      currentNode = node;
    }
  };

  const closeNode = (invokeEndResult: RegExpMatchArray) => {
    const logMessage = invokeEndResult[0];
    const address = new PublicKey(invokeEndResult[1]);
    const outcome = invokeEndResult[2];

    if (currentNode == undefined) {
      throw new Error("There is no current node");
    }

    currentNode.close(logMessage, address, outcome);

    currentNode = currentNode.parentNode;
  };

  const truncateNode = (logMessage: string) => {
    // a "Log truncated" might appear before creating a node at level 0
    if (currentNode) {
      currentNode.truncate(logMessage);
      // truncated data is discarded (no logs.push)
      currentNode = currentNode.parentNode;
    }
  };

  const addLog = (logMessage: string) => {
    if (currentNode == undefined) {
      throw new Error("There is no current node");
    }
    currentNode.addLogMessage(logMessage);
  };

  // log parsing rules
  // INVOKE
  // Program ComputeBudget111111111111111111111111111111 invoke [1]
  const invokeRegex =
    /^Program\s([1-9A-HJ-NP-Za-km-z]{32,44})\sinvoke\s\[(\d+)\]$/;

  // ENVOKE END
  // Program ComputeBudget111111111111111111111111111111 success
  // Program 8BR3zs8zSXetpnDjCtHWnkpSkNSydWb3PTTDuVKku2uu failed: custom program error: 0x2
  const invokeEndRegex =
    /^Program\s([1-9A-HJ-NP-Za-km-z]{32,44})\s(success|failed:.*)$/;

  // LOG TRUNCATION
  const logTruncationString = "Log truncated";

  let logTruncated = false;

  logMessages.forEach((logMessage) => {
    if (!logTruncated) {
      const invokeResult = logMessage.match(invokeRegex);
      if (invokeResult) {
        addNewNode(invokeResult);
      } else {
        const invokeEndResult = logMessage.match(invokeEndRegex);
        if (invokeEndResult) {
          closeNode(invokeEndResult);
        } else {
          if (logMessage == logTruncationString) {
            logTruncated = true;
            truncateNode(logMessage);
          } else {
            addLog(logMessage);
          }
        }
      }
    }
  });

  if (!logTruncated && currentNode != undefined) {
    console.error("LOG PARSER: logs parsing incomplete");
    return [];
  }

  // save data to return
  const logs: InstructionLogs[] = [];

  for (const node of nodes) {
    addLogsSequentially(node, logs);
  }

  return logs;
};

const addLogsSequentially = (
  currentNode: InvokeNode,
  logs: InstructionLogs[],
) => {
  logs.push({
    address: currentNode.address.toBase58(),
    logMessages: currentNode.logs,
  });
  for (const childNode of currentNode.childNodes) {
    addLogsSequentially(childNode, logs);
  }
};

export const parseTransactionLogs = (
  transactionObject: Transaction2,
): InstructionLogs[] => {
  // transaction data
  const { meta } = transactionObject;
  const { logMessages } = meta;

  try {
    return parseLogMessages(logMessages);
  } catch (err) {
    console.error(`LOG PARSER: error`);
    const { transaction } = transactionObject;
    console.error(`transaction: ${transaction.signatures[0]}`);
    console.error(err);
    return [];
  }
};
