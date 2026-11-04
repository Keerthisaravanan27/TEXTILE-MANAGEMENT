import AppShell from "@/app/app-shell";
import TeamClient from "./team-client";

export default function TeamPage() {
  return <AppShell><main className="app-content"><div className="page-title"><div><h1>Team access</h1><p>Manage staff accounts and the permissions they need for daily work.</p></div></div><TeamClient/></main></AppShell>;
}
