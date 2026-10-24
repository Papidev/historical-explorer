import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolConfig } from "pg";

export class ContentDatabaseConfigurationError extends Error {}

// Parse fields explicitly: pg connection-string SSL options must never override verified TLS.
export const contentDatabaseConfig = (
  environment: Record<string, string | undefined>,
): PoolConfig => {
  if (!environment.CONTENT_DATABASE_URL || !environment.CONTENT_DATABASE_CA)
    throw new ContentDatabaseConfigurationError("Content database configuration is missing.");
  let target: URL;
  try {
    target = new URL(environment.CONTENT_DATABASE_URL);
  } catch {
    throw new ContentDatabaseConfigurationError("Invalid content database configuration.");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !target.username ||
    !target.password ||
    target.search ||
    !target.pathname.slice(1)
  )
    throw new ContentDatabaseConfigurationError("Invalid content database configuration.");
  if (
    environment.VERCEL &&
    (!target.hostname.endsWith(".pooler.supabase.com") || target.port !== "6543")
  )
    throw new ContentDatabaseConfigurationError("Vercel requires the Supabase transaction pooler.");
  try {
    return {
      host: target.hostname,
      port: Number(target.port || 5432),
      user: decodeURIComponent(target.username),
      password: decodeURIComponent(target.password),
      database: decodeURIComponent(target.pathname.slice(1)),
      ssl: { ca: environment.CONTENT_DATABASE_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true },
      sslnegotiation: "postgres",
      max: 1,
      min: 0,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 20000,
      query_timeout: 25000,
      idle_in_transaction_session_timeout: 25000,
      maxLifetimeSeconds: 60,
      keepAlive: true,
    };
  } catch {
    throw new ContentDatabaseConfigurationError("Invalid content database configuration.");
  }
};

let pool: Pool | undefined;
export const getContentPool = () => {
  if (!pool) {
    pool = new Pool(contentDatabaseConfig(process.env));
    // pg removes errored idle clients. Never log the driver error or credentials.
    pool.on("error", () => console.error("Content database idle connection failed."));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
};
