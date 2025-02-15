import dotenv from "dotenv";
import { runArchiver } from "./archive";

dotenv.config();

process.env.RUN_ARCHIVER = "1";

runArchiver();
