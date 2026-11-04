import AppShell from "@/app/app-shell";
import ProductsClient from "./products-client";
export default function ProductsPage() { return <AppShell><main className="app-content"><div className="page-title"><div><h1>Product catalogue</h1><p>Manage textile items, prices, tax rates, and reorder levels.</p></div></div><ProductsClient/></main></AppShell>; }
