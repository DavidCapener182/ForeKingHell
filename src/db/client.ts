import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "@/db/schema";

let client: Sql | null = null;
let db: PostgresJsDatabase<typeof schema> | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to save imported shots.");
  }

  return databaseUrl;
}

export function getDb() {
  if (!client) {
    client = postgres(getDatabaseUrl(), { prepare: false });
  }

  if (!db) {
    db = drizzle(client, { schema });
  }

  return db;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}
