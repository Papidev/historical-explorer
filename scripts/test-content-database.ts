import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

const execute = promisify(execFile);
const run = async () => {
  const name = `historical-explorer-api-test-${randomUUID()}`;
  let created = false;
  try {
    await execute("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--env",
      "POSTGRES_DB=historical_explorer_test",
      "postgres:17-alpine",
    ]);
    created = true;
    const { stdout } = await execute("docker", ["port", name, "5432/tcp"]);
    const connectionString = `postgresql://postgres@${stdout.trim()}/historical_explorer_test`;
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          await pool.query("SELECT 1");
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      if (!ready) throw new Error("Test PostgreSQL did not become ready.");
    } finally {
      await pool.end();
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pnpm", ["exec", "vitest", "run", "src/server/content"], {
        stdio: "inherit",
        env: { ...process.env, HISTORICAL_EXPLORER_TEST_DATABASE_URL: connectionString },
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Content API tests failed.")),
      );
    });
  } finally {
    if (created) await execute("docker", ["rm", "--force", name]);
  }
};

run().catch(() => {
  console.error("Isolated content API database tests failed. Check Docker and the test output.");
  process.exitCode = 1;
});
