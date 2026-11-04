import AppShell from "@/app/app-shell";
import PartiesClient from "./parties-client";

export default function PartiesPage() {
  return <AppShell><main className="app-content"><div className="page-title"><div><h1>Parties</h1><p>Manage customers and suppliers for this workspace.</p></div></div><PartiesClient/></main></AppShell>;
}
