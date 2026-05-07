import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema/index";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

/**
 * Common Postgres-flavoured Drizzle DB type satisfied by BOTH the
 * production `postgres-js` client and the `pglite` in-memory client
 * used in tests. Use this for `dbInstance` parameters in `apps/web/lib`
 * so test code can pass a `TestDatabase` without `as any` and without
 * widening to a generic that drops schema relations.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
