"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

type NavigationContextValue = { open: boolean; setOpen: (open: boolean) => void };
const NavigationContext = createContext<NavigationContextValue | null>(null);

export function MobileNavigationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return <NavigationContext.Provider value={{ open, setOpen }}>{children}</NavigationContext.Provider>;
}

function useMobileNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("Mobile navigation controls must be inside MobileNavigationProvider");
  return context;
}

export function MobileNavigationPanel({ companyName, children }: { companyName: string; children: React.ReactNode }) {
  const { open, setOpen } = useMobileNavigation();
  return (
    <>
      <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)} data-open={open} tabIndex={open ? 0 : -1} />
      <aside id="workspace-navigation" className="side mobile-nav-panel" data-open={open}>
        <Link className="brand company-brand" href="/dashboard" onClick={() => setOpen(false)}><span className="brand-icon">{companyName.slice(0, 1).toUpperCase()}</span><span className="brand-word"><strong>{companyName}</strong><small>TEXTILE OPERATIONS</small></span></Link>
        {children}
      </aside>
    </>
  );
}

export function MobileNavigationButton() {
  const { open, setOpen } = useMobileNavigation();
  return <button className="mobile-nav-toggle" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-controls="workspace-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={19}/> : <Menu size={19}/>}</button>;
}

export function useCloseMobileNavigation() {
  const context = useContext(NavigationContext);
  return () => context?.setOpen(false);
}
