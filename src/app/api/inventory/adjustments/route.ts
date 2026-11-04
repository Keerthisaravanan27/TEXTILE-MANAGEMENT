import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { txDb } from "@/db";
import { auditLogs, inventory, productVariants, products, stockMovements } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ productId: z.string().uuid(), variantId:z.string().uuid().nullable().optional(), delta: z.coerce.number().finite().min(-1000000).max(1000000).refine(v => v !== 0), reason: z.string().trim().min(3).max(300), idempotencyKey: z.string().uuid() });
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "inventory.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a product, non-zero quantity, reason, and unique request key." }, { status: 400 });
  const delta = parsed.data.delta.toFixed(3);
  try {
    const result = await txDb.transaction(async tx => {
      const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, parsed.data.productId), eq(products.companyId, user.companyId), eq(products.active, true))).for("update");
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      if(parsed.data.variantId){const[variant]=await tx.select({id:productVariants.id}).from(productVariants).where(and(eq(productVariants.id,parsed.data.variantId),eq(productVariants.productId,product.id),eq(productVariants.companyId,user.companyId),eq(productVariants.active,true)));if(!variant)throw new Error("VARIANT_NOT_FOUND");}
      const [current] = await tx.select().from(inventory).where(and(eq(inventory.companyId, user.companyId), eq(inventory.productId, product.id),parsed.data.variantId?eq(inventory.variantId,parsed.data.variantId):sql`${inventory.variantId} is null`)).for("update");
      const nextQuantity = Number(current?.quantity || 0) + Number(delta);
      if (nextQuantity < 0) throw new Error("INSUFFICIENT_STOCK");
      await tx.insert(stockMovements).values({ companyId: user.companyId, productId: product.id,variantId:parsed.data.variantId||null, quantityDelta: delta, sourceType: "adjustment", idempotencyKey: parsed.data.idempotencyKey, createdBy: user.id });
      if (current) await tx.update(inventory).set({ quantity: nextQuantity.toFixed(3), updatedAt: new Date() }).where(eq(inventory.id, current.id));
      else await tx.insert(inventory).values({ companyId: user.companyId, productId: product.id,variantId:parsed.data.variantId||null, quantity: delta });
      await tx.insert(auditLogs).values({ companyId: user.companyId, userId: user.id, action: "stock.adjusted", entity: "product", recordId: product.id, reason: parsed.data.reason });
      return { quantity: nextQuantity.toFixed(3) };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Adjustment would make stock negative." }, { status: 409 });
    if (error instanceof Error && error.message === "VARIANT_NOT_FOUND") return NextResponse.json({ error: "Variant does not belong to this product." }, { status: 400 });
    if (error instanceof Error && (error.message.includes("stock_movements_company_idempotency_uq") || error.message.includes("duplicate key"))) return NextResponse.json({ error: "This stock adjustment request was already submitted." }, { status: 409 });
    console.error("Stock adjustment failed", error); return NextResponse.json({ error: "Could not save the stock adjustment." }, { status: 500 });
  }
}
