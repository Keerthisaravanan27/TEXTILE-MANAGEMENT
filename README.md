# Threadline Textile ERP

Business management workspace for a wholesale textile and clothing company. Built with Next.js App Router, Auth.js credentials, Drizzle ORM, and PostgreSQL/Neon.

## Run locally

1. Install Node.js 20 or later and run `npm install`.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
3. Apply the checked in migrations with `npm run db:migrate` (or generate and review a new migration with `npm run db:generate`).
4. Run `npm run dev` and open the local URL printed by Next.js. If it reports port 3000 is in use, stop the previous `next dev` process in its terminal before restarting.

Never commit `.env.local`. Keep production and development on separate Neon branches. Rotate credentials if a database URL or password has been shared outside the deployment secret store.

## Implemented workflows

- Company owner setup, credential sign-in, Argon2id password hashing, throttling, session revocation, and audit records.
- Company scoped roles and permissions; create and deactivate/reactivate staff accounts; assign roles and permissions.
- Company profile and invoice identity settings.
- Customer and supplier records with edit/deactivation, product catalogue with edit and size/color/pattern variants, stock adjustments, stock movement history, and low stock visibility.
- Draft purchases can be edited before receiving; receiving is explicit. Received purchases are locked and corrected through purchase returns. Sales invoices post with stock checks, with returns supporting resalable/damaged handling.
- Payment receipts and supplier payments allocated to invoices, outstanding balances, and operating expense entry.
- Dashboard, sales and purchase registers, inventory valuation, GST management summary, and CSV report downloads.
- Browser printable sales invoices and purchase vouchers (Print / Save as PDF).

## Accounting and operational limits

This is an operational management system, not a complete statutory accounting package. The profit and loss report is an estimate: it values sold stock using the current product purchase price, so it does not provide historical landed cost, weighted-average/FIFO costing, a full double-entry ledger, bank reconciliation, or statutory financial statements. The GST summary is not a filed return. Printable invoices use the company tax setup and captured transaction data; validate tax treatment and invoice wording with the company's accountant before using them as statutory documents. Category, brand, and unit tables are in the database model, but dedicated management screens are not yet included.

The owner account was created in the configured database during setup. Sign in with the owner username and password supplied for the workspace; the password is stored only as a hash. For security, change the initial password after first sign-in and rotate any exposed database password.

`DATABASE_URL` is read only by server-side code and is never imported into client components.
