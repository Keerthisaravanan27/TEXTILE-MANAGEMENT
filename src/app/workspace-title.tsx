"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, { title: string; section: string }> = {
  "/dashboard": { title: "Business overview", section: "OVERVIEW" },
  "/parties": { title: "Parties", section: "BUSINESS" },
  "/products": { title: "Products", section: "BUSINESS" },
  "/purchases": { title: "Purchases", section: "BUSINESS" },
  "/inventory": { title: "Inventory", section: "BUSINESS" },
  "/sales": { title: "Sales", section: "BUSINESS" },
  "/payments": { title: "Payments", section: "BUSINESS" },
  "/expenses": { title: "Expenses", section: "BUSINESS" },
  "/reports": { title: "Reports", section: "ADMINISTRATION" },
  "/settings/company": { title: "Company profile", section: "ADMINISTRATION" },
  "/settings/team": { title: "Team access", section: "ADMINISTRATION" },
};

export default function WorkspaceTitle() {
  const pathname = usePathname();
  const current = titles[pathname] ?? titles[Object.keys(titles).find((path) => pathname.startsWith(`${path}/`)) ?? "/dashboard"];
  return <div className="top-context" aria-live="polite"><span className="crumb-kicker">{current.section}</span><strong>{current.title}</strong></div>;
}
