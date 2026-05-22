/* Marketing site hero — engineering-blueprint redesign.
   Mono headline, blueprint grid background, brand-signal accents,
   architecture-first schematic artwork. */

function Hero() {
  return (
    <section style={{
      position: "relative",
      overflow: "hidden",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Blueprint grid + radial fade */}
      <div aria-hidden="true" className="blueprint-bg fade-mask-radial"
           style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div style={{
        position: "relative",
        maxWidth: 1152, margin: "0 auto",
        padding: "96px 24px 112px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          alignItems: "center",
          gap: 56,
        }}>
          <div>
            {/* Eyebrow status chip */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 10px 4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 9999,
              background: "color-mix(in oklab, var(--bg-elevated) 80%, transparent)",
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--fg-muted)",
            }}>
              <span className="pulse-dot" style={{
                width: 6, height: 6, borderRadius: 9999,
                background: "var(--brand-signal)",
              }} />
              v0.4.0 · open source · agent-native
            </div>

            {/* Sans-display headline — Geist Sans at 600 carries SaaS gravitas
                while mono accents (wordmark, FIG captions, meta strip) keep
                the engineering identity. */}
            <h1 className="display" style={{
              fontSize: "clamp(40px, 5.4vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              fontWeight: 600,
              maxWidth: "16ch",
              marginTop: 24,
              marginBottom: 0,
              color: "var(--fg)",
            }}>
              The control plane for CI/CD, AI{" "}
              <span style={{ color: "var(--brand-signal)" }}>&amp;</span>{" "}
              agents.
            </h1>

            <p style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--fg-muted)",
              maxWidth: "34rem",
              marginTop: 24,
            }}>
              Arcentra unifies pipelines, training jobs, data workflows
              and agent runtime in one cloud-native command center.
              Self-host it. Extend it. Run it on infrastructure you own.
            </p>

            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Button variant="primary" size="lg" rightIcon={<Icon d={I.arrowUpRight} size={14} />}>
                Get started
              </Button>
              <Button variant="secondary" size="lg" leftIcon={<Icon d={I.github} size={14} />}>
                arcentrix/arcentra
              </Button>
            </div>

            {/* Meta strip with measure-line style */}
            <div style={{
              marginTop: 40,
              paddingTop: 20,
              borderTop: "1px dashed var(--border-strong)",
              display: "flex", flexWrap: "wrap",
              columnGap: 28, rowGap: 8,
              fontFamily: "var(--font-mono)", fontSize: 11,
              letterSpacing: "0.04em",
              color: "var(--fg-subtle)",
            }}>
              {[
                ["LIC", "Apache-2.0"],
                ["DEP", "self-hosted"],
                ["RUN", "kubernetes"],
                ["SYNC", "gitops"],
              ].map(([k, v]) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ color: "var(--brand-signal)", opacity: 0.7 }}>{k}</span>
                  <span style={{ color: "var(--fg-muted)" }}>{v}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Schematic architecture — the new hero artwork */}
          <SchematicHero />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   SchematicHero — the brand's hero artwork. A simplified
   blueprint of the Arcentra architecture: source → control plane
   → execution. Drawn flat (no tilt, no browser chrome) like an
   engineering diagram. Has a small "live" pipeline animation.
   ────────────────────────────────────────────────────────────── */
