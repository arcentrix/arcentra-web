/* Web app — Project Detail page. Sub-tabs: Overview, Pipelines,
   Deployments, Artifacts, Environments, Secrets, Members, Settings.
   Lifted from arcentra-web/src/pages/Project/* and Projects/Detail/*. */

function ProjectDetail({ projectId = "web-app", onBack }) {
  const meta = {
    "web-app":        { name: "web-app",        desc: "Customer-facing web client",          lang: "TypeScript", repo: "arcentrix/web-app",        owner: "e.chen" },
    "api-service":    { name: "api-service",    desc: "Public REST API + GraphQL gateway",   lang: "Go",         repo: "arcentrix/api-service",    owner: "mark.weber" },
    "mobile-app":     { name: "mobile-app",     desc: "iOS + Android React Native client",   lang: "TypeScript", repo: "arcentrix/mobile-app",     owner: "j.park" },
    "data-pipeline":  { name: "data-pipeline",  desc: "Daily ETL + feature-store backfill",  lang: "Python",     repo: "arcentrix/data-pipeline",  owner: "sara.li" },
    "infrastructure": { name: "infrastructure", desc: "Terraform + ArgoCD platform configs", lang: "HCL",        repo: "arcentrix/infrastructure", owner: "mark.weber" },
    "ml-platform":    { name: "ml-platform",    desc: "Training jobs + eval harness",        lang: "Python",     repo: "arcentrix/ml-platform",    owner: "alex.morales" },
  }[projectId] || { name: projectId, desc: "—", lang: "—", repo: "—", owner: "—" };

  const TABS = [
    { id: "overview",     label: "Overview" },
    { id: "pipelines",    label: "Pipelines",    count: 12 },
    { id: "deployments",  label: "Deployments",  count: 47 },
    { id: "artifacts",    label: "Artifacts",    count: 318 },
    { id: "environments", label: "Environments", count: 3 },
    { id: "secrets",      label: "Secrets",      count: 14 },
    { id: "members",      label: "Members",      count: 11 },
    { id: "settings",     label: "Settings" },
  ];

  const [tab, setTab] = React.useState("overview");

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header with back + meta */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button onClick={onBack} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 8px", borderRadius: 6,
            background: "transparent", border: 0, cursor: "pointer",
            color: "var(--fg-muted)", fontFamily: "var(--font-sans)", fontSize: 12,
          }}>
            <Icon d={I.arrowLeft} size={12} />Projects
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <Eyebrow>project / {meta.lang.toLowerCase()}</Eyebrow>
            <h2 className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 0" }}>{meta.name}</h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6, maxWidth: 600 }}>{meta.desc}</p>
            <div style={{
              marginTop: 12, display: "flex", flexWrap: "wrap", gap: 14,
              fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-subtle)",
            }}>
              <span><Icon d={I.github} size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />{meta.repo}</span>
              <span>·</span>
              <span>maintained by <span style={{ color: "var(--fg-muted)" }}>@{meta.owner}</span></span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.play} size={13} />}>Run pipeline</Button>
            <Button variant="primary" size="md" leftIcon={<Icon d={I.rocket} size={14} />}>Deploy</Button>
          </div>
        </div>
      </div>

      {/* Sub-tab strip */}
      <div role="tablist" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)",
        padding: 4, alignSelf: "flex-start", flexWrap: "wrap",
      }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 30, padding: "0 12px", borderRadius: 6,
              background: active ? "var(--bg)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              boxShadow: active ? "inset 0 0 0 1px var(--border-strong)" : "none",
              border: 0, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            }}>
              {t.label}
              {typeof t.count === "number" && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: active ? "var(--fg-muted)" : "var(--fg-subtle)",
                  fontVariantNumeric: "tabular-nums",
                }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview"     && <ProjectOverview />}
      {tab === "pipelines"    && <ProjectPipelines />}
      {tab === "deployments"  && <ProjectDeployments />}
      {tab === "artifacts"    && <ProjectArtifacts />}
      {tab === "environments" && <ProjectEnvironments />}
      {tab === "secrets"      && <ProjectSecrets />}
      {tab === "members"      && <ProjectMembers />}
      {tab === "settings"     && <ProjectSettingsTab />}
    </section>
  );
}

/* ─────────── Overview ─────────── */

