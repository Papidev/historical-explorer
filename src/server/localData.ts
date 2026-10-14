import { homedir } from "node:os";
import path from "node:path";

export const getLocalDataDirectory = () =>
  path.resolve(
    process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR ||
      path.join(homedir(), ".local", "share", "historical-explorer"),
  );
