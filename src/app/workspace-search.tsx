"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Banknote, Boxes, ClipboardList, LayoutDashboard, PackageSearch, Search, Settings, ShoppingCart, UserCog, Users, X } from "lucide-react";

const destinations = [
  { title:"Dashboard", detail:"Business overview", href:"/dashboard", icon:LayoutDashboard },
  { title:"Parties", detail:"Customers and suppliers", href:"/parties", icon:Users },
  { title:"Products", detail:"Catalogue and variants", href:"/products", icon:Boxes },
  { title:"Purchases", detail:"Supplier invoices and receiving", href:"/purchases", icon:ClipboardList },
  { title:"Inventory", detail:"Stock on hand and adjustments", href:"/inventory", icon:PackageSearch },
  { title:"Sales", detail:"Invoices and returns", href:"/sales", icon:ShoppingCart },
  { title:"Payments", detail:"Receipts and supplier payments", href:"/payments", icon:Banknote },
  { title:"Expenses", detail:"Operating expenses", href:"/expenses", icon:Banknote },
  { title:"Reports", detail:"Registers and summaries", href:"/reports", icon:BarChart3 },
  { title:"Company profile", detail:"Business and invoice settings", href:"/settings/company", icon:Settings },
  { title:"Team access", detail:"Staff and permissions", href:"/settings/team", icon:UserCog },
];

export default function WorkspaceSearch() {
  const router=useRouter(); const [open,setOpen]=useState(false);const [query,setQuery]=useState("");
  const results=useMemo(()=>destinations.filter(item=>`${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())),[query]);
  useEffect(()=>{function onKey(event:KeyboardEvent){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(true)}if(event.key==="Escape")setOpen(false)}window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
  function go(href:string){setOpen(false);setQuery("");window.dispatchEvent(new CustomEvent("threadline:navigate",{detail:href}));router.push(href)}
  return <><button className="global-search" type="button" onClick={()=>setOpen(true)}><Search size={16}/><span>Search workspace</span><kbd>Ctrl K</kbd></button>{open&&<div className="command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search workspace"><div className="command-input-row"><Search size={18}/><input autoFocus placeholder="Search pages and tools…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&results[0])go(results[0].href)}}/><button aria-label="Close search" onClick={()=>setOpen(false)}><X size={17}/></button></div><div className="command-caption">WORKSPACE</div><div className="command-results">{results.map(({title,detail,href,icon:Icon})=><button key={href} onClick={()=>go(href)}><span className="command-icon"><Icon size={17}/></span><span><strong>{title}</strong><small>{detail}</small></span><kbd>↵</kbd></button>)}{!results.length&&<div className="command-empty">No pages match “{query}”.</div>}</div><div className="command-footer"><span>Move through your workspace</span><span><kbd>ESC</kbd> close</span></div></section></div>}</>;
}
