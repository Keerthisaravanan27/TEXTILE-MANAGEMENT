"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Banknote, Boxes, ClipboardList, LayoutDashboard, PackageSearch, Settings, ShoppingCart, Users, UserCog } from "lucide-react";
import { useCloseMobileNavigation } from "./mobile-navigation";
const groups = [
  { label: "OVERVIEW", items: [["Dashboard", "/dashboard", LayoutDashboard]] as const },
  { label: "BUSINESS", items: [["Parties", "/parties", Users], ["Products", "/products", Boxes], ["Purchases", "/purchases", ClipboardList], ["Inventory", "/inventory", PackageSearch], ["Sales", "/sales", ShoppingCart], ["Payments", "/payments", Banknote], ["Expenses", "/expenses", Banknote]] as const },
  { label: "ADMINISTRATION", items: [["Company profile", "/settings/company", Settings], ["Team access", "/settings/team", UserCog], ["Reports", "/reports", BarChart3]] as const },
];
export default function SideNav() {
  const path = usePathname();
  const closeNavigation = useCloseMobileNavigation();
  return <nav className="side-nav">{groups.map(group => <div className="nav-group" key={group.label}><div className="side-label">{group.label}</div>{group.items.map(([label, href, Icon]) => <Link className={`nav-link ${path === href || (href !== "/dashboard" && path.startsWith(href + "/")) ? "active" : ""}`} href={href} key={href} onClick={closeNavigation}><Icon size={17}/><span>{label}</span></Link>)}</div>)}</nav>;
}
