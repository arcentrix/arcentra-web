/* Marketing site — workflow + capabilities + why-arcentra + workloads */

function CoreWorkflow() {
  const STEPS = [
    { id: "code",    label: "Code",    icon: I.code },
    { id: "build",   label: "Build",   icon: I.hammer },
    { id: "approve", label: "Approve", icon: I.shieldCheck },
    { id: "deploy",  label: "Deploy",  icon: I.rocket },
    { id: "observe", label: "Observe", icon: I.scanEye },
    { id: "recover", label: "Recover", icon: I.refresh },
  ];
  const CAPS = [
    ["build",   "Build",   "Pipelines, runners, artifacts and execution history."],
    ["approve", "Approve", "Required approvals, change windows and policy gates between stages."],
    ["deploy",  "Deploy",  "Environments, releases, GitOps and rollback controls."],
    ["agents",  "Agents",  "Distributed execution across clusters, GPU pools and private networks."],
    ["observe", "Observe", "Runtime health, pipeline status, logs and diagnostics."],
    ["secure",  "Secure",  "Identity, access, secrets and policies."],
  ];

  return (
    <section style={{ position: "relative", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: "48rem" }}>
          <Eyebrow style={{ marginBottom: 12 }}>Core workflow</Eyebrow>
          <h2 className="display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Code → Build → Approve → Deploy → Observe → Recover.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", marginTop: 16 }}>
            One delivery loop, modeled as a connected graph instead of a stack of
            disconnected tools — with policy-gated approvals between every stage.
          </p>
        </div>

        {/* Step circles with connecting line */}
        <div style={{ position: "relative", marginTop: 48 }}>
          <div aria-hidden="true" style={{
            position: "absolute",
            left: 24, right: 24, top: 28,
            height: 1, background: "var(--border)",
          }} />
          <ol style={{
            display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12,
            listStyle: "none", margin: 0, padding: 0,
          }}>
            {STEPS.map((s, i) => (
              <li key={s.id} style={{
                position: "relative", display: "flex", flexDirection: "column",
                alignItems: "center", textAlign: "center",
              }}>
                <div style={{
                  position: "relative", zIndex: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 56, height: 56, borderRadius: 9999,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg)",
                }}>
                  <Icon d={s.icon} size={20} />
                </div>
                <div style={{ marginTop: 12, fontWeight: 500, letterSpacing: "-0.01em" }}>{s.label}</div>
                <Eyebrow>step {i + 1}</Eyebrow>
              </li>
            ))}
          </ol>
        </div>

        {/* Capability grid (gap-px paneled trick) */}
        <div style={{
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          {CAPS.map(([id, title, desc]) => (
            <div key={id} style={{ background: "var(--bg)", padding: 24 }}>
              <Eyebrow style={{ fontSize: 10.5, marginBottom: 8 }}>{id}</Eyebrow>
              <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55, marginTop: 8 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyArcentra() {
  const ROWS = [
    ["Scattered pipelines across vendors",  "Unified pipeline view across teams"],
    ["Manual deployment operations",         "Controlled release workflow with policies"],
    ["Hard-to-manage runners",               "Agent runtime, observable in one place"],
    ["Hidden failure context",               "Runtime diagnostics next to the run"],
    ["Separated access control",             "Workspace-level identity and secrets"],
  ];
  return (
    <section style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: "48rem" }}>
          <Eyebrow style={{ marginBottom: 12 }}>Why Arcentra</Eyebrow>
          <h2 className="display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Modern delivery stacks are fragmented.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", marginTop: 16 }}>
            CI lives in one place. Deployments live somewhere else. Agents are hard to
            operate. Secrets are scattered. Observability is disconnected. Arcentra
            connects them into one open-source control plane.
          </p>
        </div>

        <div style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderRadius: 16,
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}>
          <div style={{ borderRight: "1px solid var(--border)", padding: 32, background: "var(--bg)" }}>
            <Eyebrow style={{ marginBottom: 16 }}>Before Arcentra</Eyebrow>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {ROWS.map(([before]) => (
                <li key={before} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14.5, color: "var(--fg-muted)" }}>
                  <span style={{
                    marginTop: 3, display: "inline-flex", flexShrink: 0,
                    width: 16, height: 16, borderRadius: 9999,
                    border: "1px solid var(--border)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon d={I.x} size={10} />
                  </span>
                  <span>{before}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ padding: 32, background: "var(--bg-elevated)" }}>
            <Eyebrow style={{ marginBottom: 16 }}>With Arcentra</Eyebrow>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {ROWS.map(([, after]) => (
                <li key={after} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14.5 }}>
                  <span style={{
                    marginTop: 3, display: "inline-flex", flexShrink: 0,
                    width: 16, height: 16, borderRadius: 9999,
                    border: "1px solid var(--border-strong)",
                    background: "var(--accent-bg)", color: "var(--accent-fg)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon d={I.check} size={10} />
                  </span>
                  <span>{after}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workloads() {
  const W = [
    { icon: I.gitBranch, tag: "CI / CD", title: "Build, test and ship code",
      desc: "Run pipelines, build artifacts, gate releases and deploy services across your environments.",
      ex: ["build · api · main", "test · web · pr-2148", "deploy · staging → production"] },
    { icon: I.brain,    tag: "AI / ML", title: "Train, evaluate and serve models",
      desc: "Schedule training and fine-tuning jobs on GPU pools, run evals, manage prompts and ship inference endpoints.",
      ex: ["train · llm-7b · finetune-v3", "eval · ragas-suite · nightly", "serve · inference · canary"] },
    { icon: I.database, tag: "Data", title: "Run ETL and big-data jobs",
      desc: "Orchestrate Spark, Ray and Airflow workloads. Schedule batch, streaming and scheduled jobs alongside CI/CD.",
      ex: ["etl · daily · 03:00 UTC", "spark · feature-store · backfill", "stream · kafka → warehouse"] },
  ];
  return (
    <section style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: "48rem" }}>
          <Eyebrow style={{ marginBottom: 12 }}>Workloads</Eyebrow>
          <h2 className="display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            One control plane for every workload.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-muted)", marginTop: 16 }}>
            CI/CD pipelines, AI training jobs and data workflows share the same
            scheduler, agents, secrets and policies. No more duct-taping three
            different platforms together.
          </p>
        </div>

        <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {W.map((w) => (
            <div key={w.tag} style={{
              borderRadius: 16, border: "1px solid var(--border)",
              background: "var(--bg)", padding: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon d={w.icon} size={16} />
                </div>
                <Eyebrow style={{ fontSize: 10.5 }}>{w.tag}</Eyebrow>
              </div>
              <h3 style={{ marginTop: 20, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{w.title}</h3>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55 }}>{w.desc}</p>
              <div style={{
                marginTop: 20, padding: 12, borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-elevated)",
              }}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {w.ex.map((e) => (
                    <li key={e} style={{
                      display: "flex", gap: 8, fontFamily: "var(--font-mono)",
                      fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.55,
                    }}>
                      <span style={{ color: "var(--fg-subtle)", userSelect: "none" }}>$</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.CoreWorkflow = CoreWorkflow;
window.WhyArcentra = WhyArcentra;
window.Workloads = Workloads;