function ProjectOverview() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          ["Pipelines (24h)",     "42",   "+8 vs prev"],
          ["Success rate",        "95.2%",["95.2% · ", "+1.4pp"]],
          ["Avg duration",        "8m 32s","-1m 20s"],
          ["Active deploys",      "1",    "canary 25%"],
        ].map(([label, value, sub]) => (
          <Panel key={label} style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em",
                          textTransform: "uppercase", color: "var(--fg-subtle)" }}>{label}</div>
            <div className="reading" style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono)",
                  letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6 }}>
              {Array.isArray(sub) ? <span>{sub[0]}<span style={{ color: "var(--accent-success)" }}>{sub[1]}</span></span> : sub}
            </div>
          </Panel>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel>
          <PanelHeader title="Recent activity" sub="Last 8 events on this project" />
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {[
              ["e.chen",     "approved release v2.4.0-rc.3",        "info", "2m ago"],
              ["deploy-bot", "deployed v2.3.8 to production",        "ok",   "12m ago"],
              ["mark.weber", "merged pr/auth-v2 into main",          "ok",   "32m ago"],
              ["deploy-bot", "build #2148 succeeded",                "ok",   "1h ago"],
              ["sara.li",    "rotated DATABASE_URL",                 "ok",   "3h ago"],
              ["deploy-bot", "build #2145 failed at validate-output","fail", "1d ago"],
            ].map((a, i) => (
              <li key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
                fontSize: 13,
              }}>
                <StatusDot tone={a[2]} pulse={a[2] === "info"} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{a[0]}</span>
                  <span style={{ color: "var(--fg-muted)" }}> · {a[1]}</span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{a[3]}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel style={{ padding: 20 }}>
          <Eyebrow>readme</Eyebrow>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: "var(--fg-muted)" }}>
            <p style={{ margin: 0 }}>Pixel-fidelity recreation of the customer-facing web client. Built on Vite + React 18 + TypeScript with Tailwind v4 (CSS-first).</p>
            <p style={{ margin: "10px 0 0" }}>Deploys ship through staging → production with canary rollouts (25 / 50 / 100). Owns the marketing landing pages and the in-app dashboard surfaces.</p>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)",
                          fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-subtle)" }}>
              <div>{`# clone & run`}</div>
              <div style={{ color: "var(--fg)" }}>$ git clone …</div>
              <div style={{ color: "var(--fg)" }}>$ pnpm install &amp;&amp; pnpm dev</div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ─────────── Pipelines tab ─────────── */

