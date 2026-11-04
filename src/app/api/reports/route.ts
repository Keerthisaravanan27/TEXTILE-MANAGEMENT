import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { expenses, inventory, parties, products, purchaseReturnItems, purchaseItems, purchaseReturns, purchases, sales, salesReturnItems, salesItems, salesReturns } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";
const paramsSchema = z.object({ type: z.enum(["sales", "purchases", "inventory", "gst", "profit-loss"]), from: z.string().date().optional(), to: z.string().date().optional() });
const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "reports.read")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const url = new URL(request.url); const parsed = paramsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid report and date range." }, { status: 400 });
  const { type, from, to } = parsed.data; const csv = url.searchParams.get("format") === "csv"; const companyId = user.companyId;
  let headers: string[]; let rows: unknown[][]; let totals: Record<string, string> = {};
  if (type === "sales") {
    const filters = [eq(sales.companyId, companyId), eq(sales.status, "confirmed")]; if (from) filters.push(gte(sales.invoiceDate, from)); if (to) filters.push(lte(sales.invoiceDate, to));
    const returnFilters = [eq(sales.companyId, companyId)]; if (from) returnFilters.push(gte(salesReturns.returnDate, from)); if (to) returnFilters.push(lte(salesReturns.returnDate, to));
    const [data, returned] = await Promise.all([
      db.select({ number: sales.number, date: sales.invoiceDate, party: parties.name, subtotal: sales.subtotal, tax: sales.taxTotal, total: sales.total }).from(sales).innerJoin(parties, eq(parties.id, sales.partyId)).where(and(...filters)).orderBy(sales.invoiceDate),
      db.select({ number: salesReturns.number, date: salesReturns.returnDate, party: parties.name, total: salesReturns.total, tax: sql<string>`coalesce(sum(round(${salesReturnItems.quantity} * ${salesItems.unitPrice} * ${salesItems.taxRate} / 100,2)),0)` }).from(salesReturns).innerJoin(sales,eq(sales.id,salesReturns.saleId)).innerJoin(parties,eq(parties.id,sales.partyId)).innerJoin(salesReturnItems,eq(salesReturnItems.salesReturnId,salesReturns.id)).innerJoin(salesItems,eq(salesItems.id,salesReturnItems.saleItemId)).where(and(...returnFilters)).groupBy(salesReturns.id,salesReturns.number,salesReturns.returnDate,parties.name).orderBy(salesReturns.returnDate),
    ]);
    headers = ["Type", "Number", "Date", "Customer", "Subtotal", "Tax", "Total"]; rows = [...data.map(x => ["Sale",x.number,x.date,x.party,x.subtotal,x.tax,x.total]), ...returned.map(x => ["Return",x.number,x.date,x.party,(Number(x.total)-Number(x.tax)).toFixed(2),x.tax,`-${x.total}`])]; totals = { invoices: String(data.length), returns: String(returned.length), netTotal: (data.reduce((n,x)=>n+Number(x.total),0)-returned.reduce((n,x)=>n+Number(x.total),0)).toFixed(2) };
  } else if (type === "purchases") {
    const filters = [eq(purchases.companyId, companyId), eq(purchases.status, "confirmed")]; if (from) filters.push(gte(purchases.invoiceDate, from)); if (to) filters.push(lte(purchases.invoiceDate, to));
    const returnFilters = [eq(purchases.companyId, companyId)]; if (from) returnFilters.push(gte(purchaseReturns.returnDate, from)); if (to) returnFilters.push(lte(purchaseReturns.returnDate, to));
    const [data, returned] = await Promise.all([
      db.select({ number: purchases.number, date: purchases.invoiceDate, party: parties.name, subtotal: purchases.subtotal, tax: purchases.taxTotal, total: purchases.total }).from(purchases).innerJoin(parties, eq(parties.id, purchases.partyId)).where(and(...filters)).orderBy(purchases.invoiceDate),
      db.select({ number: purchaseReturns.number, date: purchaseReturns.returnDate, party: parties.name, total: purchaseReturns.total, tax: sql<string>`coalesce(sum(round(${purchaseReturnItems.quantity} * ${purchaseItems.unitPrice} * ${purchaseItems.taxRate} / 100,2)),0)` }).from(purchaseReturns).innerJoin(purchases,eq(purchases.id,purchaseReturns.purchaseId)).innerJoin(parties,eq(parties.id,purchases.partyId)).innerJoin(purchaseReturnItems,eq(purchaseReturnItems.purchaseReturnId,purchaseReturns.id)).innerJoin(purchaseItems,eq(purchaseItems.id,purchaseReturnItems.purchaseItemId)).where(and(...returnFilters)).groupBy(purchaseReturns.id,purchaseReturns.number,purchaseReturns.returnDate,parties.name).orderBy(purchaseReturns.returnDate),
    ]);
    headers = ["Type", "Number", "Date", "Supplier", "Subtotal", "Tax", "Total"]; rows = [...data.map(x => ["Purchase",x.number,x.date,x.party,x.subtotal,x.tax,x.total]), ...returned.map(x => ["Return",x.number,x.date,x.party,(Number(x.total)-Number(x.tax)).toFixed(2),x.tax,`-${x.total}`])]; totals = { invoices: String(data.length), returns: String(returned.length), netTotal: (data.reduce((n,x)=>n+Number(x.total),0)-returned.reduce((n,x)=>n+Number(x.total),0)).toFixed(2) };
  } else if (type === "inventory") {
    const data = await db.select({ sku: products.sku, product: products.name, quantity: sql<string>`coalesce(sum(${inventory.quantity}),0)`, unitCost: products.purchasePrice, value: sql<string>`coalesce(sum(${inventory.quantity} * ${products.purchasePrice}),0)` }).from(products).leftJoin(inventory, and(eq(inventory.productId,products.id),eq(inventory.companyId,companyId))).where(and(eq(products.companyId,companyId),eq(products.active,true))).groupBy(products.id).orderBy(products.name);
    headers = ["SKU", "Product", "Quantity", "Unit purchase cost", "Stock value at purchase cost"]; rows = data.map(x => [x.sku,x.product,x.quantity,x.unitCost,x.value]); totals = { products: String(data.length), stockValue: data.reduce((n,x)=>n+Number(x.value),0).toFixed(2) };
  } else if (type === "profit-loss") {
    const salesFilters=[eq(sales.companyId,companyId),eq(sales.status,"confirmed")]; const expenseFilters=[eq(expenses.companyId,companyId)];
    if(from){salesFilters.push(gte(sales.invoiceDate,from));expenseFilters.push(gte(expenses.expenseDate,from));} if(to){salesFilters.push(lte(sales.invoiceDate,to));expenseFilters.push(lte(expenses.expenseDate,to));}
    const [revenue,cost,expenseTotal,returnCost,returnSubtotal]=await Promise.all([
      db.select({v:sql<string>`coalesce(sum(${sales.subtotal}),0)`}).from(sales).where(and(...salesFilters)),
      db.select({v:sql<string>`coalesce(sum(${salesItems.quantity} * ${products.purchasePrice}),0)`}).from(salesItems).innerJoin(sales,eq(sales.id,salesItems.saleId)).innerJoin(products,eq(products.id,salesItems.productId)).where(and(...salesFilters)),
      db.select({v:sql<string>`coalesce(sum(${expenses.amount}),0)`}).from(expenses).where(and(...expenseFilters)),
      db.select({v:sql<string>`coalesce(sum(${salesReturnItems.quantity} * ${products.purchasePrice}) filter(where ${salesReturnItems.condition}='resalable'),0)`}).from(salesReturnItems).innerJoin(salesReturns,eq(salesReturns.id,salesReturnItems.salesReturnId)).innerJoin(sales,eq(sales.id,salesReturns.saleId)).innerJoin(products,eq(products.id,salesReturnItems.productId)).where(and(eq(sales.companyId,companyId),...(from?[gte(salesReturns.returnDate,from)]:[]),...(to?[lte(salesReturns.returnDate,to)]:[]))),
      db.select({v:sql<string>`coalesce(sum(${salesReturnItems.quantity} * ${salesItems.unitPrice}),0)`}).from(salesReturnItems).innerJoin(salesReturns,eq(salesReturns.id,salesReturnItems.salesReturnId)).innerJoin(sales,eq(sales.id,salesReturns.saleId)).innerJoin(salesItems,eq(salesItems.id,salesReturnItems.saleItemId)).where(and(eq(sales.companyId,companyId),...(from?[gte(salesReturns.returnDate,from)]:[]),...(to?[lte(salesReturns.returnDate,to)]:[]))),
    ]);
    const netSales=Number(revenue[0]?.v||0)-Number(returnSubtotal[0]?.v||0);const cogs=Number(cost[0]?.v||0)-Number(returnCost[0]?.v||0);const expensesValue=Number(expenseTotal[0]?.v||0);headers=["Measure","Amount"];rows=[["Net sales (excluding tax, after returns)",netSales.toFixed(2)],["Cost of goods sold (estimated)",cogs.toFixed(2)],["Gross profit",(netSales-cogs).toFixed(2)],["Operating expenses",expensesValue.toFixed(2)],["Operating result",(netSales-cogs-expensesValue).toFixed(2)]];totals={netSales:netSales.toFixed(2),grossProfit:(netSales-cogs).toFixed(2),operatingResult:(netSales-cogs-expensesValue).toFixed(2)};
  } else {
    const salesFilters=[eq(sales.companyId,companyId),eq(sales.status,"confirmed")]; const purchaseFilters=[eq(purchases.companyId,companyId),eq(purchases.status,"confirmed")]; const expenseFilters=[eq(expenses.companyId,companyId)];
    if(from){salesFilters.push(gte(sales.invoiceDate,from));purchaseFilters.push(gte(purchases.invoiceDate,from));expenseFilters.push(gte(expenses.expenseDate,from));} if(to){salesFilters.push(lte(sales.invoiceDate,to));purchaseFilters.push(lte(purchases.invoiceDate,to));expenseFilters.push(lte(expenses.expenseDate,to));}
    const [saleTax,purchaseTax,saleReturns,purchaseReturnsTotal,expenseTotal]=await Promise.all([
      db.select({v:sql<string>`coalesce(sum(${sales.taxTotal}),0)`}).from(sales).where(and(...salesFilters)),
      db.select({v:sql<string>`coalesce(sum(${purchases.taxTotal}),0)`}).from(purchases).where(and(...purchaseFilters)),
      db.select({v:sql<string>`coalesce(sum(${salesReturns.total}),0)`}).from(salesReturns).innerJoin(sales,eq(sales.id,salesReturns.saleId)).where(and(eq(sales.companyId,companyId),...(from?[gte(salesReturns.returnDate,from)]:[]),...(to?[lte(salesReturns.returnDate,to)]:[]))),
      db.select({v:sql<string>`coalesce(sum(${purchaseReturns.total}),0)`}).from(purchaseReturns).innerJoin(purchases,eq(purchases.id,purchaseReturns.purchaseId)).where(and(eq(purchases.companyId,companyId),...(from?[gte(purchaseReturns.returnDate,from)]:[]),...(to?[lte(purchaseReturns.returnDate,to)]:[]))),
      db.select({v:sql<string>`coalesce(sum(${expenses.amount}),0)`}).from(expenses).where(and(...expenseFilters)),
    ]);
    headers=["Measure","Amount"]; rows=[["Output tax on confirmed sales",saleTax[0]?.v||"0"],["Input tax on confirmed purchases",purchaseTax[0]?.v||"0"],["Sales return credits (gross)",saleReturns[0]?.v||"0"],["Purchase return credits (gross)",purchaseReturnsTotal[0]?.v||"0"],["Operating expenses",expenseTotal[0]?.v||"0"]]; totals={};
  }
  if (csv) return new Response([headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${type}-report.csv"` } });
  return NextResponse.json({ type, from: from || null, to: to || null, headers, rows, totals, note: type === "gst" ? "Management summary from recorded invoice tax values; not a government-filed return." : type === "profit-loss" ? "Management estimate. Cost of goods sold uses current product purchase prices; historical landed cost and full statutory accounting are not represented." : undefined });
}
