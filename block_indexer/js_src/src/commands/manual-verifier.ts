import { indexBlock } from "../verifier";

const main = async () => {
  try {
    const missingSlot = 302128636;
    await indexBlock(missingSlot);
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

main();
