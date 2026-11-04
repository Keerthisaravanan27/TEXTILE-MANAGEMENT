"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const pending = pendingPath !== null && pendingPath !== pathname;

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const onNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;

      setPendingPath(destination.pathname);
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setPendingPath(null), 8000);
    };

    document.addEventListener("click", onNavigationClick, true);
    return () => {
      document.removeEventListener("click", onNavigationClick, true);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, []);

  return (
    <>
      <div className="route-progress" data-active={pending} role="progressbar" aria-label="Loading page" />
      <div className="route-transition" data-pending={pending} aria-busy={pending}>
        <div className="route-frame" key={pathname}>{children}</div>
      </div>
    </>
  );
}
