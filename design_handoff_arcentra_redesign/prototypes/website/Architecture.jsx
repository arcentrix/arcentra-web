/* Marketing site — Architecture diagram, OpenSource, BottomCta */

function Architecture() {
  const LAYERS = [
    { title: "Control Plane",   chips: ["API", "Scheduler", "Workspace", "Policy", "GitOps", "Approvals", "Audit"],
      desc: "Workspaces, RBAC, scheduling, GitOps reconciliation, approval gates and policy evaluation." },
    { title: "Execution Layer", chips: ["Agents", "Runners", "GPU pools", "Workers", "Task runtime", "Sandbox"],
      desc: "Distributed runners and GPU pools that execute CI, AI and data jobs on your clusters, clouds and private networks." },
    { title: "Integration Layer", chips: ["GitHub", "GitLab", "Kubernetes", "Spark / Ray", "Airflow", "MLflow", "Secrets", "Observability"],
      desc: "Pluggable adapters that connect Arcentra to source control, schedulers, ML tooling and your existing infrastructure." },
  ];

  return (
    <section style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: "48rem" }}>
          <Eyebrow style={{ marginBottom: 12 }}>Architecture</Eyebrow>
          <h2 className="display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Transparent, layered, cloud-native.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", marginTop: 16 }}>
            A control plane you can read, audit and extend. Three layers, each
            replaceable, each running on infrastructure you own.
          </p>
        </div>

        {/* Diagram */}
        <div style={{
          marginTop: 48, borderRadius: 16, overflow: "hidden",
          border: "1px solid var(--border)", background: "var(--bg)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--fg-subtle)",
          }}>
            <span>flow · data plane</span>
            <span style={{ textTransform: "none", letterSpacing: 0 }}>mTLS · gRPC · webhooks</span>
          </div>
          <svg viewBox="0 0 980 260" style={{ width: "100%", height: "auto", color: "var(--fg-muted)" }}
               role="img" aria-label="Arcentra control plane data flow">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
              </marker>
            </defs>
            <DiagramBox x={30}  y={50}  w={180} h={70}  title="Git Provider"     sub="GitHub / GitLab" />
            <DiagramBox x={290} y={20}  w={400} h={130} title="Arcentra Control Plane" sub="API · Scheduler · Workspace · Policy · GitOps" highlight />
            <DiagramBox x={770} y={50}  w={180} h={70}  title="Agents"           sub="runners · workers" />
            <DiagramBox x={770} y={170} w={180} h={70}  title="K8s / VM"         sub="execution targets" />
            <DiagramBox x={290} y={170} w={180} h={70}  title="Database / Vault" sub="state · secrets" />
            <DiagramBox x={510} y={170} w={180} h={70}  title="Observability"   sub="logs · metrics · traces" />
            <DiagramLine x1={210} y1={85}  x2={290} y2={85} />
            <DiagramLine x1={690} y1={85}  x2={770} y2={85} />
            <DiagramLine x1={860} y1={120} x2={860} y2={170} />
            <DiagramLine x1={380} y1={150} x2={380} y2={170} />
            <DiagramLine x1={600} y1={150} x2={600} y2={170} />
          </svg>
        </div>

        {/* Layer cards */}
        <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {LAYERS.map((l) => (
            <div key={l.title} style={{
              borderRadius: 16, border: "1px solid var(--border)",
              background: "var(--bg)", padding: 24,
            }}>
              <Eyebrow style={{ marginBottom: 8 }}>Layer</Eyebrow>
              <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{l.title}</h3>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55 }}>{l.desc}</p>
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {l.chips.map((c) => (
                  <span key={c} style={{
                    display: "inline-flex", alignItems: "center",
                    border: "1px solid var(--border)", background: "var(--bg-elevated)",
                    padding: "1px 8px", borderRadius: 6,
                    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)",
                  }}>{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DiagramBox({ x, y, w, h, title, sub, highlight }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10"
            fill={highlight ? "var(--bg-elevated)" : "transparent"}
            stroke={highlight ? "var(--border-strong)" : "var(--border)"}
            strokeWidth="1" />
      <text x={x + 16} y={y + 28} fontSize="13" fontWeight="600" fontFamily="var(--font-sans)" fill="var(--fg)">{title}</text>
      <text x={x + 16} y={y + 48} fontSize="11" fontFamily="var(--font-mono)" fill="var(--fg-subtle)">{sub}</text>
    </g>
  );
}
function DiagramLine({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" markerEnd="url(#arrow)" />;
}

/* ──────────────────────────────────────────────────────────── */

function OpenSource() {
  const CHIPS = ["Open-source first", "Self-hosted", "Extensible", "Cloud-native"];
  return (
    <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
      <GridBg fade="radial" />
      <div style={{ position: "relative", maxWidth: 1152, margin: "0 auto", padding: "96px 24px 112px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <Eyebrow style={{ marginBottom: 12 }}>Open source</Eyebrow>
            <h2 className="display" style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.035em", margin: 0 }}>
              Open source by design.
            </h2>
            <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: "36rem" }}>
              Arcentra is built in the open for teams who want control, extensibility
              and self-hosted delivery infrastructure. Read the code, file an issue,
              ship a patch — or fork it.
            </p>

            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CHIPS.map((c) => (
                <span key={c} style={{
                  display: "inline-flex", alignItems: "center", padding: "4px 12px",
                  borderRadius: 9999, border: "1px solid var(--border)",
                  background: "var(--bg-elevated)", color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono)", fontSize: 11,
                }}>{c}</span>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Button variant="primary" size="lg"
                leftIcon={<Icon d={I.github} size={14} />}
                rightIcon={<Icon d={I.arrowUpRight} size={13} className="opacity-70" />}>GitHub</Button>
              <Button variant="secondary" size="lg" leftIcon={<Icon d={I.gitPull} size={14} />}>Contribute</Button>
              <Button variant="ghost" size="lg" leftIcon={<Icon d={I.map} size={14} />}>Roadmap</Button>
            </div>
          </div>

          {/* Terminal block */}
          <div style={{
            position: "relative",
            borderRadius: 16, border: "1px solid var(--border)",
            background: "var(--bg)", padding: 24,
            fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7,
          }}>
            <div style={{
              position: "absolute", top: -12, left: 24,
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--bg)",
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)",
            }}>~/arcentrix/arcentra</div>
            <div style={{ color: "var(--fg-muted)" }}>
              <div><span style={{ color: "var(--fg-subtle)" }}>$</span> <span style={{ color: "var(--fg)" }}>git clone</span> git@github.com:arcentrix/arcentra.git</div>
              <div><span style={{ color: "var(--fg-subtle)" }}>$</span> <span style={{ color: "var(--fg)" }}>cd</span> arcentra</div>
              <div><span style={{ color: "var(--fg-subtle)" }}>$</span> <span style={{ color: "var(--fg)" }}>make</span> dev</div>
              <div style={{ height: 8 }} />
              <div><span style={{ color: "var(--accent-success)" }}>→</span> control plane on <span style={{ color: "var(--fg)" }}>:8080</span></div>
              <div><span style={{ color: "var(--accent-success)" }}>→</span> agent runtime on <span style={{ color: "var(--fg)" }}>:9090</span></div>
              <div><span style={{ color: "var(--accent-success)" }}>→</span> docs on <span style={{ color: "var(--fg)" }}>:3001</span></div>
              <div style={{ height: 8 }} />
              <div style={{ color: "var(--fg-subtle)" }}># everything you need to hack on Arcentra.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BottomCta() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <GridBg fade="y" />
      <div style={{ position: "relative", maxWidth: 896, margin: "0 auto", padding: "96px 24px 128px", textAlign: "center" }}>
        <h2 className="display" style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.035em", maxWidth: "22ch", margin: "0 auto" }}>
          Ready to build your delivery control plane?
        </h2>
        <p style={{ marginTop: 20, maxWidth: "36rem", marginLeft: "auto", marginRight: "auto", fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)" }}>
          Start locally, connect your agents, and ship your first pipeline.
        </p>
        <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Button variant="primary" size="lg" rightIcon={<Icon d={I.arrowUpRight} size={14} />}>Get Started</Button>
          <Button variant="secondary" size="lg" leftIcon={<Icon d={I.github} size={14} />}>View on GitHub</Button>
        </div>
      </div>
    </section>
  );
}

window.Architecture = Architecture;
window.OpenSource = OpenSource;
window.BottomCta = BottomCta;
