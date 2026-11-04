import AppShell from "@/app/app-shell";
import ExpensesClient from "./expenses-client";
export default function ExpensesPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Expenses</h1><p>Track operating expenses against your company workspace.</p></div></div><ExpensesClient/></main></AppShell>; }
