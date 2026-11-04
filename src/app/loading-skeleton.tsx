export default function LoadingSkeleton({ title = "Loading workspace" }: { title?: string }) {
  return (
    <div className="loading-shell" aria-label={`${title} page loading`} role="status">
      <span className="sr-only">{title} page is loading</span>
      <aside className="loading-sidebar" aria-hidden="true">
        <div className="skeleton-brand"><i className="skeleton-block" /><span><i className="skeleton-line wide" /><i className="skeleton-line short" /></span></div>
        <i className="skeleton-line nav-heading" />
        {[0, 1, 2].map((group) => <div className="skeleton-nav-group" key={group}>{Array.from({ length: group === 1 ? 7 : 2 }).map((_, index) => <i className={`skeleton-line nav-item ${group === 1 && index === 1 ? "selected" : ""}`} key={index} />)}</div>)}
        <div className="skeleton-user"><i className="skeleton-block avatar" /><span><i className="skeleton-line wide" /><i className="skeleton-line short" /></span></div>
      </aside>
      <main className="loading-main" aria-hidden="true">
        <header className="loading-topbar"><i className="skeleton-line short" /><i className="skeleton-line search" /><i className="skeleton-block avatar" /></header>
        <section className="loading-content">
          <div className="loading-heading"><i className="skeleton-line title" /><i className="skeleton-line subtitle" /></div>
          <div className="loading-kpis">{[0, 1, 2, 3].map((item) => <div className="skeleton-card kpi-skeleton" key={item}><i className="skeleton-line short" /><i className="skeleton-line metric" /></div>)}</div>
          <div className="skeleton-card loading-table"><div className="skeleton-table-head"><i className="skeleton-line wide" /><i className="skeleton-line button-skeleton" /></div>{Array.from({ length: 6 }).map((_, index) => <div className="skeleton-table-row" key={index}><i className="skeleton-line row-primary" /><i className="skeleton-line row-secondary" /><i className="skeleton-line row-secondary" /><i className="skeleton-line row-end" /></div>)}</div>
        </section>
      </main>
    </div>
  );
}
