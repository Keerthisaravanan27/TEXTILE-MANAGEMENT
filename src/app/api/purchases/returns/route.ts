import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { txDb } from "@/db";
import { auditLogs, inventory, invoiceSequences, products, purchaseItems, purchaseReturnItems, purchaseReturns, purchases, stockMovements } from "@/db/schema";
import { amountFromCents, calculateTaxLine, financialYear } from "@/lib/money";
import { currentUser, hasPermission } from "@/lib/auth";
const schema = z.object({ purchaseId: z.string().uuid(), returnDate: z.string().date(), reason: z.string().max(300).optional(), requestKey: z.string().uuid(), items: z.array(z.object({ purchaseItemId: z.string().uuid(), quantity: z.coerce.number().positive() })).min(1).max(100) });
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "purchases.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid return details." }, { status: 400 });
  try {
    const result = await txDb.transaction(async tx => {
      const [purchase] = await tx.select().from(purchases).where(and(eq(purchases.id, parsed.data.purchaseId), eq(purchases.companyId, user.companyId!), eq(purchases.status, "confirmed"))).for("update");
      if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
      const lineIds = parsed.data.items.map(i => i.purchaseItemId); if (new Set(lineIds).size !== lineIds.length) throw new Error("DUPLICATE_LINE");
      const lines = await tx.select().from(purchaseItems).where(and(eq(purchaseItems.purchaseId, purchase.id), inArray(purchaseItems.id, lineIds)));
      if (lines.length !== lineIds.length) throw new Error("LINE_NOT_FOUND");
      const productIds = [...new Set(lines.map(line => line.productId))];
      await tx.select({ id: products.id }).from(products).where(and(eq(products.companyId, user.companyId!), inArray(products.id, productIds))).orderBy(products.id).for("update");
      const previous = await tx.select({ purchaseItemId: purchaseReturnItems.purchaseItemId, quantity: sql<string>`sum(${purchaseReturnItems.quantity})` }).from(purchaseReturnItems).innerJoin(purchaseReturns, eq(purchaseReturns.id, purchaseReturnItems.purchaseReturnId)).where(and(eq(purchaseReturns.purchaseId, purchase.id), inArray(purchaseReturnItems.purchaseItemId, lineIds))).groupBy(purchaseReturnItems.purchaseItemId);
      const returned = new Map(previous.map(x => [x.purchaseItemId, Number(x.quantity)])); const byId = new Map(lines.map(x => [x.id, x])); let total = 0;
      const calc = parsed.data.items.map(item => { const line = byId.get(item.purchaseItemId)!; if (item.quantity > Number(line.quantity) - (returned.get(line.id) ?? 0) + .0001) throw new Error("RETURN_QUANTITY_EXCEEDED"); const value = calculateTaxLine(item.quantity, Number(line.unitPrice), Number(line.taxRate)).totalCents; total += value; return { input: item, line, amount: amountFromCents(value) }; });
      const currentStock = await tx.select().from(inventory).where(and(eq(inventory.companyId, user.companyId!), inArray(inventory.productId, productIds))).for("update"); const stock = new Map(currentStock.map(x => [`${x.productId}:${x.variantId||"base"}`, Number(x.quantity)]));
      for (const item of calc) if ((stock.get(`${item.line.productId}:${item.line.variantId||"base"}`) ?? 0) < item.input.quantity) throw new Error("INSUFFICIENT_STOCK");
      const fy = financialYear(parsed.data.returnDate); const [seq] = await tx.insert(invoiceSequences).values({ companyId: user.companyId!, documentType: "purchase_return", prefix: "PR", financialYear: fy, currentValue: 1 }).onConflictDoUpdate({ target: [invoiceSequences.companyId, invoiceSequences.documentType, invoiceSequences.financialYear], set: { currentValue: sql`${invoiceSequences.currentValue}+1`, updatedAt: new Date() } }).returning({ value: invoiceSequences.currentValue });
      const [ret] = await tx.insert(purchaseReturns).values({ companyId: user.companyId!, purchaseId: purchase.id, number: `PR-${fy}-${String(seq.value).padStart(5,"0")}`, returnDate: parsed.data.returnDate, total: amountFromCents(total), requestKey: parsed.data.requestKey, reason: parsed.data.reason, createdBy: user.id }).returning();
      for (const row of calc) {
        const [retLine] = await tx.insert(purchaseReturnItems).values({ purchaseReturnId: ret.id, purchaseItemId: row.line.id, productId: row.line.productId, quantity: row.input.quantity.toFixed(3), amount: row.amount }).returning();
        await tx.insert(stockMovements).values({ companyId: user.companyId!, productId: row.line.productId,variantId:row.line.variantId, quantityDelta: `-${row.input.quantity.toFixed(3)}`, unitCost: row.line.unitPrice, sourceType: "purchase_return", sourceId: ret.id, idempotencyKey: `purchase-return:${ret.id}:${retLine.id}`, createdBy: user.id });
        await tx.update(inventory).set({ quantity: sql`${inventory.quantity}-${row.input.quantity}`, updatedAt: new Date() }).where(and(eq(inventory.companyId, user.companyId!), eq(inventory.productId, row.line.productId),row.line.variantId?eq(inventory.variantId,row.line.variantId):sql`${inventory.variantId} is null`));
      }
      await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "purchase.return.created", entity: "purchase_return", recordId: ret.id, reason: parsed.data.reason }); return ret;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PURCHASE_NOT_FOUND") return NextResponse.json({ error: "Confirmed purchase not found." }, { status: 404 });
    if (error instanceof Error && error.message === "RETURN_QUANTITY_EXCEEDED") return NextResponse.json({ error: "Returned quantity exceeds the remaining received quantity." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Cannot return more stock than is currently available." }, { status: 409 });
    if (error instanceof Error && ["DUPLICATE_LINE", "LINE_NOT_FOUND"].includes(error.message)) return NextResponse.json({ error: "The return contains duplicate or invalid invoice lines." }, { status: 400 });
    if (error instanceof Error && error.message.includes("purchase_returns_idempotency_uq")) return NextResponse.json({ error: "This return request was already submitted." }, { status: 409 });
    console.error("Purchase return failed", error); return NextResponse.json({ error: "Could not process purchase return." }, { status: 500 });
  }
}
