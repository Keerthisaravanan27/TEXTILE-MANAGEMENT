import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { txDb } from "@/db";
import { auditLogs, goodsReceipts, inventory, invoiceSequences, products, purchaseItems, purchases, stockMovements } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "purchases.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const { id } = await context.params;
  try {
    const receipt = await txDb.transaction(async tx => {
      const [purchase] = await tx.select().from(purchases).where(and(eq(purchases.id, id), eq(purchases.companyId, user.companyId))).for("update");
      if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
      if (purchase.status !== "draft") throw new Error("PURCHASE_ALREADY_RECEIVED");
      const lines = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      if (!lines.length) throw new Error("EMPTY_PURCHASE");
      const productIds = [...new Set(lines.map(line => line.productId))];
      const lockedProducts = await tx.select({ id: products.id }).from(products).where(and(eq(products.companyId, user.companyId), inArray(products.id, productIds))).orderBy(products.id).for("update");
      if (lockedProducts.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");
      const fy = purchase.number.split("-").slice(1, 2)[0] ?? "unknown";
      const [seq] = await tx.insert(invoiceSequences).values({ companyId: user.companyId, documentType: "receipt", prefix: "GR", financialYear: fy, currentValue: 1 }).onConflictDoUpdate({ target: [invoiceSequences.companyId, invoiceSequences.documentType, invoiceSequences.financialYear], set: { currentValue: sql`${invoiceSequences.currentValue} + 1`, updatedAt: new Date() } }).returning({ value: invoiceSequences.currentValue, prefix: invoiceSequences.prefix });
      const receiptNumber = `${seq.prefix}-${fy}-${String(seq.value).padStart(5, "0")}`;
      const [created] = await tx.insert(goodsReceipts).values({ companyId: user.companyId, purchaseId: purchase.id, receiptNumber, receivedBy: user.id }).returning();
      for (const line of lines) {
        const variantKey = line.variantId ?? null;
        const [current] = await tx.select().from(inventory).where(and(eq(inventory.companyId, user.companyId), eq(inventory.productId, line.productId), variantKey ? eq(inventory.variantId, variantKey) : sql`${inventory.variantId} is null`)).for("update");
        await tx.insert(stockMovements).values({ companyId: user.companyId, productId: line.productId, variantId: variantKey, quantityDelta: line.quantity, unitCost: line.unitPrice, sourceType: "purchase_receipt", sourceId: purchase.id, idempotencyKey: `receipt:${purchase.id}:${line.id}`, createdBy: user.id });
        if (current) await tx.update(inventory).set({ quantity: sql`${inventory.quantity} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventory.id, current.id));
        else await tx.insert(inventory).values({ companyId: user.companyId, productId: line.productId, variantId: variantKey, quantity: line.quantity });
      }
      await tx.update(purchases).set({ status: "confirmed", updatedAt: new Date() }).where(eq(purchases.id, purchase.id));
      await tx.insert(auditLogs).values({ companyId: user.companyId, userId: user.id, action: "purchase.received", entity: "purchase", recordId: purchase.id });
      return created;
    });
    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PURCHASE_NOT_FOUND") return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
    if (error instanceof Error && error.message === "PURCHASE_ALREADY_RECEIVED") return NextResponse.json({ error: "This purchase has already been received or cancelled." }, { status: 409 });
    if (error instanceof Error && error.message === "EMPTY_PURCHASE") return NextResponse.json({ error: "This purchase has no items." }, { status: 409 });
    console.error("Purchase receipt failed", error); return NextResponse.json({ error: "Could not receive this purchase." }, { status: 500 });
  }
}
