import AppShell from "@/app/app-shell";
import PaymentsClient from "./payments-client";
export default function PaymentsPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Payments</h1><p>Record customer receipts and supplier payments against confirmed invoices.</p></div></div><PaymentsClient/></main></AppShell>; }
