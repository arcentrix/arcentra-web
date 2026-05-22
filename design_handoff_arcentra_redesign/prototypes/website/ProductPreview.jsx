/* Marketing site — Product Preview with interactive tabs.
   Each tab renders a different fake dashboard view. Closely
   mirrors arcentra-website/src/components/home/product-preview.tsx. */

function ProductPreview() {
  const TABS = [
    { id: "overview", label: "Overview", icon: I.activity,    blurb: "See pipeline health, deployment frequency, lead time, MTTR and agent capacity." },
    { id: "build",    label: "Build",    icon: I.hammer,      blurb: "Run CI pipelines, build artifacts and manage execution history." },
    { id: "approve",  label: "Approve",  icon: I.shield,      blurb: "Gate releases, AI training runs and data backfills with required approvers." },
    { id: "deploy",   label: "Deploy",   icon: I.rocket,      blurb: "Manage environments, releases, GitOps sync and rollback workflows." },
    { id: "agents",   label: "Agents",   icon: I.serverCog,   blurb: "Register runners and agents across clusters, clouds and private networks." },
    { id: "observe",  label: "Observe",  icon: I.gitBranch,   blurb: "Inspect logs, metrics, traces and runtime status from one place." },
    { id: "secure",   label: "Secure",   icon: I.shieldCheck, blurb: "Control access, secrets, identity providers and deployment policies." },
  ];
  const [active, setActive] = React.useState("overview");
  const tab = TABS.find((t) => t.id === active);

  return (
    <section id="product" style={{ position: "relative", borderBottom: "1px solid var(--border)", scrollMarginTop: 96 }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 112px" }}>
        <div style={{ maxWidth: "48rem" }}>
          <Eyebrow style={{ marginBottom: 12 }}>Product preview</Eyebrow>
          <h2 className="display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            One command center for delivery operations.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", marginTop: 16 }}>
            Pipelines, environments, agents, runtime diagnostics and access control —
            every layer of your delivery stack lives in a single, self-hosted control plane.
          </p>
        </div>

        {/* Tab strip */}
        <div style={{ marginTop: 32, overflowX: "auto" }}>
          <div role="tablist" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-elevated)", padding: 4,
          }}>
            {TABS.map((t) => {
              const selected = t.id === active;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={selected}
                  onClick={() => setActive(t.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 32, padding: "0 12px", borderRadius: 8,
                    fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 13,
                    background: selected ? "var(--bg)" : "transparent",
                    color: selected ? "var(--fg)" : "var(--fg-muted)",
                    boxShadow: selected ? "inset 0 0 0 1px var(--border-strong)" : "none",
                    border: 0, cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                  <Icon d={t.icon} size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ marginTop: 24, fontSize: 14, color: "var(--fg-muted)", maxWidth: "48rem" }}>{tab.blurb}</p>

        {/* Browser frame + active mock */}
        <div style={{ marginTop: 20 }}>
          <BrowserFrame url={`app.arcentra.io / ${active}`}>
            {active === "overview" && <MockOverview />}
            {active === "build"    && <MockBuild />}
            {active === "approve"  && <MockApprove />}
            {active === "deploy"   && <MockDeploy />}
            {active === "agents"   && <MockAgents />}
            {active === "observe"  && <MockObserve />}
            {active === "secure"   && <MockSecure />}
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}

function BrowserFrame({ children, url = "app.arcentra.io" }) {
  return (
    <div style={{
      overflow: "hidden",
      borderRadius: 16, border: "1px solid var(--border)",
      background: "var(--bg-elevated)", boxShadow: "var(--shadow-elevated)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        height: 36, padding: "0 16px",
        borderBottom: "1px solid var(--border)", background: "var(--bg)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ width: 10, height: 10, borderRadius: 9999, background: "var(--border-strong)" }} />)}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 20, padding: "0 8px", maxWidth: 260,
            border: "1px solid var(--border)", borderRadius: 6,
            background: "var(--bg-elevated)",
            fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: "color-mix(in oklab, var(--accent-success) 70%, transparent)" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>
      <div style={{ position: "relative", background: "var(--bg)", aspectRatio: "16 / 9" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ──────────── Mock pages: a stylized sidebar + content area ─────── */

function MockSidebar({ active }) {
  const items = ["Overview", "Build", "Approve", "Deploy", "Agents", "Observe", "Secure", "Settings"];
  return (
    <aside style={{
      width: 176, flexShrink: 0,
      display: "flex", flexDirection: "column",
      borderRight: "1px solid var(--border)", background: "var(--bg-elevated)",
      paddingTop: 12, paddingBottom: 12,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 12px 12px", marginBottom: 4,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          border: "1px solid var(--border-strong)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600,
        }}>A</div>
        <span className="eyebrow" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>arcentra</span>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px", fontSize: 12 }}>
        {items.map((it) => (
          <span key={it} style={{
            borderRadius: 6, padding: "6px 8px",
            background: it === active ? "var(--bg)" : "transparent",
            color: it === active ? "var(--fg)" : "var(--fg-muted)",
            boxShadow: it === active ? "inset 0 0 0 1px var(--border-strong)" : "none",
          }}>{it}</span>
        ))}
      </nav>
      <div style={{ marginTop: "auto", padding: "12px 12px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--fg-subtle)" }}>
          <StatusDot tone="ok" pulse />
          <span style={{ fontFamily: "var(--font-mono)" }}>cluster-prod</span>
        </div>
      </div>
    </aside>
  );
}

function MockHeader({ breadcrumb, title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        {breadcrumb && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 2 }}>
            {breadcrumb}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 24, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-muted)",
        }}>⌘ K</span>
        <span style={{ width: 24, height: 24, borderRadius: 9999, background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
      </div>
    </div>
  );
}

function MockCard({ children, style }) {
  return <div style={{
    borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)",
    padding: 14, ...style,
  }}>{children}</div>;
}

function Sparkline({ points = "0,18 8,16 16,17 24,12 32,14 40,9 48,11 56,7 64,9 72,5 80,7 88,4", style }) {
  return (
    <svg viewBox="0 0 88 22" preserveAspectRatio="none" style={{ width: "100%", color: "var(--fg-muted)", ...style }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function MetricCard({ label, value, delta, trend = "up" }) {
  const deltaColor = trend === "up" ? "var(--accent-success)" : trend === "down" ? "var(--accent-danger)" : "var(--fg-subtle)";
  return (
    <MockCard>
      <Eyebrow style={{ fontSize: 10.5 }}>{label}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {delta && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: deltaColor }}>{delta}</div>}
      </div>
      <Sparkline style={{ height: 28, marginTop: 8 }} />
    </MockCard>
  );
}

function MockOverview() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--bg)" }}>
      <MockSidebar active="Overview" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MockHeader breadcrumb="arcentra / overview" title="Control Plane" />
        <div style={{ display: "grid", gap: 12, padding: 16, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <MetricCard label="Pipelines" value="248" delta="+12%" />
          <MetricCard label="Deploy Frequency" value="6.4/d" delta="+0.8" />
          <MetricCard label="Lead Time" value="14m" delta="-3m" />
          <MetricCard label="MTTR" value="9m" delta="-2m" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, padding: "0 16px 16px" }}>
          <MockCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Recent pipelines</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>last 24h</span>
            </div>
            <div style={{ marginTop: 10 }}>
              {[
                ["api · main",            "main",         "ok",   "2m ago"],
                ["web · feat/auth-v2",    "feat/auth-v2", "info", "8m ago"],
                ["worker · main",         "main",         "ok",   "21m ago"],
                ["infra · release/1.4",   "release/1.4",  "warn", "1h"],
              ].map((p, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "6px 0", fontSize: 12,
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}>
                  <StatusDot tone={p[2]} pulse={p[2] === "info"} />
                  <span style={{ fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p[0]}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <Icon d={I.gitBranch} size={12} />{p[1]}
                  </span>
                  <span style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)", fontSize: 11, width: 56, textAlign: "right" }}>{p[3]}</span>
                </div>
              ))}
            </div>
          </MockCard>

          <MockCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Agent capacity</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>32 / 48</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, marginTop: 10 }}>
              {Array.from({ length: 48 }).map((_, i) => (
                <span key={i} style={{
                  aspectRatio: "1", borderRadius: 2,
                  border: "1px solid var(--border)",
                  background: i < 32 ? "var(--fg)" : "transparent",
                  opacity: i < 32 ? 0.85 - (i % 6) * 0.05 : 1,
                }} />
              ))}
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon d={I.server} size={11} />4 clusters</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon d={I.gitCommit} size={11} />live</span>
            </div>
            <Sparkline style={{ height: 28, marginTop: 10 }} />
          </MockCard>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Build view ──────────── */
function MockBuild() {
  const steps = [
    { name: "Checkout",             status: "ok",      duration: "2s" },
    { name: "Install dependencies", status: "ok",      duration: "32s" },
    { name: "Lint & typecheck",     status: "ok",      duration: "18s" },
    { name: "Unit tests",           status: "ok",      duration: "1m 04s" },
    { name: "Build container",      status: "running", duration: "0:42" },
    { name: "Push image",           status: "pending", duration: "—" },
    { name: "Notify deploy",        status: "pending", duration: "—" },
  ];
  const runs = [
    ["#2148", "main",         "a4f9c2", "ok",      "2m"],
    ["#2147", "feat/auth",    "0bcf81", "running", "now"],
    ["#2146", "train-llm-7b", "92ad11", "ok",      "14m"],
    ["#2145", "etl/daily",    "ee2207", "fail",    "1h"],
  ];
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--bg)" }}>
      <MockSidebar active="Build" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MockHeader breadcrumb="build / pipelines" title="api · main" />
        <div style={{ display: "grid", gap: 12, padding: 16, gridTemplateColumns: "1.4fr 2fr" }}>
          <MockCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Recent runs</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>#2148</span>
            </div>
            <div style={{ marginTop: 10 }}>
              {runs.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 0", fontSize: 12,
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}>
                  <StatusDot tone={r[3] === "ok" ? "ok" : r[3] === "fail" ? "fail" : "info"} pulse={r[3] === "running"} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 40 }}>{r[0]}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 11, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    <Icon d={I.gitBranch} size={11} />{r[1]}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>{r[2]}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)", width: 32, textAlign: "right" }}>{r[4]}</span>
                </div>
              ))}
            </div>
          </MockCard>

          <MockCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Pipeline · #2147</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-muted)" }}>
                <Icon d={I.play} size={11} />running
              </span>
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {steps.map((s) => (
                <li key={s.name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 6,
                  border: s.status === "running" ? "1px solid var(--border-strong)" : "1px solid var(--border)",
                  background: s.status === "running" ? "var(--bg)" : "transparent",
                  padding: "6px 10px", fontSize: 12,
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 16, height: 16, borderRadius: 9999, border: "1px solid var(--border)",
                  }}>
                    {s.status === "ok" && <Icon d={I.check} size={10} />}
                    {s.status === "fail" && <Icon d={I.x} size={10} />}
                    {s.status === "running" && <Icon d={I.loader} size={10} className="spin" />}
                  </span>
                  <span style={{ flex: 1, color: s.status === "pending" ? "var(--fg-subtle)" : "var(--fg)" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)", fontVariantNumeric: "tabular-nums" }}>{s.duration}</span>
                </li>
              ))}
            </ol>
          </MockCard>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Agents view ──────────── */
