import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Existing filesystem fixtures resolve local data inside their temporary cwd.
  test: { env: { HISTORICAL_EXPLORER_LOCAL_DATA_DIR: "data" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
