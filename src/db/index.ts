import { Pool } from "@neondatabase/serverless";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const globalPool = globalThis as typeof globalThis & { textileDbPool?: Pool };
export const pool = globalPool.textileDbPool ?? new Pool({ connectionString: url, max: 5 });
if (process.env.NODE_ENV !== "production") globalPool.textileDbPool = pool;
export const db = drizzleHttp(neon(url), { schema });
export const txDb = drizzlePool(pool, { schema });
