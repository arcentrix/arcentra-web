/* Web app — Build page. Pipeline list (left) + detail (right).
   Adapted from arcentra-web/src/pages/Project/Pipelines + History. */

function Build({ onOpen }) {
  const pipelines = [
    { id: "#2148", name: "api · main",            branch: "main",          commit: "a4f9c2", status: "ok",      time: "2m ago",  duration: "8m 32s", project: "api-service" },
    { id: "#2147", name: "web · feat/auth-v2",    branch: "feat/auth-v2",  commit: "0bcf81", status: "info",    time: "now",     duration: "running", project: "web-app" },
    { id: "#2146", name: "worker · main",         branch: "main",          commit: "92ad11", status: "ok",      time: "21m ago", duration: "4m 12s", project: "worker" },
    { id: "#2145", name: "infra · release/1.4",   branch: "release/1.4",   commit: "ee2207", status: "warn",    time: "1h ago",  duration: "12m 04s", project: "infrastructure" },
    { id: "#2144", name: "data · etl/daily",      branch: "etl/daily",     commit: "8a31fc", status: "fail",    time: "1h ago",  duration: "2m 18s", project: "data-pipeline" },
    { id: "#2143", name: "ml · train-llm-7b",     branch: "train-llm-7b",  commit: "12bec0", status: "ok",      time: "3h ago",  duration: "42m 51s", project: "ml-platform" },
    { id: "#2142", name: "api · hotfix/cors",     branch: "hotfix/cors",   commit: "fcae90", status: "ok",      time: "5h ago",  duration: "3m 09s", project: "api-service" },
    { id: "#2141", name: "web · main",            branch: "main",          commit: "abc123", status: "ok",      time: "6h ago",  duration: "7m 44s", project: "web-app" },
  ];

  const [selectedId, setSelectedId] = React.useState("#2147");
  const selected = pipelines.find((p) => p.id === selectedId) || pipelines[0];

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="build / pipelines"
        title="Build"
        sub="Active and recent pipeline executions across all projects."
        action={<Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>New pipeline</Button>}
      />

      {/* Filter strip */}
      <FilterBar
        filters={[
          { label: "All",      count: 248, active: true },
          { label: "Running",  count: 12,  tone: "info" },
          { label: "Failed",   count: 52,  tone: "danger" },
          { label: "Queued",   count: 3,   tone: "warn" },
        ]}
      />

      {/* Two-column layout: list + detail */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* Pipeline list */}
        <Panel>
          <PanelHeader title="Recent runs" sub={`${pipelines.length} shown · last 24h`} />
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {pipelines.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto 1fr auto auto",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    border: 0,
                    borderTop: "none",
                    borderBottom: "1px solid var(--border)",
                    background: active ? "var(--bg-elevated)" : "transparent",
                    boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
                    padding: "12px 20px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "var(--fg)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                  }}>
                  <StatusDot tone={p.status} pulse={p.status === "info"} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)", width: 44 }}>{p.id}</span>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{p.commit}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", width: 64, textAlign: "right" }}>{p.time}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Detail */}
        <Panel>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow>pipeline · {selected.project}</Eyebrow>
              <StatusBadge tone={selected.status} />
            </div>
            <h3 className="display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 0" }}>{selected.name}</h3>
            <div style={{
              marginTop: 8, display: "flex", flexWrap: "wrap", gap: 14,
              fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-subtle)",
            }}>
              <span><Icon d={I.gitBranch} size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />{selected.branch}</span>
              <span>{selected.id}</span>
              <span>{selected.commit}</span>
              <span>{selected.duration}</span>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: 20 }}>
            <Eyebrow style={{ marginBottom: 10 }}>steps</Eyebrow>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Checkout",             "ok",      "2s"],
                ["Install dependencies", "ok",      "32s"],
                ["Lint & typecheck",     "ok",      "18s"],
                ["Unit tests",           "ok",      "1m 04s"],
                ["Build container",      selected.status === "info" ? "running" : "ok",  selected.status === "info" ? "0:42" : "1m 11s"],
                ["Push image",           selected.status === "info" ? "pending" : (selected.status === "fail" ? "fail" : "ok"), selected.status === "info" ? "—" : "23s"],
                ["Deploy",               selected.status === "info" ? "pending" : (selected.status === "fail" ? "pending" : "ok"), selected.status === "info" ? "—" : "1m 18s"],
              ].map(([name, status, duration]) => (
                <li key={name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 6,
                  border: status === "running" ? "1px solid var(--brand-signal-dim)" : "1px solid var(--border)",
                  background: status === "running" ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)" : "transparent",
                  padding: "8px 12px", fontSize: 13,
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, borderRadius: 9999,
                    border: "1px solid var(--border)",
                    color: status === "ok" ? "var(--accent-success)" : status === "fail" ? "var(--accent-danger)" : "var(--brand-signal)",
                  }}>
                    {status === "ok" && <Icon d={I.check} size={11} />}
                    {status === "fail" && <Icon d={I.x} size={11} />}
                    {status === "running" && <Icon d={I.loader} size={11} className="spin" />}
                  </span>
                  <span style={{ flex: 1, color: status === "pending" ? "var(--fg-subtle)" : "var(--fg)" }}>{name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", fontVariantNumeric: "tabular-nums" }}>{duration}</span>
                </li>
              ))}
            </ol>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: 16, display: "flex", gap: 8 }}>
            <Button variant="outline" size="sm" leftIcon={<Icon d={I.refresh} size={13} />}>Re-run</Button>
            <Button variant="ghost" size="sm">View logs</Button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Open in project</Button>
          </div>
        </Panel>
      </div>
    </section>
  );
}

window.Build = Build;
