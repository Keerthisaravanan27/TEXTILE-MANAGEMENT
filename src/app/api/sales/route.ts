import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, inventory, invoiceSequences, parties, products, productVariants, sales, salesItems, stockMovements } from "@/db/schema";
import { amountFromCents, calculateTaxLine, financialYear } from "@/lib/money";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ partyId: z.string().uuid(), invoiceDate: z.string().date(), notes: z.string().max(1000).optional(), items: z.array(z.object({ productId: z.string().uuid(), variantId:z.string().uuid().nullable().optional(), quantity: z.coerce.number().positive().max(1000000), unitPrice: z.coerce.number().nonnegative().max(100000000).optional() })).min(1).max(200) });
export async function GET() {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "sales.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const rows = await db.select({ sale: sales, partyName: parties.name }).from(sales).innerJoin(parties, eq(parties.id, sales.partyId)).where(eq(sales.companyId, user.companyId)).orderBy(sql`${sales.createdAt} desc`).limit(100);
  return NextResponse.json({ items: rows });
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "sales.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Check the customer, date, and item lines." }, { status: 400 });
  try {
    const created = await txDb.transaction(async tx => {
      const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, parsed.data.partyId), eq(parties.companyId, user.companyId), inArray(parties.type, ["customer", "both"]))).for("update");
      if (!party) throw new Error("CUSTOMER_NOT_FOUND");
      const productIds = [...new Set(parsed.data.items.map(i => i.productId))];
      const productRows = await tx.select().from(products).where(and(eq(products.companyId, user.companyId), eq(products.active, true), inArray(products.id, productIds))).orderBy(products.id).for("update");
      if (productRows.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");
      const variantIds=[...new Set(parsed.data.items.flatMap(i=>i.variantId?[i.variantId]:[]))];const variantRows=variantIds.length?await tx.select().from(productVariants).where(and(eq(productVariants.companyId,user.companyId),inArray(productVariants.id,variantIds),eq(productVariants.active,true))):[];if(variantRows.length!==variantIds.length)throw new Error("VARIANT_NOT_FOUND");const variantMap=new Map(variantRows.map(v=>[v.id,v]));for(const item of parsed.data.items)if(item.variantId&&variantMap.get(item.variantId)?.productId!==item.productId)throw new Error("VARIANT_NOT_FOUND");
      const byId = new Map(productRows.map(p => [p.id, p]));
      const wanted = new Map<string, number>();
      for (const item of parsed.data.items) { const key=`${item.productId}:${item.variantId||"base"}`;wanted.set(key,(wanted.get(key)??0)+item.quantity); }
      const stockRows = await tx.select().from(inventory).where(and(eq(inventory.companyId, user.companyId), inArray(inventory.productId, productIds))).for("update");
      const stockByProduct = new Map(stockRows.map(r => [`${r.productId}:${r.variantId||"base"}`, Number(r.quantity)]));
      for (const [key, quantity] of wanted) if ((stockByProduct.get(key) ?? 0) < quantity) throw new Error("INSUFFICIENT_STOCK");
      let subtotal = 0, taxTotal = 0;
      const lines = parsed.data.items.map(line => {
        const product = byId.get(line.productId)!; const variant=line.variantId?variantMap.get(line.variantId):undefined;const price = line.unitPrice ?? Number(variant?.unitPrice||product.salePrice); const amounts = calculateTaxLine(line.quantity, price, Number(product.taxRate)); subtotal += amounts.subtotalCents; taxTotal += amounts.taxCents;
        return { productId: product.id, variantId:line.variantId||null, quantity: line.quantity.toFixed(3), unitPrice: price.toFixed(2), taxRate: product.taxRate, lineTotal: amountFromCents(amounts.totalCents) };
      });
      const fy = financialYear(parsed.data.invoiceDate); const [sequence] = await tx.insert(invoiceSequences).values({ companyId: user.companyId, documentType: "sale", prefix: "SI", financialYear: fy, currentValue: 1 }).onConflictDoUpdate({ target: [invoiceSequences.companyId, invoiceSequences.documentType, invoiceSequences.financialYear], set: { currentValue: sql`${invoiceSequences.currentValue} + 1`, updatedAt: new Date() } }).returning({ value: invoiceSequences.currentValue, prefix: invoiceSequences.prefix });
      const number = `${sequence.prefix}-${fy}-${String(sequence.value).padStart(5, "0")}`;
      const [sale] = await tx.insert(sales).values({ companyId: user.companyId, partyId: party.id, number, invoiceDate: parsed.data.invoiceDate, status: "confirmed", subtotal: amountFromCents(subtotal), taxTotal: amountFromCents(taxTotal), total: amountFromCents(subtotal + taxTotal), notes: parsed.data.notes, createdBy: user.id }).returning();
      const savedLines = await tx.insert(salesItems).values(lines.map(line => ({ ...line, saleId: sale.id }))).returning();
      for (const line of savedLines) {
        await tx.insert(stockMovements).values({ companyId: user.companyId, productId: line.productId, variantId:line.variantId, quantityDelta: `-${line.quantity}`, unitCost: byId.get(line.productId)!.purchasePrice, sourceType: "sale", sourceId: sale.id, idempotencyKey: `sale:${sale.id}:${line.id}`, createdBy: user.id });
        await tx.update(inventory).set({ quantity: sql`${inventory.quantity} - ${line.quantity}`, updatedAt: new Date() }).where(and(eq(inventory.companyId, user.companyId), eq(inventory.productId, line.productId), line.variantId?eq(inventory.variantId,line.variantId):sql`${inventory.variantId} is null`));
      }
      await tx.insert(auditLogs).values({ companyId: user.companyId, userId: user.id, action: "sale.finalized", entity: "sale", recordId: sale.id });
      return sale;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") return NextResponse.json({ error: "Select a customer in your company." }, { status: 400 });
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "One or more products were not found in your company." }, { status: 400 });
    if (error instanceof Error && error.message === "VARIANT_NOT_FOUND") return NextResponse.json({ error: "One or more variants do not belong to their selected products." }, { status: 400 });
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Not enough stock to finalize this sale." }, { status: 409 });
    console.error("Sale finalization failed", error); return NextResponse.json({ error: "Could not finalize sale." }, { status: 500 });
  }
}
