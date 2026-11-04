import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import UserMenu from "./user-menu";
import SideNav from "./side-nav";
import WorkspaceSearch from "./workspace-search";
import PageMotion from "./page-motion";
import { MobileNavigationButton, MobileNavigationPanel, MobileNavigationProvider } from "./mobile-navigation";
import WorkspaceTitle from "./workspace-title";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/");
  const companyName=user.companyName||"Your company";
  return <div className="app-shell"><MobileNavigationProvider><MobileNavigationPanel companyName={companyName}><SideNav/><div className="side-bottom"><span className="workspace-mark user-mark">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.roleName || "Team member"}</small></span></div></MobileNavigationPanel>
    <div className="app-main"><div className="app-top"><MobileNavigationButton/><WorkspaceTitle/><WorkspaceSearch/><UserMenu name={user.name}/></div><PageMotion>{children}</PageMotion></div></MobileNavigationProvider></div>;
}
