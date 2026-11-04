import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, txDb } from "@/db";
import { auditLogs, companies, companySettings } from "@/db/schema";
import { currentUser, hasPermission } from "@/lib/auth";

const schema = z.object({ name: z.string().trim().min(2).max(160).optional(), legalName: z.string().max(180).nullable().optional(), gstin: z.string().max(20).nullable().optional(), email: z.string().email().max(254).nullable().or(z.literal("")).optional(), phone: z.string().max(30).nullable().optional(), address: z.string().max(500).nullable().optional(), city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(), pinCode: z.string().max(12).nullable().optional(), currency: z.string().length(3).optional(), invoicePrefix: z.string().trim().min(1).max(12).optional(), businessType: z.string().max(100).nullable().optional(), bankDetails: z.string().max(1000).nullable().optional(), paymentTerms: z.string().max(1000).nullable().optional(), invoiceFooter: z.string().max(1000).nullable().optional(), authorizedSignatory: z.string().max(160).nullable().optional() });
export async function GET() {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId));
  const [settings] = await db.select().from(companySettings).where(eq(companySettings.companyId, user.companyId));
  return NextResponse.json({ ...company, ...settings });
}
export async function PATCH(request: Request) {
  const user = await currentUser(); if (!user?.companyId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await hasPermission(user.id, "settings.write")) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid company settings." }, { status: 400 });
  const { invoicePrefix, businessType, bankDetails, paymentTerms, invoiceFooter, authorizedSignatory, ...companyValues } = parsed.data;
  const settings = { invoicePrefix, businessType, bankDetails, paymentTerms, invoiceFooter, authorizedSignatory, updatedAt: new Date() };
  await txDb.transaction(async tx => {
    if (Object.values(companyValues).some(v => v !== undefined)) await tx.update(companies).set({ ...companyValues, email: companyValues.email || null, updatedAt: new Date() }).where(eq(companies.id, user.companyId!));
    await tx.insert(companySettings).values({ companyId: user.companyId!, ...settings }).onConflictDoUpdate({ target: companySettings.companyId, set: settings });
    await tx.insert(auditLogs).values({ companyId: user.companyId!, userId: user.id, action: "company.settings.updated", entity: "company", recordId: user.companyId! });
  });
  return GET();
}
