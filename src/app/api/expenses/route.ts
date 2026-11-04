import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, expenses } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";
const schema = z.object({ category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(500), amount: z.coerce.number().positive().max(1000000000), expenseDate: z.string().date() });
export async function GET(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "expenses.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const p = new URL(request.url).searchParams; const from = p.get("from"), to = p.get("to"); const filters = [eq(expenses.companyId, user.companyId)];
  if (from) filters.push(gte(expenses.expenseDate, from)); if (to) filters.push(lte(expenses.expenseDate, to));
  const items = await db.select().from(expenses).where(and(...filters)).orderBy(sql`${expenses.expenseDate} desc`);
  return NextResponse.json({ items, total: items.reduce((n, e) => n + Number(e.amount), 0).toFixed(2) });
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "expenses.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Check expense details." }, { status: 400 });
  const result = await txDb.transaction(async tx => { const [expense] = await tx.insert(expenses).values({ ...parsed.data, amount: parsed.data.amount.toFixed(2), companyId: user.companyId!, createdBy: user.id }).returning(); await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "expense.created", entity: "expense", recordId: expense.id }); return expense; });
  return NextResponse.json(result, { status: 201 });
}
