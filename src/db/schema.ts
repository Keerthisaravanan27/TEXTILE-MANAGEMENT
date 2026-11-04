import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const partyType = pgEnum("party_type", ["customer", "supplier", "both"]);
export const documentStatus = pgEnum("document_status", ["draft", "confirmed", "cancelled"]);
export const paymentDirection = pgEnum("payment_direction", ["receipt", "payment"]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), legalName: text("legal_name"),
  gstin: text("gstin"), email: text("email"), phone: text("phone"), address: text("address"), city: text("city"),
  state: text("state"), pinCode: text("pin_code"), currency: text("currency").default("INR").notNull(),
  ...timestamps,
});
export const setupState = pgTable("setup_state", {
  id: integer("id").primaryKey(), completed: boolean("completed").default(false).notNull(),
  companyId: uuid("company_id").references(() => companies.id), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const companySettings = pgTable("company_settings", {
  companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"), businessType: text("business_type"), financialYearStartMonth: integer("financial_year_start_month").default(4).notNull(),
  invoicePrefix: text("invoice_prefix").default("INV").notNull(), bankDetails: text("bank_details"), paymentTerms: text("payment_terms"),
  invoiceFooter: text("invoice_footer"), authorizedSignatory: text("authorized_signatory"), ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(), description: text("description"), ...timestamps,
}, t => [uniqueIndex("roles_company_name_uq").on(t.companyId, t.name)]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(), username: text("username").notNull(), email: text("email"), emailVerified: timestamp("email_verified", { withTimezone: true }), image: text("image"), passwordHash: text("password_hash"),
  active: boolean("active").default(true).notNull(), ...timestamps,
}, t => [uniqueIndex("users_username_uq").on(t.username), uniqueIndex("users_email_uq").on(t.email), index("users_company_idx").on(t.companyId)]);

export const permissions = pgTable("permissions", { id: uuid("id").defaultRandom().primaryKey(), key: text("key").notNull().unique(), description: text("description") });
export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.roleId, t.permissionId] })]);
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.userId, t.roleId] })]);

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), type: text("type").notNull(),
  provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"),
  token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, t => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("auth_sessions_user_idx").on(t.userId)]);
export const loginAttempts = pgTable("login_attempts", {
  identifierHash: text("identifier_hash").primaryKey(), attempts: integer("attempts").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(), token: text("token").notNull(), expires: timestamp("expires", { mode: "date" }).notNull(),
}, t => [primaryKey({ columns: [t.identifier, t.token] })]);

export const parties = pgTable("parties", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  type: partyType("type").notNull(), name: text("name").notNull(), businessName: text("business_name"),
  contactPerson: text("contact_person"), phone: text("phone"), email: text("email"), gstin: text("gstin"),
  address: text("address"), city: text("city"), state: text("state"), pinCode: text("pin_code"),
  openingBalance: decimal("opening_balance", { precision: 14, scale: 2 }).default("0").notNull(),
  creditLimit: decimal("credit_limit", { precision: 14, scale: 2 }), active: boolean("active").default(true).notNull(), ...timestamps,
}, t => [index("parties_company_type_idx").on(t.companyId, t.type), index("parties_company_name_idx").on(t.companyId, t.name)]);

