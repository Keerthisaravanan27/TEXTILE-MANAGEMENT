import { Pool } from "@neondatabase/serverless";
import argon2 from "argon2";

const companyName = process.env.INITIAL_COMPANY_NAME?.trim();
const username = process.env.INITIAL_USERNAME?.trim().toLowerCase();
const password = process.env.INITIAL_PASSWORD;
if (!process.env.DATABASE_URL || !companyName || !username || !password) {
  throw new Error("Set DATABASE_URL, INITIAL_COMPANY_NAME, INITIAL_USERNAME, and INITIAL_PASSWORD.");
}
if (password.length < 8) throw new Error("INITIAL_PASSWORD must contain at least 8 characters.");

const permissions = ["parties.read", "parties.write", "products.read", "products.write", "purchases.read", "purchases.write", "inventory.read", "inventory.write", "sales.read", "sales.write", "payments.read", "payments.write", "expenses.read", "expenses.write", "reports.read", "settings.write", "users.write"];
const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO setup_state (id, completed) VALUES (1, false) ON CONFLICT (id) DO NOTHING");
  const { rows: [state] } = await client.query("SELECT completed FROM setup_state WHERE id = 1 FOR UPDATE");
  if (state.completed) throw new Error("Initial owner setup has already been completed.");
  const { rows: [company] } = await client.query("INSERT INTO companies (name) VALUES ($1) RETURNING id", [companyName]);
  await client.query("INSERT INTO company_settings (company_id) VALUES ($1)", [company.id]);
  const { rows: [role] } = await client.query("INSERT INTO roles (company_id,name,description) VALUES ($1,'Owner','Full access') RETURNING id", [company.id]);
  for (const key of permissions) await client.query("INSERT INTO permissions (key) VALUES ($1) ON CONFLICT (key) DO NOTHING", [key]);
  const { rows: permissionRows } = await client.query("SELECT id FROM permissions WHERE key = ANY($1::text[])", [permissions]);
  for (const permission of permissionRows) await client.query("INSERT INTO role_permissions (role_id,permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [role.id, permission.id]);
  const { rows: [owner] } = await client.query("INSERT INTO users (company_id,name,username,password_hash) VALUES ($1,'Owner',$2,$3) RETURNING id", [company.id, username, passwordHash]);
  await client.query("INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2)", [owner.id, role.id]);
  await client.query("UPDATE setup_state SET completed=true, company_id=$1, updated_at=now() WHERE id=1", [company.id]);
  await client.query("INSERT INTO audit_logs (company_id,user_id,action,entity,record_id) VALUES ($1,$2,'owner.created','user',$3)", [company.id, owner.id, owner.id]);
  await client.query("COMMIT");
  console.log(`Created the initial owner account for ${companyName} (username: ${username}).`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
