CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TYPE party_type AS ENUM ('customer','supplier','both');
--> statement-breakpoint
CREATE TYPE document_status AS ENUM ('draft','confirmed','cancelled');
--> statement-breakpoint
CREATE TYPE payment_direction AS ENUM ('receipt','payment');
--> statement-breakpoint
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, legal_name text, gstin text, email text, phone text, address text, city text, state text, pin_code text, currency text NOT NULL DEFAULT 'INR', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE setup_state (id integer PRIMARY KEY, completed boolean NOT NULL DEFAULT false, company_id uuid REFERENCES companies(id), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE company_settings (company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE, logo_url text, business_type text, financial_year_start_month integer NOT NULL DEFAULT 4, invoice_prefix text NOT NULL DEFAULT 'INV', bank_details text, payment_terms text, invoice_footer text, authorized_signatory text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id) ON DELETE CASCADE, name text NOT NULL, description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX roles_company_name_uq ON roles(company_id,name);
--> statement-breakpoint
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id) ON DELETE CASCADE, name text NOT NULL, username text NOT NULL, email text, email_verified timestamptz, image text, password_hash text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX users_username_uq ON users(username);
--> statement-breakpoint
CREATE UNIQUE INDEX users_email_uq ON users(email);
--> statement-breakpoint
CREATE INDEX users_company_idx ON users(company_id);
--> statement-breakpoint
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, description text);
--> statement-breakpoint
CREATE TABLE role_permissions (role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY(role_id,permission_id));
--> statement-breakpoint
CREATE TABLE user_roles (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY(user_id,role_id));
--> statement-breakpoint
CREATE TABLE accounts (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, type text NOT NULL, provider text NOT NULL, provider_account_id text NOT NULL, refresh_token text, access_token text, expires_at integer, token_type text, scope text, id_token text, session_state text, PRIMARY KEY(provider,provider_account_id));
--> statement-breakpoint
CREATE TABLE sessions (session_token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires timestamp NOT NULL);
--> statement-breakpoint
CREATE TABLE auth_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
--> statement-breakpoint
CREATE TABLE login_attempts (identifier_hash text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_started_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz);
--> statement-breakpoint
CREATE TABLE verification_tokens (identifier text NOT NULL, token text NOT NULL, expires timestamp NOT NULL, PRIMARY KEY(identifier,token));
--> statement-breakpoint
CREATE TABLE parties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), type party_type NOT NULL, name text NOT NULL, business_name text, contact_person text, phone text, email text, gstin text, address text, city text, state text, pin_code text, opening_balance numeric(14,2) NOT NULL DEFAULT 0, credit_limit numeric(14,2), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX parties_company_type_idx ON parties(company_id,type);
--> statement-breakpoint
CREATE INDEX parties_company_name_idx ON parties(company_id,name);
--> statement-breakpoint
CREATE TABLE product_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, parent_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX categories_company_name_uq ON product_categories(company_id,name);
--> statement-breakpoint
CREATE TABLE brands (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX brands_company_name_uq ON brands(company_id,name);
--> statement-breakpoint
CREATE TABLE units (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, abbreviation text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX units_company_abbreviation_uq ON units(company_id,abbreviation);
--> statement-breakpoint
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), category_id uuid REFERENCES product_categories(id), brand_id uuid REFERENCES brands(id), unit_id uuid REFERENCES units(id), name text NOT NULL, sku text NOT NULL, barcode text, hsn_code text, description text, purchase_price numeric(14,2) NOT NULL DEFAULT 0, sale_price numeric(14,2) NOT NULL DEFAULT 0, tax_rate numeric(5,2) NOT NULL DEFAULT 0, reorder_level numeric(14,3) NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX products_company_sku_uq ON products(company_id,sku);
--> statement-breakpoint
CREATE INDEX products_company_name_idx ON products(company_id,name);
--> statement-breakpoint
CREATE TABLE product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL REFERENCES products(id), sku text NOT NULL, color text, size text, pattern text, unit_price numeric(14,2), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX variants_company_sku_uq ON product_variants(company_id,sku);
--> statement-breakpoint
CREATE INDEX variants_product_idx ON product_variants(product_id);
--> statement-breakpoint
CREATE TABLE purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), party_id uuid NOT NULL REFERENCES parties(id), number text NOT NULL, invoice_date date NOT NULL, status document_status NOT NULL DEFAULT 'draft', subtotal numeric(14,2) NOT NULL, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL, notes text, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX purchases_company_number_uq ON purchases(company_id,number);
--> statement-breakpoint
CREATE INDEX purchases_company_date_idx ON purchases(company_id,invoice_date);
--> statement-breakpoint
CREATE TABLE purchase_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), variant_id uuid REFERENCES product_variants(id), quantity numeric(14,3) NOT NULL, unit_price numeric(14,2) NOT NULL, tax_rate numeric(5,2) NOT NULL DEFAULT 0, line_total numeric(14,2) NOT NULL);
--> statement-breakpoint
CREATE TABLE goods_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), purchase_id uuid NOT NULL REFERENCES purchases(id), receipt_number text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), received_by uuid REFERENCES users(id));
--> statement-breakpoint
CREATE UNIQUE INDEX goods_receipts_company_number_uq ON goods_receipts(company_id,receipt_number);
--> statement-breakpoint
CREATE UNIQUE INDEX goods_receipts_purchase_uq ON goods_receipts(purchase_id);
--> statement-breakpoint
CREATE TABLE sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), party_id uuid NOT NULL REFERENCES parties(id), number text NOT NULL, invoice_date date NOT NULL, status document_status NOT NULL DEFAULT 'draft', subtotal numeric(14,2) NOT NULL, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL, notes text, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX sales_company_number_uq ON sales(company_id,number);
--> statement-breakpoint
CREATE INDEX sales_company_date_idx ON sales(company_id,invoice_date);
--> statement-breakpoint
CREATE TABLE sales_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), variant_id uuid REFERENCES product_variants(id), quantity numeric(14,3) NOT NULL, unit_price numeric(14,2) NOT NULL, tax_rate numeric(5,2) NOT NULL DEFAULT 0, line_total numeric(14,2) NOT NULL);
--> statement-breakpoint
CREATE TABLE sales_returns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), sale_id uuid NOT NULL REFERENCES sales(id), number text NOT NULL, return_date date NOT NULL, total numeric(14,2) NOT NULL, request_key text NOT NULL, reason text, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX sales_returns_company_number_uq ON sales_returns(company_id,number);
--> statement-breakpoint
CREATE UNIQUE INDEX sales_returns_idempotency_uq ON sales_returns(company_id,request_key);
--> statement-breakpoint
CREATE INDEX sales_returns_sale_idx ON sales_returns(sale_id);
--> statement-breakpoint
CREATE TABLE sales_return_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sales_return_id uuid NOT NULL REFERENCES sales_returns(id), sale_item_id uuid NOT NULL REFERENCES sales_items(id), product_id uuid NOT NULL REFERENCES products(id), quantity numeric(14,3) NOT NULL, condition text NOT NULL, amount numeric(14,2) NOT NULL);
--> statement-breakpoint
CREATE INDEX sales_return_items_source_idx ON sales_return_items(sale_item_id);
--> statement-breakpoint
CREATE TABLE purchase_returns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), purchase_id uuid NOT NULL REFERENCES purchases(id), number text NOT NULL, return_date date NOT NULL, total numeric(14,2) NOT NULL, request_key text NOT NULL, reason text, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX purchase_returns_company_number_uq ON purchase_returns(company_id,number);
--> statement-breakpoint
CREATE UNIQUE INDEX purchase_returns_idempotency_uq ON purchase_returns(company_id,request_key);
--> statement-breakpoint
CREATE INDEX purchase_returns_purchase_idx ON purchase_returns(purchase_id);
--> statement-breakpoint
CREATE TABLE purchase_return_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_return_id uuid NOT NULL REFERENCES purchase_returns(id), purchase_item_id uuid NOT NULL REFERENCES purchase_items(id), product_id uuid NOT NULL REFERENCES products(id), quantity numeric(14,3) NOT NULL, amount numeric(14,2) NOT NULL);
--> statement-breakpoint
CREATE INDEX purchase_return_items_source_idx ON purchase_return_items(purchase_item_id);
--> statement-breakpoint
CREATE TABLE inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL REFERENCES products(id), variant_id uuid REFERENCES product_variants(id), quantity numeric(14,3) NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_company_product_variant_uq ON inventory(company_id,product_id,variant_id);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_company_product_base_uq ON inventory(company_id,product_id) WHERE variant_id IS NULL;
--> statement-breakpoint
CREATE TABLE stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL REFERENCES products(id), variant_id uuid REFERENCES product_variants(id), quantity_delta numeric(14,3) NOT NULL, unit_cost numeric(14,2), source_type text NOT NULL, source_id uuid, idempotency_key text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id));
--> statement-breakpoint
CREATE UNIQUE INDEX stock_movements_company_idempotency_uq ON stock_movements(company_id,idempotency_key);
--> statement-breakpoint
CREATE INDEX stock_movements_product_time_idx ON stock_movements(product_id,occurred_at);
--> statement-breakpoint
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), party_id uuid NOT NULL REFERENCES parties(id), direction payment_direction NOT NULL, amount numeric(14,2) NOT NULL, method text NOT NULL, reference text, payment_date date NOT NULL, idempotency_key text NOT NULL, notes text, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX payments_company_idempotency_uq ON payments(company_id,idempotency_key);
--> statement-breakpoint
CREATE INDEX payments_company_date_idx ON payments(company_id,payment_date);
--> statement-breakpoint
CREATE TABLE payment_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), sale_id uuid REFERENCES sales(id), purchase_id uuid REFERENCES purchases(id), amount numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX payment_allocations_sale_idx ON payment_allocations(sale_id);
--> statement-breakpoint
CREATE INDEX payment_allocations_purchase_idx ON payment_allocations(purchase_id);
--> statement-breakpoint
CREATE TABLE expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), category text NOT NULL, description text NOT NULL, amount numeric(14,2) NOT NULL, expense_date date NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX expenses_company_date_idx ON expenses(company_id,expense_date);
--> statement-breakpoint
CREATE TABLE invoice_sequences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), document_type text NOT NULL, prefix text NOT NULL, current_value integer NOT NULL DEFAULT 0, financial_year text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX invoice_sequences_company_type_year_uq ON invoice_sequences(company_id,document_type,financial_year);
--> statement-breakpoint
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id), user_id uuid REFERENCES users(id), action text NOT NULL, entity text NOT NULL, record_id text, reason text, metadata jsonb, occurred_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX audit_logs_company_time_idx ON audit_logs(company_id,occurred_at);
--> statement-breakpoint
