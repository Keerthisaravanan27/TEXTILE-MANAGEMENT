import { and, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, parties } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const createSchema = z.object({ type: z.enum(["customer", "supplier", "both"]), name: z.string().trim().min(1).max(160), businessName: z.string().max(160).optional(), contactPerson: z.string().max(120).optional(), phone: z.string().max(30).optional(), email: z.string().email().max(254).optional().or(z.literal("")), gstin: z.string().max(20).optional(), address: z.string().max(500).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), pinCode: z.string().max(12).optional(), openingBalance: z.coerce.number().finite().default(0), creditLimit: z.coerce.number().finite().nonnegative().optional() });

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "parties.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const type = params.get("type");
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 25)));
  const filters = [eq(parties.companyId, user.companyId), eq(parties.active, true)];
  if (q) filters.push(or(ilike(parties.name, `%${q}%`), ilike(parties.phone, `%${q}%`), ilike(parties.email, `%${q}%`))!);
  if (type === "customer" || type === "supplier") filters.push(or(eq(parties.type, type), eq(parties.type, "both"))!);
  const [items, [count]] = await Promise.all([
    db.select().from(parties).where(and(...filters)).orderBy(parties.name).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(parties).where(and(...filters)),
  ]);
  return NextResponse.json({ items, total: count.total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "parties.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the party details and try again.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const party = await txDb.transaction(async tx => { const [created] = await tx.insert(parties).values({ ...parsed.data, email: parsed.data.email || null, openingBalance: parsed.data.openingBalance.toFixed(2), creditLimit: parsed.data.creditLimit?.toFixed(2) ?? null, companyId: user.companyId! }).returning(); await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "party.created", entity: "party", recordId: created.id }); return created; });
  return NextResponse.json(party, { status: 201 });
}
