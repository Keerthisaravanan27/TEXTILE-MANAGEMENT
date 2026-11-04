import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { inventory, productVariants, products } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "inventory.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const items = await db.select({ id: sql<string>`coalesce(${inventory.id},${products.id})`, productId:products.id,variantId:inventory.variantId,name: products.name, sku: sql<string>`coalesce(${productVariants.sku},${products.sku})`, variant:sql<string>`concat_ws(' · ',${productVariants.size},${productVariants.color},${productVariants.pattern})`, reorderLevel: products.reorderLevel, quantity: sql<string>`coalesce(${inventory.quantity}, 0)`, purchasePrice: products.purchasePrice })
    .from(products).leftJoin(inventory, and(eq(inventory.productId, products.id), eq(inventory.companyId, user.companyId))).leftJoin(productVariants,eq(productVariants.id,inventory.variantId))
    .where(and(eq(products.companyId, user.companyId), eq(products.active, true))).orderBy(products.name);
  return NextResponse.json({ items });
}
