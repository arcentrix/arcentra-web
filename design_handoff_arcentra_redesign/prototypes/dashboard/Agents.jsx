/* Web app — Agents page. Runner grid + per-cluster summary + per-runner detail. */

function Agents() {
  const runners = Array.from({ length: 32 }).map((_, i) => ({
    id: `runner-${(i + 1).toString().padStart(2, "0")}`,
    cluster: ["prod-eu", "prod-us", "edge", "dev"][i % 4],
    arch: ["x86_64", "arm64"][i % 2],
    status: i % 13 === 0 ? "warn" : i % 9 === 0 ? "muted" : i % 5 === 0 ? "info" : "ok",
    load: 30 + ((i * 13) % 65),
    runs: 80 + ((i * 7) % 50),
    version: "v0.4.0",
  }));

  const clusters = [
    { name: "prod-eu", runners: 12, idle: 1, region: "eu-west-1",  type: "k8s" },
    { name: "prod-us", runners: 9,  idle: 0, region: "us-east-2",  type: "k8s" },
    { name: "edge",    runners: 4,  idle: 2, region: "private vpn",type: "docker" },
    { name: "dev",     runners: 3,  idle: 1, region: "us-west-1",  type: "k8s" },
  ];

  const [selectedId, setSelectedId] = React.useState(runners[0].id);
  const selected = runners.find((r) => r.id === selectedId);

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="agents / runtime"
        title="Agents"
        sub="Distributed runners and execution targets across all clusters."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.copy} size={14} />}>Register token</Button>
            <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>Add runner</Button>
          </div>
        }
      />

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          ["Active",   "28", "of 32 registered"],
          ["Idle",     "4",  "ready for work"],
          ["Capacity", "67%","68 / 100 slots"],
          ["Through",  "2.4k","jobs / 24h"],
        ].map(([label, value, sub]) => (
          <Panel key={label} style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em",
                          textTransform: "uppercase", color: "var(--fg-subtle)" }}>{label}</div>
            <div className="reading" style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)",
                  letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6 }}>{sub}</div>
          </Panel>
        ))}
      </div>

      {/* Body: runner grid + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* Runner cards */}
        <Panel>
          <PanelHeader title="Runners" sub={`${runners.length} active`} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, padding: 1, background: "var(--border)" }}>
            {runners.map((r) => {
              const active = r.id === selectedId;
              return (
                <button key={r.id} onClick={() => setSelectedId(r.id)} style={{
                  textAlign: "left", border: 0, cursor: "pointer", padding: 14,
                  background: active ? "var(--bg-elevated)" : "var(--bg)",
                  boxShadow: active ? "inset 0 0 0 1px var(--brand-signal-dim)" : "none",
                  display: "flex", flexDirection: "column", gap: 8,
                  fontFamily: "var(--font-sans)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)" }}>{r.id}</span>
                    <StatusDot tone={r.status} pulse={r.status === "info"} />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>
                    {r.cluster} · {r.arch}
                  </div>
                  <div style={{ height: 4, width: "100%", borderRadius: 9999, background: "var(--border)", overflow: "hidden", marginTop: 2 }}>
                    <div style={{
                      height: "100%", width: `${r.load}%`,
                      background: r.load > 80 ? "var(--accent-warn)" : r.status === "info" ? "var(--brand-signal)" : "var(--fg)",
                      opacity: r.status === "muted" ? 0.3 : 0.75,
                    }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)",
                                display: "flex", justifyContent: "space-between" }}>
                    <span>{r.load}% load</span><span>{r.runs} runs</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Selected runner + clusters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel>
            <div style={{ padding: 20 }}>
              <Eyebrow>runner detail</Eyebrow>
              <h3 className="display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 0" }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>{selected.id}</span>
              </h3>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <Meta label="Cluster"  value={selected.cluster} />
                <Meta label="Arch"     value={selected.arch} mono />
                <Meta label="Version"  value={selected.version} mono />
                <Meta label="Load"     value={`${selected.load}%`} mono />
                <Meta label="Jobs 24h" value={selected.runs.toString()} mono />
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm">Drain</Button>
              <Button variant="ghost" size="sm">Restart</Button>
              <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Logs</Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Clusters" sub={`${clusters.length} reachable`} />
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {clusters.map((c) => (
                <li key={c.name} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 20px", borderTop: "1px solid var(--border)",
                  fontSize: 13,
                }}>
                  <Icon d={c.type === "k8s" ? I.server : I.cpu} size={14} className="muted" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg)" }}>{c.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>{c.region}</div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)", textAlign: "right" }}>
                    <span style={{ color: "var(--fg)" }}>{c.runners}</span>
                    <span style={{ color: "var(--fg-subtle)" }}> / {c.runners + c.idle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  );
}

window.Agents = Agents;
