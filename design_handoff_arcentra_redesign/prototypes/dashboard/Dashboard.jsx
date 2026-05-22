/* Web app — Dashboard page. Faithful to arcentra-web/src/pages/Dashboard/index.tsx
   but condensed for prototype. Three rows of metric cards + recent pipelines table +
   project overview list. */

function Dashboard() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24, padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Eyebrow>system / overview</Eyebrow>
          <h2 className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Control Plane</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--fg-subtle)",
          }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--brand-signal)" }} />
            live · cluster-prod
          </span>
        </div>
      </div>

      {/* Row 1 — pipeline status overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <DashCard
          title="Running"
          value="12"
          icon={<Icon d={I.play} size={16} className="info" />}
          footer={<><Icon d={I.trendUp} size={12} className="ok" /> +3 from last hour</>}
        />
        <DashCard
          title="Success"
          value="847"
          icon={<Icon d={I.checkCircle} size={16} className="ok" />}
          footer="94.2% success rate (24h)"
        />
        <DashCard
          title="Failed"
          value="52"
          icon={<Icon d={I.xCircle} size={16} className="fail" />}
          footer={<><Icon d={I.trendDown} size={12} className="fail" /> +12 from yesterday</>}
        />
        <DashCard
          title="Avg Duration"
          value="8m 42s"
          icon={<Icon d={I.clock} size={16} className="muted" />}
          footer="-1m 20s from last week"
        />
      </div>

      {/* Row 2 — efficiency metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <DashCard title="Deploy Frequency" value="47" icon={<Icon d={I.zap} size={16} className="warn" />} footer="Deployments per day" />
        <DashCard title="Lead Time"        value="2.4h" icon={<Icon d={I.activity} size={16} className="violet" />} footer="Commit to production" />
        <DashCard title="MTTR"             value="24m"  icon={<Icon d={I.refresh} size={16} className="warn" />}  footer="Mean time to recovery" />
      </div>

      {/* Row 3 — system health */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <DashCard
          title="Agents Online"
          value={<span>32 <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>/ 48</span></span>}
          icon={<Icon d={I.server} size={16} className="ok" />}
          footer="67% capacity available"
        />
        <DashCard title="Queue Length"        value="3"    icon={<Icon d={I.pause} size={16} className="muted" />} footer="Pipelines waiting" />
        <DashCard title="Change Failure Rate" value="5.8%" icon={<Icon d={I.alertCircle} size={16} className="warn" />} footer="Last 7 days" />
        <DashCard title="Execution Delay"     value="1.2s" icon={<Icon d={I.clock} size={16} className="info" />} footer="Avg trigger to start" />
      </div>

      {/* Row 4 — recent executions + project overview */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <RecentExecutions />
        <ProjectsOverview />
      </div>
    </section>
  );
}

function DashCard({ title, value, icon, footer }) {
  return (
    <div style={{
      borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg)", padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-muted)",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                      textTransform: "uppercase" }}>{title}</div>
        {icon}
      </div>
      <div className="reading" style={{ fontSize: 30, fontWeight: 600,
            fontFamily: "var(--font-mono)", letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>{footer}</div>
    </div>
  );
}

function RecentExecutions() {
  const rows = [
    { name: "Build & Deploy",     project: "web-app",       status: "ok",   duration: "8m 32s" },
    { name: "Test Suite",         project: "api-service",   status: "fail", duration: "4m 12s" },
    { name: "Docker Build",       project: "mobile-app",    status: "info", duration: "2m 45s" },
    { name: "Integration Test",   project: "web-app",       status: "ok",   duration: "12m 08s" },
    { name: "E2E Tests",          project: "web-app",       status: "warn", duration: "—" },
  ];
  const statusBadge = (s) => {
    if (s === "ok")   return <Badge tone="success"><Icon d={I.check} size={10} />Success</Badge>;
    if (s === "fail") return <Badge tone="danger"><Icon d={I.x} size={10} />Failed</Badge>;
    if (s === "info") return <Badge variant="secondary"><Icon d={I.play} size={10} />Running</Badge>;
    if (s === "warn") return <Badge tone="warn"><Icon d={I.pause} size={10} />Queued</Badge>;
  };
  return (
    <div style={{
      borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px",
      }}>
        <div>
          <h3 className="display" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Recent runs</h3>
          <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: 0, marginTop: 4 }}>Last 10 across all projects · 24h window</p>
        </div>
        <Button variant="outline" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>View all</Button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--fg-muted)", fontWeight: 500, textAlign: "left" }}>
            <th style={th}>Pipeline</th>
            <th style={th}>Project</th>
            <th style={th}>Status</th>
            <th style={th}>Duration</th>
            <th style={{ ...th, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 500 }}>{r.name}</td>
              <td style={td}>{r.project}</td>
              <td style={td}>{statusBadge(r.status)}</td>
              <td style={{ ...td, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{r.duration}</td>
              <td style={{ ...td, textAlign: "right" }}>
                <Button variant="ghost" size="sm">View</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const th = { padding: "10px 20px", borderTop: "1px solid var(--border)", fontWeight: 500 };
const td = { padding: "12px 20px" };

function ProjectsOverview() {
  const projects = [
    ["web-app",         "42 runs · 95.2% success", "success", "Healthy"],
    ["api-service",     "38 runs · 87.5% success", "warn",    "Warning"],
    ["mobile-app",      "29 runs · 96.5% success", "success", "Healthy"],
    ["data-pipeline",   "15 runs · 73.3% success", "danger",  "Critical"],
    ["infrastructure",  "8 runs · 100% success",   "success", "Healthy"],
  ];
  return (
    <div style={{
      borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg)",
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 18,
    }}>
      <div>
        <h3 className="display" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Projects</h3>
        <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: 0, marginTop: 4 }}>Performance by project</p>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {projects.map(([name, sub, tone, label]) => (
          <li key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>{sub}</div>
            </div>
            <Badge tone={tone}>{label}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

window.Dashboard = Dashboard;