function MockAgents() {
  const agents = Array.from({ length: 28 }).map((_, i) => ({
    id: `runner-${(i + 1).toString().padStart(2, "0")}`,
    cluster: ["prod-eu", "prod-us", "edge", "dev"][i % 4],
    status: i % 11 === 0 ? "warn" : i % 7 === 0 ? "muted" : "ok",
    load: 30 + ((i * 13) % 65),
  }));
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--bg)" }}>
      <MockSidebar active="Agents" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MockHeader breadcrumb="agents / runtime" title="Agents" />
        <div style={{ display: "grid", gap: 12, padding: 16, gridTemplateColumns: "2fr 1fr" }}>
          <MockCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Runners</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>28 active · 4 idle</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
              {agents.map((a) => (
                <div key={a.id} style={{
                  borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", padding: 8, fontSize: 11,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.id}</span>
                    <StatusDot tone={a.status} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}>{a.cluster}</div>
                  <div style={{ marginTop: 6, height: 4, width: "100%", borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${a.load}%`, background: "var(--fg)", opacity: 0.65 }} />
                  </div>
                </div>
              ))}
            </div>
          </MockCard>

          <MockCard>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Distribution</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {[
                ["prod-eu", 12, I.mapPin],
                ["prod-us", 9,  I.mapPin],
                ["edge",    4,  I.server],
                ["dev",     3,  I.cpu],
              ].map(([name, count, icon]) => (
                <li key={name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 6, border: "1px solid var(--border)",
                  padding: "6px 10px",
                }}>
                  <Icon d={icon} size={13} className="muted" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{count} runners</span>
                </li>
              ))}
            </ul>
          </MockCard>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Simple placeholder mocks for less-featured tabs ──────────── */

function MockGenericPanel({ active, breadcrumb, title, children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--bg)" }}>
      <MockSidebar active={active} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MockHeader breadcrumb={breadcrumb} title={title} />
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function MockApprove() {
  return (
    <MockGenericPanel active="Approve" breadcrumb="approve / change windows" title="release/api · v2.4.0">
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
        <MockCard>
          <Eyebrow style={{ fontSize: 10.5 }}>Required approvers · 2 of 3</Eyebrow>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["e.chen",     "Platform",  "ok"],
              ["mark.weber", "Security",  "ok"],
              ["j.park",     "SRE",       "muted"],
            ].map(([who, team, status]) => (
              <li key={who} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: 9999, background: "var(--bg)", border: "1px solid var(--border)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{who}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>{team}</div>
                </div>
                {status === "ok"
                  ? <Badge tone="success"><Icon d={I.check} size={10} />Approved</Badge>
                  : <Badge variant="outline">Pending</Badge>}
              </li>
            ))}
          </ul>
        </MockCard>
        <MockCard>
          <Eyebrow style={{ fontSize: 10.5 }}>Change window</Eyebrow>
          <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>Tue 14:00 → Tue 17:00 UTC</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", marginTop: 4 }}>opens in 2h 14m</div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <Eyebrow style={{ fontSize: 10.5 }}>Policy checks</Eyebrow>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {["coverage > 80%", "no critical CVEs", "rollback ready"].map((p) => (
                <li key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon d={I.check} size={12} className="ok" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </MockCard>
      </div>
    </MockGenericPanel>
  );
}

function MockDeploy() {
  return (
    <MockGenericPanel active="Deploy" breadcrumb="deploy / environments" title="api · production">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { env: "dev",        rev: "v2.4.0-rc.3", status: "ok",   age: "12m" },
          { env: "staging",    rev: "v2.4.0-rc.2", status: "ok",   age: "2h"  },
          { env: "production", rev: "v2.3.7",      status: "info", age: "rolling" },
        ].map((e) => (
          <MockCard key={e.env}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow style={{ fontSize: 10.5 }}>{e.env}</Eyebrow>
              <StatusDot tone={e.status} pulse={e.status === "info"} />
            </div>
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{e.rev}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{e.age}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm">View</Button>
              <Button variant="outline" size="sm">Rollback</Button>
            </div>
          </MockCard>
        ))}
      </div>
    </MockGenericPanel>
  );
}

function MockObserve() {
  return (
    <MockGenericPanel active="Observe" breadcrumb="observe / pipelines" title="Runtime diagnostics">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <MockCard>
          <Eyebrow style={{ fontSize: 10.5 }}>p50 / p95 latency · last 6h</Eyebrow>
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ width: "100%", height: 120, color: "var(--fg-muted)", marginTop: 8 }}>
            <polyline fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" points="0,90 20,85 40,80 60,82 80,75 100,72 120,65 140,68 160,60 180,55 200,58 220,50 240,45 260,52 280,40 300,38 320,30 340,32 360,28 380,25 400,22" />
            <polyline fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" points="0,100 20,98 40,95 60,99 80,90 100,88 120,82 140,84 160,75 180,72 200,76 220,68 240,62 260,70 280,55 300,52 320,45 340,48 360,42 380,38 400,35" />
          </svg>
        </MockCard>
        <MockCard>
          <Eyebrow style={{ fontSize: 10.5 }}>Errors · last 6h</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>0.42%</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-success)" }}>-0.12pp</div>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {[["timeout","12"],["5xx","6"],["connection_reset","2"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
        </MockCard>
      </div>
    </MockGenericPanel>
  );
}

function MockSecure() {
  return (
    <MockGenericPanel active="Secure" breadcrumb="secure / overview" title="Access & secrets">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          ["Identity providers",   "3",  "GitHub · Google · LDAP"],
          ["Active secrets",       "184", "across 12 workspaces"],
          ["Policy violations",    "0",  "all checks passing", "ok"],
        ].map(([label, value, sub, tone], i) => (
          <MockCard key={label}>
            <Eyebrow style={{ fontSize: 10.5 }}>{label}</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
            </div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: tone === "ok" ? "var(--accent-success)" : "var(--fg-subtle)" }}>{sub}</div>
          </MockCard>
        ))}
      </div>
    </MockGenericPanel>
  );
}

window.ProductPreview = ProductPreview;
