import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { txDb } from "@/db";
import { auditLogs, parties } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ type: z.enum(["customer", "supplier", "both"]).optional(), name: z.string().trim().min(1).max(160).optional(), businessName: z.string().max(160).nullable().optional(), contactPerson: z.string().max(120).nullable().optional(), phone: z.string().max(30).nullable().optional(), email: z.string().email().max(254).nullable().or(z.literal("")).optional(), gstin: z.string().max(20).nullable().optional(), address: z.string().max(500).nullable().optional(), city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(), pinCode: z.string().max(12).nullable().optional(), openingBalance:z.coerce.number().finite().optional(), creditLimit: z.coerce.number().finite().nonnegative().nullable().optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "parties.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid party details" }, { status: 400 });
  const values = { ...parsed.data, email: parsed.data.email || null, openingBalance:parsed.data.openingBalance===undefined?undefined:parsed.data.openingBalance.toFixed(2), creditLimit: parsed.data.creditLimit == null ? parsed.data.creditLimit : parsed.data.creditLimit.toFixed(2), updatedAt: new Date() };
  const party = await txDb.transaction(async tx => { const [updated] = await tx.update(parties).set(values).where(and(eq(parties.id, id), eq(parties.companyId, user.companyId!))).returning(); if (updated) await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "party.updated", entity: "party", recordId: updated.id }); return updated; });
  return party ? NextResponse.json(party) : NextResponse.json({ error: "Party not found" }, { status: 404 });
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "parties.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const { id } = await context.params;
  const party = await txDb.transaction(async tx => { const [updated] = await tx.update(parties).set({ active: false, updatedAt: new Date() }).where(and(eq(parties.id, id), eq(parties.companyId, user.companyId!))).returning({ id: parties.id }); if (updated) await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "party.deactivated", entity: "party", recordId: updated.id }); return updated; });
  return party ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Party not found" }, { status: 404 });
}
