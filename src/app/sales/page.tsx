import AppShell from "@/app/app-shell";
import TransactionClient from "@/app/transaction-client";
export default function SalesPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Sales invoices</h1><p>Confirmed sales reduce stock and receive a unique invoice number.</p></div></div><TransactionClient kind="sale"/></main></AppShell>; }
