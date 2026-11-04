import AppShell from "@/app/app-shell";
import ReportsClient from "./reports-client";
export default function ReportsPage(){return <AppShell><main className="app-content"><div className="page-title"><div><h1>Reports</h1><p>Review recorded business activity. Export filtered reports as CSV.</p></div></div><ReportsClient/></main></AppShell>}
