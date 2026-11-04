import { and, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, inventory, products, productVariants } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ name: z.string().trim().min(1).max(180), sku: z.string().trim().min(1).max(80), barcode: z.string().max(100).optional(), hsnCode: z.string().max(20).optional(), description: z.string().max(1000).optional(), purchasePrice: z.coerce.number().finite().nonnegative(), salePrice: z.coerce.number().finite().nonnegative(), taxRate: z.coerce.number().min(0).max(100).default(0), reorderLevel: z.coerce.number().min(0).default(0) });
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "products.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const params = new URL(request.url).searchParams; const q = params.get("q")?.trim();
  const page = Math.max(1, Number(params.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 25)));
  const filters = [eq(products.companyId, user.companyId), eq(products.active, true)];
  if (q) filters.push(or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(products.barcode, `%${q}%`))!);
  const [items, [count]] = await Promise.all([
    db.select({ product: products, stock: sql<string>`coalesce(sum(${inventory.quantity}), 0)` }).from(products).leftJoin(inventory, and(eq(inventory.productId, products.id), eq(inventory.companyId, user.companyId))).where(and(...filters)).groupBy(products.id).orderBy(products.name).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(products).where(and(...filters)),
  ]);
  const variantRows=await db.select({variant:productVariants,stock:sql<string>`coalesce(sum(${inventory.quantity}),0)`}).from(productVariants).leftJoin(inventory,and(eq(inventory.variantId,productVariants.id),eq(inventory.companyId,user.companyId))).where(and(eq(productVariants.companyId,user.companyId),eq(productVariants.active,true))).groupBy(productVariants.id);
  const variantsByProduct=new Map<string,typeof variantRows>();for(const row of variantRows){const list=variantsByProduct.get(row.variant.productId)||[];list.push(row);variantsByProduct.set(row.variant.productId,list);}
  return NextResponse.json({ items: items.map(r => ({ ...r.product, stock: r.stock, variants:(variantsByProduct.get(r.product.id)||[]).map(x=>({...x.variant,stock:x.stock})) })), total: count.total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "products.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the product details and try again.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const product = await txDb.transaction(async tx => { const [created] = await tx.insert(products).values({ ...parsed.data, companyId: user.companyId!, purchasePrice: parsed.data.purchasePrice.toFixed(2), salePrice: parsed.data.salePrice.toFixed(2), taxRate: parsed.data.taxRate.toFixed(2), reorderLevel: parsed.data.reorderLevel.toFixed(3) }).returning(); await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "product.created", entity: "product", recordId: created.id }); return created; });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("products_company_sku_uq")) return NextResponse.json({ error: "This SKU is already used in your company." }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request:Request){const user=await currentUser();if(!user?.companyId)return NextResponse.json({error:"Authentication required"},{status:401});if(!await hasPermission(user.id,"products.write"))return NextResponse.json({error:"Permission denied"},{status:403});const parsed=schema.partial().extend({id:z.string().uuid()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Check the product details and try again."},{status:400});const{id,...fields}=parsed.data;const values:Partial<typeof products.$inferInsert>={updatedAt:new Date()};if(fields.name!==undefined)values.name=fields.name;if(fields.sku!==undefined)values.sku=fields.sku;if(fields.barcode!==undefined)values.barcode=fields.barcode;if(fields.hsnCode!==undefined)values.hsnCode=fields.hsnCode;if(fields.description!==undefined)values.description=fields.description;if(fields.purchasePrice!==undefined)values.purchasePrice=fields.purchasePrice.toFixed(2);if(fields.salePrice!==undefined)values.salePrice=fields.salePrice.toFixed(2);if(fields.taxRate!==undefined)values.taxRate=fields.taxRate.toFixed(2);if(fields.reorderLevel!==undefined)values.reorderLevel=fields.reorderLevel.toFixed(3);try{const updated=await txDb.transaction(async tx=>{const[result]=await tx.update(products).set(values).where(and(eq(products.id,id),eq(products.companyId,user.companyId!))).returning();if(result)await tx.insert(auditLogs).values({companyId:user.companyId!,userId:user.id,action:"product.updated",entity:"product",recordId:id});return result});return updated?NextResponse.json(updated):NextResponse.json({error:"Product not found."},{status:404})}catch(error){if(error instanceof Error&&error.message.includes("products_company_sku_uq"))return NextResponse.json({error:"This SKU is already used in your company."},{status:409});console.error("Product update failed",error);return NextResponse.json({error:"Could not update product."},{status:500})}}
