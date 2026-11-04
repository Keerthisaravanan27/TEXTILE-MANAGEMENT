import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import UserMenu from "./user-menu";
import SideNav from "./side-nav";
import WorkspaceSearch from "./workspace-search";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/");
  const companyName=user.companyName||"Your company";
  return <div className="app-shell"><aside className="side"><Link className="brand company-brand" href="/dashboard"><span className="brand-icon">{companyName.slice(0,1).toUpperCase()}</span><span className="brand-word"><strong>{companyName}</strong><small>TEXTILE OPERATIONS</small></span></Link><SideNav/><div className="side-bottom"><span className="workspace-mark user-mark">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.roleName || "Team member"}</small></span></div></aside>
    <div className="app-main"><div className="app-top"><div className="top-context"><span className="crumb-kicker">WORKSPACE</span><strong>Business overview</strong></div><WorkspaceSearch/><UserMenu name={user.name}/></div>{children}</div></div>;
}
