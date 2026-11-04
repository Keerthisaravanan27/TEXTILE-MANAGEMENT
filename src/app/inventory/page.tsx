import AppShell from "@/app/app-shell";
import InventoryClient from "./inventory-client";
export default function InventoryPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Inventory</h1><p>Current on-hand quantities and stock adjustments.</p></div></div><InventoryClient/></main></AppShell>; }
