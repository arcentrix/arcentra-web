/* Web app — Projects list page (lifted from arcentra-web/src/pages/Projects).
   Shows the project grid with search, filters, and per-project pipeline stats. */

function Projects({ onOpen }) {
  const projects = [
    { name: "web-app",        desc: "Customer-facing web client",         lang: "TypeScript", pipelines: 12, lastRun: "2m ago",  status: "ok" },
    { name: "api-service",    desc: "Public REST API + GraphQL gateway", lang: "Go",         pipelines: 18, lastRun: "8m ago",  status: "info" },
    { name: "mobile-app",     desc: "iOS + Android React Native client", lang: "TypeScript", pipelines: 9,  lastRun: "21m ago", status: "ok" },
    { name: "data-pipeline",  desc: "Daily ETL + feature-store backfill", lang: "Python",     pipelines: 6,  lastRun: "1h ago",  status: "warn" },
    { name: "infrastructure", desc: "Terraform + ArgoCD platform configs", lang: "HCL",        pipelines: 4,  lastRun: "3h ago",  status: "ok" },
    { name: "ml-platform",    desc: "Training jobs + eval harness",      lang: "Python",      pipelines: 11, lastRun: "12m ago", status: "info" },
  ];
  const [q, setQ] = React.useState("");
  const filtered = projects.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <Eyebrow>projects / all</Eyebrow>
          <h2 className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Projects</h2>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>6 projects · 60 pipelines · 4 clusters</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>New Project</Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          height: 36, padding: "0 12px", borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--bg-elevated)",
          flex: 1, maxWidth: 360,
        }}>
          <Icon d={I.search} size={14} className="muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              color: "var(--fg)", fontFamily: "var(--font-sans)", fontSize: 13,
            }}
          />
        </div>
        <Button variant="outline" size="sm">All</Button>
        <Button variant="ghost" size="sm">Active</Button>
        <Button variant="ghost" size="sm">Archived</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filtered.map((p) => (
          <article key={p.name} onClick={() => onOpen?.(p.name)} style={{
            borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--bg)", padding: 20,
            cursor: "pointer",
            transition: "border-color var(--duration-2), background-color var(--duration-2)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.backgroundColor = "var(--bg-elevated)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--bg)"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon d={I.frame} size={14} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{p.name}</h3>
              </div>
              <StatusDot tone={p.status} pulse={p.status === "info"} />
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>{p.desc}</p>
            <div style={{
              marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)",
            }}>
              <span>{p.lang}</span>
              <span>{p.pipelines} pipelines</span>
              <span>{p.lastRun}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

window.Projects = Projects;
