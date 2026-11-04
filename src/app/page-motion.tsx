"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const pending = pendingPath !== null && pendingPath !== pathname;

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const beginNavigation = (destinationPath: string) => {
      if (destinationPath === window.location.pathname) return;
      setPendingPath(destinationPath);
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setPendingPath(null), 8000);
    };

    const onNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;

      beginNavigation(destination.pathname);
    };
    const onProgrammaticNavigation = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) beginNavigation(new URL(detail, window.location.href).pathname);
    };

    document.addEventListener("click", onNavigationClick, true);
    window.addEventListener("threadline:navigate", onProgrammaticNavigation);
    return () => {
      document.removeEventListener("click", onNavigationClick, true);
      window.removeEventListener("threadline:navigate", onProgrammaticNavigation);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, []);

  return (
    <>
      <div className="route-progress" data-active={pending} role="progressbar" aria-label="Loading page" />
      {pending && <div className="page-loading-overlay" role="status" aria-live="polite"><div className="page-loading-card"><span className="loader" aria-hidden="true"/><span>Loading page</span></div><span className="sr-only">Please wait while the next page loads.</span></div>}
      <div className="route-transition" data-pending={pending} aria-busy={pending}>
        <div className="route-frame" key={pathname}>{children}</div>
      </div>
    </>
  );
}
