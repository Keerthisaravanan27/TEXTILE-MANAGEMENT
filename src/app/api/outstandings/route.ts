import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parties, paymentAllocations, purchaseReturns, purchases, sales, salesReturns } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";
export async function GET() {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "payments.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const [saleRows, purchaseRows] = await Promise.all([
    db.select({ id: sales.id, number: sales.number, partyName: parties.name, total: sales.total, paid: sql<string>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.saleId}=${sales.id}),0)`, credited: sql<string>`coalesce((select sum(${salesReturns.total}) from ${salesReturns} where ${salesReturns.saleId}=${sales.id}),0)`, date: sales.invoiceDate }).from(sales).innerJoin(parties, eq(parties.id, sales.partyId)).where(and(eq(sales.companyId, user.companyId), eq(sales.status, "confirmed"))),
    db.select({ id: purchases.id, number: purchases.number, partyName: parties.name, total: purchases.total, paid: sql<string>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.purchaseId}=${purchases.id}),0)`, credited: sql<string>`coalesce((select sum(${purchaseReturns.total}) from ${purchaseReturns} where ${purchaseReturns.purchaseId}=${purchases.id}),0)`, date: purchases.invoiceDate }).from(purchases).innerJoin(parties, eq(parties.id, purchases.partyId)).where(and(eq(purchases.companyId, user.companyId), eq(purchases.status, "confirmed"))),
  ]);
  return NextResponse.json({ sales: saleRows.map(x => ({ ...x, targetType: "sale", balance: Math.max(0, Number(x.total) - Number(x.paid) - Number(x.credited)).toFixed(2) })).filter(x => Number(x.balance) > 0), purchases: purchaseRows.map(x => ({ ...x, targetType: "purchase", balance: Math.max(0, Number(x.total) - Number(x.paid) - Number(x.credited)).toFixed(2) })).filter(x => Number(x.balance) > 0) });
}