export const productCategories = pgTable("product_categories", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(), parentId: uuid("parent_id"), ...timestamps,
}, t => [uniqueIndex("categories_company_name_uq").on(t.companyId, t.name)]);
export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(), ...timestamps,
}, t => [uniqueIndex("brands_company_name_uq").on(t.companyId, t.name)]);
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(), abbreviation: text("abbreviation").notNull(), ...timestamps,
}, t => [uniqueIndex("units_company_abbreviation_uq").on(t.companyId, t.abbreviation)]);
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  categoryId: uuid("category_id").references(() => productCategories.id), brandId: uuid("brand_id").references(() => brands.id),
  unitId: uuid("unit_id").references(() => units.id), name: text("name").notNull(), sku: text("sku").notNull(),
  barcode: text("barcode"), hsnCode: text("hsn_code"), description: text("description"),
  purchasePrice: decimal("purchase_price", { precision: 14, scale: 2 }).default("0").notNull(),
  salePrice: decimal("sale_price", { precision: 14, scale: 2 }).default("0").notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0").notNull(),
  reorderLevel: decimal("reorder_level", { precision: 14, scale: 3 }).default("0").notNull(), active: boolean("active").default(true).notNull(), ...timestamps,
}, t => [uniqueIndex("products_company_sku_uq").on(t.companyId, t.sku), index("products_company_name_idx").on(t.companyId, t.name)]);
export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  productId: uuid("product_id").notNull().references(() => products.id), sku: text("sku").notNull(),
  color: text("color"), size: text("size"), pattern: text("pattern"), unitPrice: decimal("unit_price", { precision: 14, scale: 2 }),
  active: boolean("active").default(true).notNull(), ...timestamps,
}, t => [uniqueIndex("variants_company_sku_uq").on(t.companyId, t.sku), index("variants_product_idx").on(t.productId)]);

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  partyId: uuid("party_id").notNull().references(() => parties.id), number: text("number").notNull(), invoiceDate: date("invoice_date").notNull(),
  status: documentStatus("status").default("draft").notNull(), subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 14, scale: 2 }).default("0").notNull(), total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"), createdBy: uuid("created_by").references(() => users.id), ...timestamps,
}, t => [uniqueIndex("purchases_company_number_uq").on(t.companyId, t.number), index("purchases_company_date_idx").on(t.companyId, t.invoiceDate)]);
export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(), purchaseId: uuid("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id), variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(), unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0").notNull(), lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
});
export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  purchaseId: uuid("purchase_id").notNull().references(() => purchases.id), receiptNumber: text("receipt_number").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(), receivedBy: uuid("received_by").references(() => users.id),
}, t => [uniqueIndex("goods_receipts_company_number_uq").on(t.companyId, t.receiptNumber), uniqueIndex("goods_receipts_purchase_uq").on(t.purchaseId)]);
export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  partyId: uuid("party_id").notNull().references(() => parties.id), number: text("number").notNull(), invoiceDate: date("invoice_date").notNull(),
  status: documentStatus("status").default("draft").notNull(), subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 14, scale: 2 }).default("0").notNull(), total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"), createdBy: uuid("created_by").references(() => users.id), ...timestamps,
}, t => [uniqueIndex("sales_company_number_uq").on(t.companyId, t.number), index("sales_company_date_idx").on(t.companyId, t.invoiceDate)]);
export const salesItems = pgTable("sales_items", {
  id: uuid("id").defaultRandom().primaryKey(), saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id), variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(), unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0").notNull(), lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
});
export const salesReturns = pgTable("sales_returns", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  saleId: uuid("sale_id").notNull().references(() => sales.id), number: text("number").notNull(), returnDate: date("return_date").notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(), requestKey: text("request_key").notNull(), reason: text("reason"), createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("sales_returns_company_number_uq").on(t.companyId, t.number), uniqueIndex("sales_returns_idempotency_uq").on(t.companyId, t.requestKey), index("sales_returns_sale_idx").on(t.saleId)]);
export const salesReturnItems = pgTable("sales_return_items", {
  id: uuid("id").defaultRandom().primaryKey(), salesReturnId: uuid("sales_return_id").notNull().references(() => salesReturns.id),
  saleItemId: uuid("sale_item_id").notNull().references(() => salesItems.id), productId: uuid("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(), condition: text("condition").notNull(), amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
}, t => [index("sales_return_items_source_idx").on(t.saleItemId)]);
export const purchaseReturns = pgTable("purchase_returns", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  purchaseId: uuid("purchase_id").notNull().references(() => purchases.id), number: text("number").notNull(), returnDate: date("return_date").notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(), requestKey: text("request_key").notNull(), reason: text("reason"), createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("purchase_returns_company_number_uq").on(t.companyId, t.number), uniqueIndex("purchase_returns_idempotency_uq").on(t.companyId, t.requestKey), index("purchase_returns_purchase_idx").on(t.purchaseId)]);
export const purchaseReturnItems = pgTable("purchase_return_items", {
  id: uuid("id").defaultRandom().primaryKey(), purchaseReturnId: uuid("purchase_return_id").notNull().references(() => purchaseReturns.id),
  purchaseItemId: uuid("purchase_item_id").notNull().references(() => purchaseItems.id), productId: uuid("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(), amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
}, t => [index("purchase_return_items_source_idx").on(t.purchaseItemId)]);
export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  productId: uuid("product_id").notNull().references(() => products.id), variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).default("0").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("inventory_company_product_variant_uq").on(t.companyId, t.productId, t.variantId), uniqueIndex("inventory_company_product_base_uq").on(t.companyId, t.productId).where(sql`${t.variantId} is null`)]);
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  productId: uuid("product_id").notNull().references(() => products.id), variantId: uuid("variant_id").references(() => productVariants.id),
  quantityDelta: decimal("quantity_delta", { precision: 14, scale: 3 }).notNull(), unitCost: decimal("unit_cost", { precision: 14, scale: 2 }),
  sourceType: text("source_type").notNull(), sourceId: uuid("source_id"), idempotencyKey: text("idempotency_key").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(), createdBy: uuid("created_by").references(() => users.id),
}, t => [uniqueIndex("stock_movements_company_idempotency_uq").on(t.companyId, t.idempotencyKey), index("stock_movements_product_time_idx").on(t.productId, t.occurredAt)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  partyId: uuid("party_id").notNull().references(() => parties.id), direction: paymentDirection("direction").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(), method: text("method").notNull(), reference: text("reference"),
  paymentDate: date("payment_date").notNull(), idempotencyKey: text("idempotency_key").notNull(), notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id), ...timestamps,
}, t => [uniqueIndex("payments_company_idempotency_uq").on(t.companyId, t.idempotencyKey), index("payments_company_date_idx").on(t.companyId, t.paymentDate)]);
export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").defaultRandom().primaryKey(), paymentId: uuid("payment_id").notNull().references(() => payments.id),
  saleId: uuid("sale_id").references(() => sales.id), purchaseId: uuid("purchase_id").references(() => purchases.id),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("payment_allocations_sale_idx").on(t.saleId), index("payment_allocations_purchase_idx").on(t.purchaseId)]);
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  category: text("category").notNull(), description: text("description").notNull(), amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  expenseDate: date("expense_date").notNull(), createdBy: uuid("created_by").references(() => users.id), ...timestamps,
}, t => [index("expenses_company_date_idx").on(t.companyId, t.expenseDate)]);

export const invoiceSequences = pgTable("invoice_sequences", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").notNull().references(() => companies.id),
  documentType: text("document_type").notNull(), prefix: text("prefix").notNull(), currentValue: integer("current_value").default(0).notNull(),
  financialYear: text("financial_year").notNull(), ...timestamps,
}, t => [uniqueIndex("invoice_sequences_company_type_year_uq").on(t.companyId, t.documentType, t.financialYear)]);
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(), companyId: uuid("company_id").references(() => companies.id),
  userId: uuid("user_id").references(() => users.id), action: text("action").notNull(), entity: text("entity").notNull(),
  recordId: text("record_id"), reason: text("reason"), metadata: jsonb("metadata"), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("audit_logs_company_time_idx").on(t.companyId, t.occurredAt)]);
