import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { invoiceSequences, parties, products, productVariants, purchases, purchaseItems } from "@/db/schema";
import { amountFromCents, calculateTaxLine, financialYear } from "@/lib/money";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ partyId: z.string().uuid(), invoiceDate: z.string().date(), notes: z.string().max(1000).optional(), items: z.array(z.object({ productId: z.string().uuid(), variantId:z.string().uuid().nullable().optional(), quantity: z.coerce.number().positive().max(1000000), unitPrice: z.coerce.number().nonnegative().max(100000000) })).min(1).max(200) });
export async function GET() {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "purchases.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const rows = await db.select({ purchase: purchases, partyName: parties.name }).from(purchases).innerJoin(parties, eq(parties.id, purchases.partyId)).where(eq(purchases.companyId, user.companyId)).orderBy(sql`${purchases.createdAt} desc`).limit(100);
  return NextResponse.json({ items: rows });
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "purchases.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Check the supplier, date, and item lines." }, { status: 400 });
  try {
    const created = await txDb.transaction(async tx => {
      const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, parsed.data.partyId), eq(parties.companyId, user.companyId), inArray(parties.type, ["supplier", "both"]))).for("update");
      if (!party) throw new Error("SUPPLIER_NOT_FOUND");
      const productIds = [...new Set(parsed.data.items.map(i => i.productId))];
      const productRows = await tx.select().from(products).where(and(eq(products.companyId, user.companyId), inArray(products.id, productIds))).for("update");
      if (productRows.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND");
      const variantIds=[...new Set(parsed.data.items.flatMap(i=>i.variantId?[i.variantId]:[]))];const variantRows=variantIds.length?await tx.select().from(productVariants).where(and(eq(productVariants.companyId,user.companyId),inArray(productVariants.id,variantIds),eq(productVariants.active,true))):[];if(variantRows.length!==variantIds.length)throw new Error("VARIANT_NOT_FOUND");const variantMap=new Map(variantRows.map(v=>[v.id,v]));for(const item of parsed.data.items)if(item.variantId&&variantMap.get(item.variantId)?.productId!==item.productId)throw new Error("VARIANT_NOT_FOUND");
      const byId = new Map(productRows.map(p => [p.id, p]));
      let subtotal = 0, taxTotal = 0;
      const lines = parsed.data.items.map(line => {
        const product = byId.get(line.productId)!; const amounts = calculateTaxLine(line.quantity, line.unitPrice, Number(product.taxRate)); subtotal += amounts.subtotalCents; taxTotal += amounts.taxCents;
        return { productId: product.id, variantId:line.variantId||null, quantity: line.quantity.toFixed(3), unitPrice: line.unitPrice.toFixed(2), taxRate: product.taxRate, lineTotal: amountFromCents(amounts.totalCents) };
      });
      const fy = financialYear(parsed.data.invoiceDate); const [sequence] = await tx.insert(invoiceSequences).values({ companyId: user.companyId, documentType: "purchase", prefix: "PO", financialYear: fy, currentValue: 1 }).onConflictDoUpdate({ target: [invoiceSequences.companyId, invoiceSequences.documentType, invoiceSequences.financialYear], set: { currentValue: sql`${invoiceSequences.currentValue} + 1`, updatedAt: new Date() } }).returning({ value: invoiceSequences.currentValue, prefix: invoiceSequences.prefix });
      const number = `${sequence.prefix}-${fy}-${String(sequence.value).padStart(5, "0")}`;
      const [purchase] = await tx.insert(purchases).values({ companyId: user.companyId, partyId: party.id, number, invoiceDate: parsed.data.invoiceDate, status: "draft", subtotal: amountFromCents(subtotal), taxTotal: amountFromCents(taxTotal), total: amountFromCents(subtotal + taxTotal), notes: parsed.data.notes, createdBy: user.id }).returning();
      await tx.insert(purchaseItems).values(lines.map(line => ({ ...line, purchaseId: purchase.id })));
      return purchase;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_NOT_FOUND") return NextResponse.json({ error: "Select a supplier in your company." }, { status: 400 });
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "One or more products were not found in your company." }, { status: 400 });
    if (error instanceof Error && error.message === "VARIANT_NOT_FOUND") return NextResponse.json({ error: "One or more variants do not belong to their selected products." }, { status: 400 });
    console.error("Purchase creation failed", error); return NextResponse.json({ error: "Could not create purchase." }, { status: 500 });
  }
}
