"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Party = { id: string; type: "customer" | "supplier" | "both"; name: string; businessName: string | null; contactPerson:string|null;phone: string | null; email: string | null; gstin: string | null; address:string|null;city:string|null;state:string|null;pinCode:string|null;openingBalance: string;creditLimit:string|null; active: boolean };
type Result = { items: Party[]; total: number; page: number; pageSize: number };
const currency = (n: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n || 0));

export default function PartiesClient() {
  const [data, setData] = useState<Result>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState(""); const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false); const [editing,setEditing]=useState<Party|null>(null);const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => {
    const p = new URLSearchParams({ q: search, page: String(page), pageSize: "25" }); if (filter) p.set("type", filter);
    const response = await fetch(`/api/parties?${p}`); const result = await response.json();
    if (response.ok) setData(result); else setError(result.error || "Could not load parties.");
  }, [search, filter, page]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 180); return () => clearTimeout(timer); }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form);
    const response = await fetch(editing?`/api/parties/${editing.id}`:"/api/parties", { method: editing?"PATCH":"POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setError(result.error || "Could not save this party."); return; }
    setOpen(false); setEditing(null); await load();
  }
  async function deactivate(party: Party) {
    if (!window.confirm(`Deactivate ${party.name}?`)) return;
    const response = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json(); setError(result.error || "Could not deactivate party."); return; }
    await load();
  }
  return <>
    <section className="panel"><div className="toolbar"><input className="control" placeholder="Search name, phone, email" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/><select className="control" style={{ maxWidth: 160 }} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All parties</option><option value="customer">Customers</option><option value="supplier">Suppliers</option></select><button className="button primary" onClick={() => { setError("");setEditing(null); setOpen(true); }}>Add party</button></div>
      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>GSTIN</th><th>Opening balance</th><th></th></tr></thead><tbody>
        {data.items.map(p => <tr key={p.id}><td><strong>{p.name}</strong>{p.businessName && <div className="muted">{p.businessName}</div>}</td><td><span className="pill">{p.type}</span></td><td>{p.phone || p.email || "—"}</td><td>{p.gstin || "—"}</td><td>{currency(p.openingBalance)}</td><td><div className="action-row"><button className="button" onClick={()=>{setEditing(p);setError("");setOpen(true)}}>Edit</button><button className="button danger" onClick={() => void deactivate(p)}>Deactivate</button></div></td></tr>)}
        {!data.items.length && <tr><td colSpan={6} className="empty">No matching parties yet. Add a customer or supplier to begin.</td></tr>}
      </tbody></table></div><div className="pagination"><span>{data.total} records</span><div><button className="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span> Page {page} </span><button className="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </section>
    {open && <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) {setOpen(false);setEditing(null)} }}><section className="modal"><h2>{editing?"Edit party":"Add a party"}</h2><form key={editing?.id||"new-party"} onSubmit={save}><div className="form-grid">
      <label>Party type<select className="control" name="type" defaultValue={editing?.type||"customer"}><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option></select></label>
      <label>Name *<input className="control" name="name" required maxLength={160} defaultValue={editing?.name}/></label><label>Business name<input className="control" name="businessName" maxLength={160} defaultValue={editing?.businessName||""}/></label><label>Contact person<input className="control" name="contactPerson" maxLength={120} defaultValue={editing?.contactPerson||""}/></label><label>Phone<input className="control" name="phone" maxLength={30} defaultValue={editing?.phone||""}/></label><label>Email<input className="control" type="email" name="email" maxLength={254} defaultValue={editing?.email||""}/></label><label>GSTIN<input className="control" name="gstin" maxLength={20} defaultValue={editing?.gstin||""}/></label><label>Opening balance<input className="control" type="number" step="0.01" name="openingBalance" defaultValue={editing?.openingBalance||"0"}/></label><label>Credit limit<input className="control" type="number" min="0" step="0.01" name="creditLimit" defaultValue={editing?.creditLimit||""}/></label><label className="full">Address<input className="control" name="address" maxLength={500} defaultValue={editing?.address||""}/></label><label>City<input className="control" name="city" defaultValue={editing?.city||""}/></label><label>State<input className="control" name="state" defaultValue={editing?.state||""}/></label><label>PIN code<input className="control" name="pinCode" maxLength={12} defaultValue={editing?.pinCode||""}/></label>
      </div>{error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}<div className="modal-actions"><button type="button" className="button" onClick={() => {setOpen(false);setEditing(null)}}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : editing?"Save changes":"Save party"}</button></div></form></section></div>}
  </>;
}
