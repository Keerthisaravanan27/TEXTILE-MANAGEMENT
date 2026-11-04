import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { companies, companySettings, permissions, roles, setupState, users, userRoles, rolePermissions } from "@/db/schema";

export const runtime = "nodejs";
const schema = z.object({ companyName: z.string().trim().min(2).max(160), username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/), password: z.string().min(8).max(128) });
const permissionNames = ["parties.read", "parties.write", "products.read", "products.write", "purchases.read", "purchases.write", "inventory.read", "inventory.write", "sales.read", "sales.write", "payments.read", "payments.write", "expenses.read", "expenses.write", "reports.read", "settings.write", "users.write"];

export async function GET() {
  const [state] = await db.select({ completed: setupState.completed }).from(setupState).where(eq(setupState.id, 1));
  return NextResponse.json({ setupRequired: !state?.completed });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a company, owner, valid email, and password of at least 12 characters." }, { status: 400 });
  const passwordHash = await hash(parsed.data.password, { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  try {
    await txDb.transaction(async tx => {
      await tx.insert(setupState).values({ id: 1, completed: false }).onConflictDoNothing();
      const [state] = await tx.select().from(setupState).where(eq(setupState.id, 1)).for("update");
      if (state.completed) throw new Error("SETUP_ALREADY_COMPLETE");
      const [company] = await tx.insert(companies).values({ name: parsed.data.companyName }).returning({ id: companies.id });
      await tx.insert(companySettings).values({ companyId: company.id });
      const [ownerRole] = await tx.insert(roles).values({ companyId: company.id, name: "Owner", description: "Full access" }).returning({ id: roles.id });
      const permissionRows = await tx.insert(permissions).values(permissionNames.map(key => ({ key }))).onConflictDoNothing().returning({ id: permissions.id });
      const allPermissions = permissionRows.length ? permissionRows : await tx.select({ id: permissions.id }).from(permissions);
      if (allPermissions.length) await tx.insert(rolePermissions).values(allPermissions.map(p => ({ roleId: ownerRole.id, permissionId: p.id }))).onConflictDoNothing();
      const [owner] = await tx.insert(users).values({ companyId: company.id, name: "Owner", username: parsed.data.username.toLowerCase(), passwordHash }).returning({ id: users.id });
      await tx.insert(userRoles).values({ userId: owner.id, roleId: ownerRole.id });
      await tx.update(setupState).set({ completed: true, companyId: company.id, updatedAt: new Date() }).where(eq(setupState.id, 1));
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_ALREADY_COMPLETE") return NextResponse.json({ error: "Initial setup has already been completed." }, { status: 409 });
    if (error instanceof Error && error.message.includes("users_username_uq")) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    console.error("Owner setup failed", error);
    return NextResponse.json({ error: "Could not complete setup. Check the database configuration." }, { status: 500 });
  }
}
