/* Web app — Observe page. Service health grid + latency chart + alerts feed. */

function Observe() {
  const services = [
    { name: "api-gateway",      env: "production", latency: "42ms",  rps: "8.2k", errors: "0.04%", status: "ok" },
    { name: "auth-service",     env: "production", latency: "18ms",  rps: "2.1k", errors: "0.00%", status: "ok" },
    { name: "billing",          env: "production", latency: "104ms", rps: "640",  errors: "0.41%", status: "warn" },
    { name: "search-indexer",   env: "production", latency: "212ms", rps: "180",  errors: "0.01%", status: "ok" },
    { name: "notifications",    env: "production", latency: "31ms",  rps: "1.4k", errors: "0.02%", status: "ok" },
    { name: "worker-async",     env: "production", latency: "—",     rps: "—",    errors: "—",     status: "info" },
    { name: "ml-inference",     env: "production", latency: "318ms", rps: "94",   errors: "2.14%", status: "fail" },
    { name: "data-warehouse",   env: "production", latency: "—",     rps: "—",    errors: "—",     status: "muted" },
  ];

  const alerts = [
    { sev: "fail", title: "ml-inference · 5xx rate above 2%",  ago: "4m",  rule: "p95 errors > 1%" },
    { sev: "warn", title: "billing · latency p95 above 100ms", ago: "12m", rule: "p95 > 100ms · 5m" },
    { sev: "warn", title: "agent runner-29 marked unhealthy",  ago: "1h",  rule: "missed 3 heartbeats" },
    { sev: "info", title: "deploy api-gateway · v2.3.8",       ago: "12m", rule: "canary 25%" },
  ];

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="observe / runtime"
        title="Observe"
        sub="Runtime health, latency, throughput and error budget for every service."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.clock} size={14} />}>Last 6h</Button>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.refresh} size={14} />}>Refresh</Button>
          </div>
        }
      />

      {/* Top: SLO summary + latency chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        {/* SLO summary */}
        <Panel style={{ padding: 20 }}>
          <Eyebrow>service level · last 30d</Eyebrow>
          <div className="reading" style={{ fontSize: 36, fontWeight: 600, fontFamily: "var(--font-mono)",
                letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginTop: 8 }}>99.94<span style={{ color: "var(--fg-muted)", fontSize: 24 }}>%</span></div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
            <span style={{ color: "var(--accent-success)" }}>14m</span> error budget remaining of 21m monthly
          </div>
          <div style={{ marginTop: 14, height: 6, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ width: "67%", height: "100%", background: "var(--accent-success)", opacity: 0.7 }} />
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)",
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
            <Meta label="MTTR"  value="9m"   mono />
            <Meta label="MTBF"  value="6.4d" mono />
            <Meta label="Burn"  value="0.4x" mono />
            <Meta label="Window" value="30d" mono />
          </div>
        </Panel>

        {/* Latency chart */}
        <Panel style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Eyebrow>p50 / p95 latency · last 6h</Eyebrow>
            <div style={{ display: "flex", gap: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>
              <span><span style={{ width: 8, height: 2, background: "var(--fg)", display: "inline-block", marginRight: 6, verticalAlign: "middle" }} />p50 42ms</span>
              <span><span style={{ width: 8, height: 2, background: "var(--brand-signal)", display: "inline-block", marginRight: 6, verticalAlign: "middle" }} />p95 138ms</span>
            </div>
          </div>
          <svg viewBox="0 0 400 140" preserveAspectRatio="none"
               style={{ width: "100%", height: 140, marginTop: 12, color: "var(--fg-muted)" }}>
            <defs>
              <linearGradient id="grad-p50" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="var(--fg)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* gridlines */}
            {[28, 56, 84, 112].map((y) => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="var(--border)" strokeDasharray="2 4" strokeWidth="1" />
            ))}
            {/* p95 */}
            <polyline fill="none" stroke="var(--brand-signal)" strokeOpacity="0.7" strokeWidth="1.6"
              points="0,90 20,85 40,80 60,82 80,75 100,72 120,65 140,68 160,60 180,55 200,58 220,50 240,45 260,52 280,40 300,38 320,30 340,32 360,28 380,25 400,32" />
            {/* p50 area */}
            <path fill="url(#grad-p50)"
              d="M0 110 L20,108 L40,105 L60,109 L80,100 L100,98 L120,92 L140,94 L160,85 L180,82 L200,86 L220,78 L240,72 L260,80 L280,65 L300,62 L320,55 L340,58 L360,52 L380,48 L400,55 L400 140 L0 140 Z" />
            <polyline fill="none" stroke="var(--fg)" strokeWidth="1.4"
              points="0,110 20,108 40,105 60,109 80,100 100,98 120,92 140,94 160,85 180,82 200,86 220,78 240,72 260,80 280,65 300,62 320,55 340,58 360,52 380,48 400,55" />
          </svg>
        </Panel>
      </div>

      {/* Services grid */}
      <Panel>
        <PanelHeader title="Services" sub={`${services.length} monitored`} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--fg-muted)", textAlign: "left",
                         fontFamily: "var(--font-mono)", fontSize: 10.5,
                         textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <th style={th}>Service</th>
              <th style={th}>Env</th>
              <th style={th}>Latency p95</th>
              <th style={th}>RPS</th>
              <th style={th}>Errors</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.name} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 500 }}>{s.name}</td>
                <td style={{ ...td, color: "var(--fg-muted)" }}>{s.env}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{s.latency}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{s.rps}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)",
                            color: s.status === "fail" ? "var(--accent-danger)" : s.status === "warn" ? "var(--accent-warn)" : "var(--fg-muted)" }}>{s.errors}</td>
                <td style={td}><StatusDot tone={s.status} pulse={s.status === "info"} /></td>
                <td style={{ ...td, textAlign: "right" }}>
                  <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Open</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Alerts feed */}
      <Panel>
        <PanelHeader title="Active alerts" sub={`${alerts.length} firing`} />
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {alerts.map((a, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
            }}>
              <StatusDot tone={a.sev} pulse={a.sev === "info"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{a.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", marginTop: 3 }}>{a.rule}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{a.ago} ago</span>
              <Button variant="outline" size="sm">Ack</Button>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

window.Observe = Observe;
