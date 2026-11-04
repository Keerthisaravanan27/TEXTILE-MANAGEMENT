import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { verify } from "argon2";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, authSessions, users } from "@/db/schema";
import { clearLoginAttempts, recordLoginAttempt } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [Credentials({
    credentials: { username: { label: "Username", type: "text" }, password: { label: "Password", type: "password" } },
    async authorize(credentials, request) {
      const parsed = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(128) }).safeParse(credentials);
      if (!parsed.success) return null;
      const username = parsed.data.username.toLowerCase();
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
      const identity = `${username}:${ip}`;
      if (!await recordLoginAttempt(identity)) return null;
      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (!user?.active || !user.passwordHash || !await verify(user.passwordHash, parsed.data.password).catch(() => false)) return null;
      await clearLoginAttempts(identity);
      await db.insert(auditLogs).values({ companyId: user.companyId, userId: user.id, action: "auth.login", entity: "user", recordId: user.id });
      return { id: user.id, name: user.name, email: user.email };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const sessionId = randomUUID();
        const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
        await db.insert(authSessions).values({ id: sessionId, userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 24 * 14 * 1000) });
        token.sessionId = sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      if (session.user && typeof token.sessionId === "string") session.user.sessionId = token.sessionId;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sessionId === "string") {
        await db.delete(authSessions).where(eq(authSessions.id, message.token.sessionId));
        if (message.token.sub) await db.insert(auditLogs).values({ userId: message.token.sub, action: "auth.logout", entity: "user", recordId: message.token.sub });
      }
    },
  },
});
