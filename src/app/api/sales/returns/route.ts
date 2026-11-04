import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { txDb } from "@/db";
import { auditLogs, inventory, invoiceSequences, products, sales, salesItems, salesReturnItems, salesReturns, stockMovements } from "@/db/schema";
import { amountFromCents, calculateTaxLine, financialYear } from "@/lib/money";
import { currentUser, hasPermission } from "@/lib/auth";
const schema = z.object({ saleId: z.string().uuid(), returnDate: z.string().date(), reason: z.string().max(300).optional(), requestKey: z.string().uuid(), items: z.array(z.object({ saleItemId: z.string().uuid(), quantity: z.coerce.number().positive(), condition: z.enum(["resalable", "damaged"]) })).min(1).max(100) });
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "sales.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid return details." }, { status: 400 });
  try {
    const result = await txDb.transaction(async tx => {
      const [sale] = await tx.select().from(sales).where(and(eq(sales.id, parsed.data.saleId), eq(sales.companyId, user.companyId!), eq(sales.status, "confirmed"))).for("update");
      if (!sale) throw new Error("SALE_NOT_FOUND");
      const requestedIds = parsed.data.items.map(i => i.saleItemId); if (new Set(requestedIds).size !== requestedIds.length) throw new Error("DUPLICATE_LINE");
      const lines = await tx.select().from(salesItems).where(and(eq(salesItems.saleId, sale.id), inArray(salesItems.id, requestedIds)));
      if (lines.length !== requestedIds.length) throw new Error("LINE_NOT_FOUND");
      const productIds = [...new Set(lines.map(line => line.productId))];
      await tx.select({ id: products.id }).from(products).where(and(eq(products.companyId, user.companyId!), inArray(products.id, productIds))).orderBy(products.id).for("update");
      const prior = await tx.select({ saleItemId: salesReturnItems.saleItemId, quantity: sql<string>`sum(${salesReturnItems.quantity})` }).from(salesReturnItems).innerJoin(salesReturns, eq(salesReturns.id, salesReturnItems.salesReturnId)).where(and(eq(salesReturns.saleId, sale.id), inArray(salesReturnItems.saleItemId, requestedIds))).groupBy(salesReturnItems.saleItemId);
      const returned = new Map(prior.map(r => [r.saleItemId, Number(r.quantity)])); const byId = new Map(lines.map(l => [l.id, l]));
      let returnTotal = 0;
      const calculated = parsed.data.items.map(input => { const line = byId.get(input.saleItemId)!; const remaining = Number(line.quantity) - (returned.get(line.id) ?? 0); if (input.quantity - remaining > 0.0001) throw new Error("RETURN_QUANTITY_EXCEEDED"); const sum = calculateTaxLine(input.quantity, Number(line.unitPrice), Number(line.taxRate)); returnTotal += sum.totalCents; return { input, line, total: amountFromCents(sum.totalCents) }; });
      const fy = financialYear(parsed.data.returnDate); const [seq] = await tx.insert(invoiceSequences).values({ companyId: user.companyId!, documentType: "sales_return", prefix: "SR", financialYear: fy, currentValue: 1 }).onConflictDoUpdate({ target: [invoiceSequences.companyId, invoiceSequences.documentType, invoiceSequences.financialYear], set: { currentValue: sql`${invoiceSequences.currentValue}+1`, updatedAt: new Date() } }).returning({ value: invoiceSequences.currentValue });
      const [ret] = await tx.insert(salesReturns).values({ companyId: user.companyId!, saleId: sale.id, number: `SR-${fy}-${String(seq.value).padStart(5,"0")}`, returnDate: parsed.data.returnDate, total: amountFromCents(returnTotal), requestKey: parsed.data.requestKey, reason: parsed.data.reason, createdBy: user.id }).returning();
      for (const row of calculated) {
        const [retLine] = await tx.insert(salesReturnItems).values({ salesReturnId: ret.id, saleItemId: row.line.id, productId: row.line.productId, quantity: row.input.quantity.toFixed(3), condition: row.input.condition, amount: row.total }).returning();
        if (row.input.condition === "resalable") {
          await tx.insert(stockMovements).values({ companyId: user.companyId!, productId: row.line.productId,variantId:row.line.variantId, quantityDelta: row.input.quantity.toFixed(3), sourceType: "sales_return", sourceId: ret.id, idempotencyKey: `sales-return:${ret.id}:${retLine.id}`, createdBy: user.id });
          const [current] = await tx.select().from(inventory).where(and(eq(inventory.companyId,user.companyId!),eq(inventory.productId,row.line.productId),row.line.variantId?eq(inventory.variantId,row.line.variantId):sql`${inventory.variantId} is null`)).for("update");
          if(current) await tx.update(inventory).set({quantity:sql`${inventory.quantity}+${row.input.quantity}`,updatedAt:new Date()}).where(eq(inventory.id,current.id)); else await tx.insert(inventory).values({companyId:user.companyId!,productId:row.line.productId,variantId:row.line.variantId,quantity:row.input.quantity.toFixed(3)});
        }
      }
      await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "sales.return.created", entity: "sales_return", recordId: ret.id, reason: parsed.data.reason });
      return ret;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_NOT_FOUND") return NextResponse.json({ error: "Confirmed sale not found." }, { status: 404 });
    if (error instanceof Error && error.message === "RETURN_QUANTITY_EXCEEDED") return NextResponse.json({ error: "Returned quantity exceeds the remaining sale quantity." }, { status: 409 });
    if (error instanceof Error && ["DUPLICATE_LINE", "LINE_NOT_FOUND"].includes(error.message)) return NextResponse.json({ error: "The return contains duplicate or invalid invoice lines." }, { status: 400 });
    if (error instanceof Error && error.message.includes("sales_returns_idempotency_uq")) return NextResponse.json({ error: "This return request was already submitted." }, { status: 409 });
    console.error("Sales return failed", error); return NextResponse.json({ error: "Could not process sales return." }, { status: 500 });
  }
}
