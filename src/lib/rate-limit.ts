import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const identifierHash = (identity: string) => createHash("sha256").update(identity).digest("hex");
export async function recordLoginAttempt(identity: string) {
  const key = identifierHash(identity);
  const [row] = await db.insert(loginAttempts).values({ identifierHash: key, attempts: 1, windowStartedAt: new Date() })
    .onConflictDoUpdate({ target: loginAttempts.identifierHash, set: {
      attempts: sql`case when ${loginAttempts.windowStartedAt} < now() - interval '15 minutes' then 1 else ${loginAttempts.attempts} + 1 end`,
      windowStartedAt: sql`case when ${loginAttempts.windowStartedAt} < now() - interval '15 minutes' then now() else ${loginAttempts.windowStartedAt} end`,
      lockedUntil: sql`case when ${loginAttempts.windowStartedAt} < now() - interval '15 minutes' then null when ${loginAttempts.attempts} + 1 >= 10 then now() + interval '15 minutes' else ${loginAttempts.lockedUntil} end`,
    } }).returning();
  return !row.lockedUntil || row.lockedUntil <= new Date();
}
export async function clearLoginAttempts(identity: string) { await db.delete(loginAttempts).where(eq(loginAttempts.identifierHash, identifierHash(identity))); }