function ProjectPipelines() {
  const pipelines = [
    { name: "build-and-deploy",  trigger: "push · main",      schedule: "—",          last: "2m ago",  status: "ok",   runs: "248" },
    { name: "test-suite",        trigger: "push · any",       schedule: "—",          last: "8m ago",  status: "ok",   runs: "412" },
    { name: "docker-build",      trigger: "push · main",      schedule: "—",          last: "1h ago",  status: "ok",   runs: "188" },
    { name: "integration-tests", trigger: "schedule",         schedule: "every 30m",  last: "12m ago", status: "warn", runs: "1.2k" },
    { name: "e2e-nightly",       trigger: "schedule",         schedule: "daily 02:00",last: "12h ago", status: "ok",   runs: "84"  },
    { name: "release",           trigger: "tag · v*",         schedule: "—",          last: "1d ago",  status: "ok",   runs: "47"  },
  ];
  return (
    <Panel>
      <PanelHeader title="Pipelines" sub={`${pipelines.length} configured · ${pipelines.reduce((s, p) => s + parseInt(p.runs.replace(/[^0-9]/g, ""), 10), 0)} total runs`}
        action={<Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>New pipeline</Button>} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th5}>Name</th>
            <th style={th5}>Trigger</th>
            <th style={th5}>Schedule</th>
            <th style={th5}>Last run</th>
            <th style={th5}>Status</th>
            <th style={{ ...th5, textAlign: "right" }}>Total runs</th>
          </tr>
        </thead>
        <tbody>
          {pipelines.map((p) => (
            <tr key={p.name} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td5, fontWeight: 500 }}>{p.name}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.trigger}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.schedule}</td>
              <td style={{ ...td5, color: "var(--fg-muted)" }}>{p.last}</td>
              <td style={td5}><StatusDot tone={p.status} pulse={p.status === "info"} /></td>
              <td style={{ ...td5, textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────── Deployments tab ─────────── */

function ProjectDeployments() {
  const deploys = [
    ["v2.4.0-rc.3", "dev",        "ok",   "12m ago", "e.chen",      "rolling"],
    ["v2.4.0-rc.2", "staging",    "ok",   "2h ago",  "mark.weber",  "rolling"],
    ["v2.3.8",      "production", "info", "12m ago", "e.chen",      "canary 25%"],
    ["v2.3.7",      "production", "ok",   "1d ago",  "e.chen",      "blue-green"],
    ["v2.3.6",      "production", "fail", "2d ago",  "deploy-bot",  "rolled back"],
    ["v2.3.5",      "production", "ok",   "3d ago",  "mark.weber",  "rolling"],
  ];
  return (
    <Panel>
      <PanelHeader title="Deployments" sub={`Last ${deploys.length} of 47 deployments`} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th5}>Version</th>
            <th style={th5}>Env</th>
            <th style={th5}>Status</th>
            <th style={th5}>When</th>
            <th style={th5}>By</th>
            <th style={{ ...th5, textAlign: "right" }}>Strategy</th>
          </tr>
        </thead>
        <tbody>
          {deploys.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{r[0]}</td>
              <td style={td5}>{r[1]}</td>
              <td style={td5}><StatusBadge tone={r[2]} /></td>
              <td style={{ ...td5, color: "var(--fg-muted)" }}>{r[3]}</td>
              <td style={td5}>{r[4]}</td>
              <td style={{ ...td5, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{r[5]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────── Artifacts tab ─────────── */

function ProjectArtifacts() {
  const artifacts = [
    { name: "web-app",         tag: "v2.4.0-rc.3", type: "container", size: "184MB",   sha: "a4f9c2",   age: "12m ago"  },
    { name: "web-app",         tag: "v2.4.0-rc.2", type: "container", size: "183MB",   sha: "0bcf81",   age: "2h ago"   },
    { name: "web-app",         tag: "v2.3.8",      type: "container", size: "181MB",   sha: "92ad11",   age: "12m ago"  },
    { name: "web-app · static",tag: "v2.3.8",      type: "tarball",   size: "12.4MB",  sha: "ee2207",   age: "12m ago"  },
    { name: "web-app · sbom",  tag: "v2.3.8",      type: "json",      size: "84KB",    sha: "8a31fc",   age: "12m ago"  },
  ];
  return (
    <Panel>
      <PanelHeader title="Artifacts" sub={`${artifacts.length} recent · 318 total · stored on s3 + container registry`}
        action={<Button variant="outline" size="sm" leftIcon={<Icon d={I.refresh} size={13} />}>Sync</Button>} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th5}>Name</th>
            <th style={th5}>Tag</th>
            <th style={th5}>Type</th>
            <th style={th5}>Size</th>
            <th style={th5}>SHA</th>
            <th style={{ ...th5, textAlign: "right" }}>Pushed</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((a, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{a.name}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)" }}>{a.tag}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{a.type}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{a.size}</td>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}>{a.sha}</td>
              <td style={{ ...td5, textAlign: "right", color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>{a.age}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────── Environments tab ─────────── */

function ProjectEnvironments() {
  const envs = [
    { name: "production", url: "https://app.arcentra.io",        status: "info", rev: "v2.3.7",      strategy: "canary 25%", protect: true },
    { name: "staging",    url: "https://staging.arcentra.io",    status: "ok",   rev: "v2.4.0-rc.2", strategy: "rolling",    protect: false },
    { name: "dev",        url: "https://dev-preview.arcentra.io",status: "ok",   rev: "v2.4.0-rc.3", strategy: "recreate",   protect: false },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {envs.map((e) => (
        <Panel key={e.name}>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow>{e.protect ? "protected" : "open"}</Eyebrow>
              <StatusDot tone={e.status} pulse={e.status === "info"} />
            </div>
            <h3 className="display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 0" }}>{e.name}</h3>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-subtle)" }}>{e.url}</div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              <Meta label="Revision" value={e.rev} mono />
              <Meta label="Strategy" value={e.strategy} />
              <Meta label="Protect"  value={e.protect ? "yes" : "no"} mono />
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 6 }}>
            <Button variant="outline" size="sm">Open</Button>
            <Button variant="ghost" size="sm">Promote</Button>
            <Button variant="ghost" size="sm">Logs</Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ─────────── Secrets tab ─────────── */

function ProjectSecrets() {
  const secrets = [
    ["DATABASE_URL",      "postgres credentials",  "all envs",        "32d ago"],
    ["STRIPE_SECRET",     "Stripe API · live",     "production",      "12d ago"],
    ["GITHUB_APP_KEY",    "GitHub webhook signing","all envs",        "84d ago"],
    ["SENTRY_DSN",        "Sentry ingest",         "production",      "—"],
    ["FLAGS_API_TOKEN",   "Feature flag service",  "production · dev","12d ago"],
  ];
  return (
    <Panel>
      <PanelHeader title="Project secrets" sub={`${secrets.length} keys · scoped to web-app`}
        action={<Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>Add secret</Button>} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th5}>Key</th>
            <th style={th5}>Description</th>
            <th style={th5}>Scope</th>
            <th style={{ ...th5, textAlign: "right" }}>Rotated</th>
          </tr>
        </thead>
        <tbody>
          {secrets.map((s) => (
            <tr key={s[0]} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td5, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{s[0]}</td>
              <td style={{ ...td5, color: "var(--fg-muted)" }}>{s[1]}</td>
              <td style={{ ...td5, color: "var(--fg-muted)" }}>{s[2]}</td>
              <td style={{ ...td5, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}>{s[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────── Members tab ─────────── */

function ProjectMembers() {
  const members = [
    { handle: "e.chen",       name: "Evelyn Chen",    role: "Owner",      since: "Jan 2025" },
    { handle: "mark.weber",   name: "Mark Weber",     role: "Maintainer", since: "Jan 2025" },
    { handle: "j.park",       name: "Jihoon Park",    role: "Maintainer", since: "Feb 2025" },
    { handle: "alex.morales", name: "Alex Morales",   role: "Developer",  since: "Mar 2025" },
    { handle: "sara.li",      name: "Sara Li",        role: "Developer",  since: "Apr 2025" },
    { handle: "deploy-bot",   name: "Deploy Bot",     role: "Service",    since: "Jan 2025" },
  ];
  return (
    <Panel>
      <PanelHeader title="Members" sub={`${members.length} with access to web-app`}
        action={<Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>Add member</Button>} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th5}>User</th>
            <th style={th5}>Role</th>
            <th style={th5}>Since</th>
            <th style={{ ...th5, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.handle} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td5}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 9999,
                    border: "1px solid var(--border)", background: "var(--bg-elevated)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--fg-muted)",
                  }}>{m.handle.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{m.handle}</div>
                  </div>
                </div>
              </td>
              <td style={td5}>
                <span style={{
                  display: "inline-flex", alignItems: "center",
                  height: 22, padding: "0 8px", borderRadius: 4,
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
                  color: m.role === "Owner" ? "var(--brand-signal)" : "var(--fg-muted)",
                  border: `1px solid ${m.role === "Owner" ? "var(--brand-signal-dim)" : "var(--border)"}`,
                }}>{m.role}</span>
              </td>
              <td style={{ ...td5, color: "var(--fg-muted)" }}>{m.since}</td>
              <td style={{ ...td5, textAlign: "right" }}>
                <Button variant="ghost" size="sm">Edit</Button>
                <Button variant="ghost" size="sm" style={{ color: "var(--accent-danger)" }}>Remove</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────── Settings tab ─────────── */

function ProjectSettingsTab() {
  return (
    <Panel style={{ padding: 24 }}>
      <Eyebrow>project / settings</Eyebrow>
      <h3 className="display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", margin: "8px 0 16px" }}>General</h3>
      <ProjectFormRow label="Project name"        value="web-app" mono />
      <ProjectFormRow label="Description"         value="Customer-facing web client" />
      <ProjectFormRow label="Linked repository"   value="github.com/arcentrix/web-app" mono />
      <ProjectFormRow label="Default branch"      value="main" mono />
      <ProjectFormRow label="Visibility"          value="internal" />
      <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
        <h3 className="display" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, color: "var(--accent-danger)" }}>Danger zone</h3>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 14px" }}>Archive or delete this project. Both actions can be undone within 7 days.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" size="sm">Archive project</Button>
          <Button variant="outline" size="sm" style={{ color: "var(--accent-danger)", borderColor: "color-mix(in oklab, var(--accent-danger) 40%, var(--border))" }}>Delete project</Button>
        </div>
      </div>
    </Panel>
  );
}

function ProjectFormRow({ label, value, mono }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "200px 1fr",
      gap: 24, padding: "12px 0",
      borderBottom: "1px solid var(--border)",
      alignItems: "center",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <input defaultValue={value} style={{
        height: 32, padding: "0 12px", maxWidth: 360,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: 6, color: "var(--fg)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: 13, outline: "none",
      }} />
    </div>
  );
}

const tableHeadRow = {
  color: "var(--fg-muted)", textAlign: "left",
  fontFamily: "var(--font-mono)", fontSize: 10.5,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
const th5 = { padding: "10px 16px", fontWeight: 500 };
const td5 = { padding: "12px 16px" };

window.ProjectDetail = ProjectDetail;
