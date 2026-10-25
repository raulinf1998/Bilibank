import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

/**
 * Migraciones ligeras para bases de datos creadas con versiones anteriores.
 * `docker/init.sql` sólo se ejecuta con el volumen vacío, así que las columnas
 * nuevas se añaden aquí de forma idempotente (una vez por proceso).
 */
const globalForMigrations = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlMigrations?: Promise<void>;
};

export function ensureSchema(): Promise<void> {
  globalForMigrations.__arenaNextJsPostgresqlMigrations ??= (async () => {
    try {
      await pool.query("ALTER TABLE design_preferences ADD COLUMN IF NOT EXISTS card_style_key text");
      await pool.query("ALTER TABLE design_preferences ADD COLUMN IF NOT EXISTS tx_limit integer");
    } catch {
      // La tabla aún no existe (primer arranque): init.sql la creará completa.
    }
  })();
  return globalForMigrations.__arenaNextJsPostgresqlMigrations;
}
