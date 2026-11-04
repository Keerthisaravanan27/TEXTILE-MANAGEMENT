import AppShell from "@/app/app-shell";
import TransactionClient from "@/app/transaction-client";
export default function PurchasesPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Purchases</h1><p>Record supplier invoices and post goods receipts to stock.</p></div></div><TransactionClient kind="purchase"/></main></AppShell>; }
