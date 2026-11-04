import AppShell from "@/app/app-shell";
import CompanyClient from "./company-client";
export default function CompanyPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Company profile</h1><p>Business identity and invoice details for this workspace.</p></div></div><CompanyClient/></main></AppShell>; }
