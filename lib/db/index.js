import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";

// Reuse a single client/db across hot reloads in dev so we don't open a new
// pool of connections to Supabase on every edit.
const globalForDb = globalThis;

function createDb() {
  // Note: the original stall we hit here was many CONCURRENT queries
  // (Promise.all) pipelined over one connection through Supabase's
  // transaction-mode pooler — fixed by making lib/data.js's queries
  // sequential instead, not by shrinking this pool. A single-connection
  // pool would otherwise serialize every concurrent request across the
  // whole app behind one connection, which doesn't scale past one user.
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 10, connect_timeout: 10 });
  return drizzle(client, { schema });
}

export const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}
