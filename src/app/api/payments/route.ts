import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, parties, paymentAllocations, payments, purchaseReturns, purchases, sales, salesReturns } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ targetType: z.enum(["sale", "purchase"]), targetId: z.string().uuid(), amount: z.coerce.number().positive().max(1000000000), method: z.enum(["cash", "bank", "upi", "card", "cheque", "other"]), paymentDate: z.string().date(), reference: z.string().max(100).optional(), idempotencyKey: z.string().uuid(), notes: z.string().max(500).optional() });
export async function GET() {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "payments.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const items = await db.select({ payment: payments, partyName: parties.name }).from(payments).innerJoin(parties, eq(parties.id, payments.partyId)).where(eq(payments.companyId, user.companyId)).orderBy(sql`${payments.createdAt} desc`).limit(200);
  return NextResponse.json({ items });
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "payments.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Check the payment details." }, { status: 400 });
  try {
    const created = await txDb.transaction(async tx => {
      let document: { id: string; partyId: string; total: string } | undefined;
      if (parsed.data.targetType === "sale") {
        const [row] = await tx.select({ id: sales.id, partyId: sales.partyId, total: sales.total }).from(sales).where(and(eq(sales.id, parsed.data.targetId), eq(sales.companyId, user.companyId), eq(sales.status, "confirmed"))).for("update"); document = row;
      } else {
        const [row] = await tx.select({ id: purchases.id, partyId: purchases.partyId, total: purchases.total }).from(purchases).where(and(eq(purchases.id, parsed.data.targetId), eq(purchases.companyId, user.companyId), eq(purchases.status, "confirmed"))).for("update"); document = row;
      }
      if (!document) throw new Error("DOCUMENT_NOT_FOUND");
      const [allocated] = await tx.select({ value: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)` }).from(paymentAllocations).where(parsed.data.targetType === "sale" ? eq(paymentAllocations.saleId, document.id) : eq(paymentAllocations.purchaseId, document.id));
      const [credited] = parsed.data.targetType === "sale"
        ? await tx.select({ value: sql<string>`coalesce(sum(${salesReturns.total}), 0)` }).from(salesReturns).where(eq(salesReturns.saleId, document.id))
        : await tx.select({ value: sql<string>`coalesce(sum(${purchaseReturns.total}), 0)` }).from(purchaseReturns).where(eq(purchaseReturns.purchaseId, document.id));
      const amount = parsed.data.amount; const balance = Number(document.total) - Number(allocated.value) - Number(credited.value);
      if (amount - balance > 0.005) throw new Error("PAYMENT_EXCEEDS_BALANCE");
      const direction = parsed.data.targetType === "sale" ? "receipt" : "payment";
      const [payment] = await tx.insert(payments).values({ companyId: user.companyId, partyId: document.partyId, direction, amount: amount.toFixed(2), method: parsed.data.method, reference: parsed.data.reference, paymentDate: parsed.data.paymentDate, idempotencyKey: parsed.data.idempotencyKey, notes: parsed.data.notes, createdBy: user.id }).returning();
      await tx.insert(paymentAllocations).values({ paymentId: payment.id, saleId: parsed.data.targetType === "sale" ? document.id : null, purchaseId: parsed.data.targetType === "purchase" ? document.id : null, amount: amount.toFixed(2) });
      await tx.insert(auditLogs).values({ companyId: user.companyId, userId: user.id, action: "payment.created", entity: "payment", recordId: payment.id });
      return payment;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "Confirmed invoice not found." }, { status: 404 });
    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_BALANCE") return NextResponse.json({ error: "Payment exceeds the remaining invoice balance." }, { status: 409 });
    if (error instanceof Error && (error.message.includes("payments_company_idempotency_uq") || error.message.includes("duplicate key"))) return NextResponse.json({ error: "This payment was already submitted." }, { status: 409 });
    console.error("Payment posting failed", error); return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
