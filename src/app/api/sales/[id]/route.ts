import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sales, salesItems, salesReturnItems, salesReturns, products } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user=await currentUser(); if(!user?.companyId)return NextResponse.json({error:"Authentication required"},{status:401}); if(!await hasPermission(user.id,"sales.read"))return NextResponse.json({error:"Permission denied"},{status:403});
  const {id}=await context.params; const [sale]=await db.select().from(sales).where(and(eq(sales.id,id),eq(sales.companyId,user.companyId)));
  if(!sale)return NextResponse.json({error:"Invoice not found"},{status:404});
  const items=await db.select({id:salesItems.id,productId:salesItems.productId,name:products.name,quantity:salesItems.quantity,unitPrice:salesItems.unitPrice,taxRate:salesItems.taxRate,returned:sql<string>`coalesce((select sum(${salesReturnItems.quantity}) from ${salesReturnItems} inner join ${salesReturns} on ${salesReturns.id}=${salesReturnItems.salesReturnId} where ${salesReturnItems.saleItemId}=${salesItems.id}),0)`}).from(salesItems).innerJoin(products,eq(products.id,salesItems.productId)).where(eq(salesItems.saleId,sale.id));
  return NextResponse.json({sale,items});
}
