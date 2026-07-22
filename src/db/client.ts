import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "@/db/schema";

type DatabaseGlobals = {
  client: Sql | null;
  db: PostgresJsDatabase<typeof schema> | null;
};

const databaseGlobals = globalThis as typeof globalThis & {
  __forekinghellDb?: DatabaseGlobals;
};

function getDatabaseGlobals() {
  databaseGlobals.__forekinghellDb ??= {
    client: null,
    db: null,
  };

  return databaseGlobals.__forekinghellDb;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to save imported shots.");
  }

  return databaseUrl;
}

export function getDb() {
  const state = getDatabaseGlobals();

  if (!state.client) {
    state.client = postgres(getDatabaseUrl(), {
      prepare: false,
      max: Number(
        process.env.DATABASE_POOL_MAX ?? (process.env.NODE_ENV === "production" ? 10 : 3),
      ),
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
  }

  if (!state.db) {
    state.db = drizzle(state.client, { schema });
  }

  return state.db;
}

export async function closeDb() {
  const state = getDatabaseGlobals();

  if (state.client) {
    await state.client.end();
    state.client = null;
    state.db = null;
  }
}
