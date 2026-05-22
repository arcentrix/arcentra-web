/* Web app — Deploy page. Environments grid + release table.
   Adapted from arcentra-web/src/pages/Deploy + Project/Deployments. */

function Deploy() {
  const envs = [
    { name: "production", region: "eu-west-1", revision: "v2.3.7",      status: "info", age: "rolling 4/8", lastDeploy: "12m ago", strategy: "canary 25%" },
    { name: "staging",    region: "eu-west-1", revision: "v2.4.0-rc.2", status: "ok",   age: "stable",      lastDeploy: "2h ago",  strategy: "rolling" },
    { name: "dev",        region: "us-east-2", revision: "v2.4.0-rc.3", status: "ok",   age: "stable",      lastDeploy: "12m ago", strategy: "recreate" },
  ];

  const releases = [
    ["v2.4.0-rc.3", "dev",        "ok",   "12m ago", "e.chen",      "rolling",      "—"],
    ["v2.4.0-rc.2", "staging",    "ok",   "2h ago",  "mark.weber",  "rolling",      "—"],
    ["v2.4.0-rc.1", "dev",        "ok",   "6h ago",  "j.park",      "rolling",      "—"],
    ["v2.3.8",      "production", "info", "12m ago", "e.chen",      "canary 25%",   "4/8 pods"],
    ["v2.3.7",      "production", "ok",   "1d ago",  "e.chen",      "blue-green",   "—"],
    ["v2.3.6",      "production", "fail", "2d ago",  "deploy-bot",  "rolled back",  "—"],
    ["v2.3.5",      "production", "ok",   "3d ago",  "mark.weber",  "rolling",      "—"],
  ];

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="deploy / environments"
        title="Deploy"
        sub="Environments, releases and GitOps reconciliation across your fleet."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.refresh} size={14} />}>Sync</Button>
            <Button variant="primary" size="md" leftIcon={<Icon d={I.rocket} size={14} />}>Release</Button>
          </div>
        }
      />

      {/* Environment cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {envs.map((e) => (
          <Panel key={e.name}>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>{e.region}</Eyebrow>
                <StatusDot tone={e.status} pulse={e.status === "info"} />
              </div>
              <h3 className="display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 0" }}>{e.name}</h3>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <Meta label="Revision" value={e.revision} mono />
                <Meta label="State"    value={e.age} />
                <Meta label="Strategy" value={e.strategy} />
                <Meta label="Updated"  value={e.lastDeploy} />
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm">View</Button>
              <Button variant="ghost" size="sm">Rollback</Button>
              <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Logs</Button>
            </div>
          </Panel>
        ))}
      </div>

      {/* Release history */}
      <Panel>
        <PanelHeader
          title="Release history"
          sub="Last 7 releases · production · staging · dev"
          action={<Button variant="outline" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>View all</Button>}
        />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--fg-muted)", fontWeight: 500, textAlign: "left",
                         fontFamily: "var(--font-mono)", fontSize: 10.5,
                         textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <th style={th}>Version</th>
              <th style={th}>Env</th>
              <th style={th}>Status</th>
              <th style={th}>When</th>
              <th style={th}>By</th>
              <th style={th}>Strategy</th>
              <th style={{ ...th, textAlign: "right" }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{r[0]}</td>
                <td style={td}>{r[1]}</td>
                <td style={td}><StatusBadge tone={r[2]} /></td>
                <td style={{ ...td, color: "var(--fg-muted)" }}>{r[3]}</td>
                <td style={td}>{r[4]}</td>
                <td style={{ ...td, color: "var(--fg-muted)" }}>{r[5]}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }}>{r[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)",
                     fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: "var(--fg)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>{value}</span>
    </div>
  );
}
const th = { padding: "10px 20px", fontWeight: 500 };
const td = { padding: "12px 20px" };

window.Deploy = Deploy;
