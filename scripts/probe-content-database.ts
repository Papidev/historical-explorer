import { Pool } from "pg";
import {
  ContentDatabaseConfigurationError,
  contentDatabaseConfig,
} from "../src/server/content/database";

// Run from the environment being evaluated. This never runs schema or content writes.
const run = async () => {
  const config = contentDatabaseConfig(process.env);
  const results: { kind: string; ok: boolean; milliseconds: number; code?: string }[] = [];
  const sample = async (pool: Pool, kind: string) => {
    const started = Date.now();
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN READ ONLY");
      const {
        rows: [result],
      } = await client.query(
        "SELECT current_setting('transaction_read_only') AS read_only, 1 AS healthy",
      );
      if (result.read_only !== "on" || result.healthy !== 1)
        throw new Error("Unexpected probe response.");
      await client.query("COMMIT");
      results.push({ kind, ok: true, milliseconds: Date.now() - started });
    } catch (error) {
      // Drop this connection, including unknown transaction outcomes. Do not retry writes.
      if (client) {
        client.release(true);
        client = undefined;
      }
      const code =
        error instanceof Error &&
        /^(Received invalid response to SSL negotiation|There was an error establishing an SSL connection|The server does not support SSL connections)/.test(
          error.message,
        )
          ? "SSL_NEGOTIATION_FAILED"
          : error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "connection-failed";
      results.push({
        kind,
        ok: false,
        milliseconds: Date.now() - started,
        code: /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : "connection-failed",
      });
    } finally {
      client?.release();
    }
  };
  for (let i = 0; i < 10; i++) {
    const pool = new Pool(config);
    pool.on("error", () => {});
    try {
      await sample(pool, "fresh");
    } finally {
      await pool.end();
    }
  }
  const pool = new Pool(config);
  pool.on("error", () => {});
  try {
    for (let i = 0; i < 10; i++) await sample(pool, "reused");
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await sample(pool, "after-idle");
  } finally {
    await pool.end();
  }
  console.log(
    JSON.stringify(
      {
        environment: process.env.VERCEL ? "vercel" : "local",
        tlsCertificateVerification: true,
        poolMax: config.max,
        port: config.port,
        results,
      },
      null,
      2,
    ),
  );
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
};

run().catch((error: unknown) => {
  console.error(
    error instanceof ContentDatabaseConfigurationError
      ? error.message
      : "Database probe could not start. Check server configuration; no credentials are logged.",
  );
  process.exitCode = 1;
});
