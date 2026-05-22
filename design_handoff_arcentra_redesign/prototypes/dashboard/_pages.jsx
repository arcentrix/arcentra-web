/* Shared building blocks for dashboard pages.
   PageHeader, Panel, PanelHeader, FilterBar, StatusBadge. */

function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 0" }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6, maxWidth: 600 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--bg)",
      overflow: "hidden",
      ...style,
    }}>{children}</div>
  );
}

function PanelHeader({ title, sub, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function FilterBar({ filters }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {filters.map((f) => (
        <button key={f.label} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          height: 32, padding: "0 12px", borderRadius: 6,
          border: f.active ? "1px solid var(--border-strong)" : "1px solid var(--border)",
          background: f.active ? "var(--bg-elevated)" : "transparent",
          color: f.active ? "var(--fg)" : "var(--fg-muted)",
          fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500,
          cursor: "pointer",
        }}>
          {f.tone && <StatusDot tone={f.tone === "info" ? "info" : f.tone === "danger" ? "fail" : f.tone === "warn" ? "warn" : "muted"} />}
          {f.label}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: f.active ? "var(--fg-muted)" : "var(--fg-subtle)",
            fontVariantNumeric: "tabular-nums",
          }}>{f.count}</span>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ tone }) {
  if (tone === "ok")   return <Badge tone="success"><Icon d={I.check} size={10} />Passed</Badge>;
  if (tone === "fail") return <Badge tone="danger"><Icon d={I.x} size={10} />Failed</Badge>;
  if (tone === "info") return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 22, padding: "0 10px", borderRadius: 6,
      background: "color-mix(in oklab, var(--brand-signal) 10%, transparent)",
      color: "var(--brand-signal)",
      border: "1px solid var(--brand-signal-dim)",
      fontSize: 11.5, fontWeight: 600,
    }}>
      <Icon d={I.play} size={10} />Running
    </span>
  );
  if (tone === "warn") return <Badge tone="warn"><Icon d={I.pause} size={10} />Queued</Badge>;
  return <Badge variant="outline">{tone}</Badge>;
}

Object.assign(window, { PageHeader, Panel, PanelHeader, FilterBar, StatusBadge });