function SchematicHero() {
  return (
    <div style={{ position: "relative" }}>
      {/* Corner bracket frame */}
      <div className="bracket-frame" style={{
        position: "relative",
        padding: 24,
        background: "color-mix(in oklab, var(--bg) 50%, transparent)",
      }}>
        {/* Schematic SVG */}
        <svg viewBox="0 0 560 480" style={{ width: "100%", height: "auto", display: "block" }}
             role="img" aria-label="Arcentra control-plane topology">
          <defs>
            <marker id="hero-arrow" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
            </marker>
            <marker id="hero-arrow-signal" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill="var(--brand-signal)" />
            </marker>
          </defs>

          {/* Sources column */}
          <SchemaNode x={20}  y={32}  w={160} h={56} title="git"     sub="github · gitlab" />
          <SchemaNode x={20}  y={104} w={160} h={56} title="webhook" sub="push · pr · tag" />
          <SchemaNode x={20}  y={176} w={160} h={56} title="schedule" sub="cron · interval" />

          {/* Control plane (center, highlighted) */}
          <g>
            <rect x={220} y={60} width={240} height={200} rx={6}
                  fill="color-mix(in oklab, var(--bg-elevated) 80%, transparent)"
                  stroke="var(--brand-signal-dim)"
                  strokeWidth={1.2} />
            <text x={236} y={86} fontSize={11} fontFamily="var(--font-mono)"
                  letterSpacing={2} fill="var(--brand-signal)" opacity={0.9}>
              ▸ CONTROL PLANE
            </text>
            <text x={236} y={110} fontSize={20} fontFamily="var(--font-mono)"
                  letterSpacing={-1} fill="var(--fg)" fontWeight={500}>
              arcentra<tspan fill="var(--brand-signal)">/</tspan>
            </text>
            <line x1={236} y1={128} x2={444} y2={128} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" />

            {/* Sub-modules grid */}
            <SchemaChip x={236} y={144} text="api" />
            <SchemaChip x={286} y={144} text="scheduler" w={64} />
            <SchemaChip x={354} y={144} text="policy" />
            <SchemaChip x={404} y={144} text="audit" />

            <SchemaChip x={236} y={172} text="workspace" w={70} />
            <SchemaChip x={310} y={172} text="rbac" />
            <SchemaChip x={356} y={172} text="gitops" />
            <SchemaChip x={404} y={172} text="approvals" w={56} />

            <SchemaChip x={236} y={200} text="secrets" w={58} />
            <SchemaChip x={298} y={200} text="state" />
            <SchemaChip x={342} y={200} text="diagnostics" w={74} />
            <SchemaChip x={420} y={200} text="ui" />

            <text x={236} y={244} fontSize={9.5} fontFamily="var(--font-mono)"
                  letterSpacing={1} fill="var(--fg-subtle)">
              mTLS · gRPC · webhooks
            </text>
          </g>

          {/* Execution column */}
          <SchemaNode x={500} y={32}  w={170} h={56} title="agents"   sub="runners · workers" highlight />
          <SchemaNode x={500} y={104} w={170} h={56} title="gpu pool" sub="ai training" />
          <SchemaNode x={500} y={176} w={170} h={56} title="k8s / vm" sub="execution targets" />

          {/* Database row */}
          <SchemaNode x={20}  y={304} w={160} h={56} title="postgres"  sub="state" />
          <SchemaNode x={220} y={304} w={150} h={56} title="vault"     sub="secrets" />
          <SchemaNode x={400} y={304} w={150} h={56} title="prometheus" sub="metrics" />

          {/* Output: pipeline run */}
          <g>
            <rect x={20} y={400} width={520} height={56} rx={6}
                  fill="transparent" stroke="var(--border)" strokeWidth={1} />
            <text x={36} y={418} fontSize={9.5} fontFamily="var(--font-mono)"
                  letterSpacing={1} fill="var(--fg-subtle)">
              ▸ PIPELINE · #2148 · api · main
            </text>
            {/* Step pills */}
            {["checkout", "lint", "test", "build", "deploy"].map((s, i, arr) => (
              <g key={s} transform={`translate(${40 + i * 100}, 428)`}>
                <rect width={86} height={20} rx={3}
                      fill={i < 3 ? "color-mix(in oklab, var(--accent-success) 14%, transparent)" : (i === 3 ? "color-mix(in oklab, var(--brand-signal) 14%, transparent)" : "transparent")}
                      stroke={i < 3 ? "color-mix(in oklab, var(--accent-success) 40%, transparent)" : (i === 3 ? "var(--brand-signal-dim)" : "var(--border)")}
                      strokeWidth={1} />
                <text x={10} y={14} fontSize={10} fontFamily="var(--font-mono)"
                      fill={i < 3 ? "var(--accent-success)" : (i === 3 ? "var(--brand-signal)" : "var(--fg-subtle)")}>
                  {s}
                </text>
              </g>
            ))}
          </g>

          {/* Connections: sources → control plane */}
          {[60, 132, 204].map((y, i) => (
            <line key={i}
                  x1={180} y1={y} x2={220} y2={132 + (i - 1) * 20}
                  stroke="currentColor" strokeWidth={1} strokeDasharray="2 2"
                  opacity={0.55}
                  markerEnd="url(#hero-arrow)" />
          ))}

          {/* Connections: control plane → execution */}
          {[60, 132, 204].map((y, i) => (
            <line key={i}
                  x1={460} y1={132 + (i - 1) * 20} x2={500} y2={y}
                  stroke="var(--brand-signal)" strokeOpacity={i === 0 ? 1 : 0.4}
                  strokeWidth={1} strokeDasharray={i === 0 ? "none" : "2 2"}
                  markerEnd={i === 0 ? "url(#hero-arrow-signal)" : "url(#hero-arrow)"} />
          ))}

          {/* Connection: control plane → data row */}
          <line x1={340} y1={260} x2={340} y2={304} stroke="currentColor"
                strokeWidth={1} strokeDasharray="2 2" opacity={0.55}
                markerEnd="url(#hero-arrow)" />
          {/* Connection: data row → pipeline output */}
          <line x1={340} y1={360} x2={340} y2={400} stroke="currentColor"
                strokeWidth={1} strokeDasharray="2 2" opacity={0.4}
                markerEnd="url(#hero-arrow)" />

          {/* Group color: SVG inherits via currentColor */}
        </svg>
        <div style={{ color: "var(--fg-muted)", height: 0 }} />

        {/* Caption */}
        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px dashed var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "var(--font-mono)", fontSize: 10.5,
          letterSpacing: "0.06em",
          color: "var(--fg-subtle)",
        }}>
          <span>FIG.01 · system topology</span>
          <span style={{ color: "var(--brand-signal)", opacity: 0.85 }}>● live · 32 / 48 agents</span>
        </div>
      </div>
    </div>
  );
}

function SchemaNode({ x, y, w, h, title, sub, highlight }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4}
            fill={highlight ? "color-mix(in oklab, var(--brand-signal) 8%, transparent)" : "transparent"}
            stroke={highlight ? "var(--brand-signal-dim)" : "var(--border-strong)"}
            strokeWidth={1} />
      <text x={x + 12} y={y + 22} fontSize={13} fontFamily="var(--font-mono)"
            fontWeight={500} fill="var(--fg)" letterSpacing={-0.5}>
        {title}
      </text>
      <text x={x + 12} y={y + 40} fontSize={10} fontFamily="var(--font-mono)"
            fill="var(--fg-subtle)" letterSpacing={0.5}>
        {sub}
      </text>
    </g>
  );
}

function SchemaChip({ x, y, text, w = 42 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={18} rx={2}
            fill="transparent" stroke="var(--border)" strokeWidth={1} />
      <text x={x + 6} y={y + 13} fontSize={9.5} fontFamily="var(--font-mono)"
            fill="var(--fg-muted)" letterSpacing={0.5}>
        {text}
      </text>
    </g>
  );
}

window.Hero = Hero;
