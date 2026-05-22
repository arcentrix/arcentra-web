/* Web app — AI Chat page. Sidebar with conversation history + main
   chat surface with tool-call cards and code blocks.
   Adapted from arcentra-web/src/pages/LLMDialogue/Chat + History. */

function Chat() {
  const conversations = [
    { id: "c1", title: "Why is the api·main pipeline slow today?",  date: "2m ago",  active: true },
    { id: "c2", title: "Draft a postmortem for v2.3.6 rollback",     date: "1h ago" },
    { id: "c3", title: "Refactor approval-gate to support time windows", date: "yesterday" },
    { id: "c4", title: "Compare release strategies: canary vs blue-green", date: "yesterday" },
    { id: "c5", title: "Explain MTTR drop over past 7 days",         date: "2 days ago" },
    { id: "c6", title: "Help me write a Spark job for backfill",     date: "3 days ago" },
    { id: "c7", title: "Onboarding script for new SRE",              date: "1 week ago" },
  ];
  const [activeId, setActiveId] = React.useState("c1");
  const [draft, setDraft] = React.useState("");

  // Pre-baked sample exchange — illustrates tool-call card + code block + sources
  const messages = [
    {
      role: "user",
      content: "why is the api·main pipeline slow today?",
      at: "2m ago",
    },
    {
      role: "assistant",
      content: null,
      tool: {
        name: "arcentra.pipeline.diagnose",
        args: { pipeline: "api·main", window: "6h" },
        status: "ok",
        result: [
          ["build-container", "0:42 → 1:14", "+76% vs 7d median"],
          ["unit-tests",      "1:04 → 1:08", "+6% vs 7d median"],
          ["push-image",      "0:23 → 0:23", "0% vs 7d median"],
        ],
      },
      at: "2m ago",
    },
    {
      role: "assistant",
      content: (
        <>
          The slowdown is concentrated in <span className="ars-mono-inline">build-container</span> on
          runner-04 in <span className="ars-mono-inline">prod-eu</span>. p95 stage duration jumped
          from <span className="ars-mono-inline">0:42</span> to <span className="ars-mono-inline">1:14</span>{" "}
          (<span style={{ color: "var(--accent-danger)" }}>+76%</span>) starting around{" "}
          <span className="ars-mono-inline">14:22 UTC</span>.
          <br /><br />
          Likely cause: runner-04's container layer cache was rebuilt at 14:18 (during the
          deploy of <span className="ars-mono-inline">v2.3.8</span>). The first ~12 builds
          after a cache wipe will be slow until layers re-warm.
          <br /><br />
          Two fixes:
        </>
      ),
      at: "1m ago",
    },
    {
      role: "assistant",
      content: null,
      code: {
        language: "yaml",
        path: "arcentra.yaml",
        body:
`pipeline: api
build:
  cache:
    keys:
      - "{{ checksum 'go.sum' }}"
      - "{{ branch }}"
    paths:
      - /go/pkg/mod
      - /root/.cache/go-build
  runner:
    selector:
      arch: x86_64
      cache_warm: true   # ← prefer warm runners`,
      },
      at: "1m ago",
    },
    {
      role: "assistant",
      content: (
        <>
          <strong>Option 1.</strong> Add the <span className="ars-mono-inline">cache_warm: true</span>{" "}
          selector above so the scheduler skips just-rebuilt runners for the first 10 minutes
          after a cache wipe.
          <br /><br />
          <strong>Option 2.</strong> Pre-warm by triggering an empty build immediately after
          deploy. I can wire that as a post-deploy hook on the deploy/api pipeline.
          <br /><br />
          Sources:
        </>
      ),
      sources: [
        ["build #2147", "api·main · 1m 14s build stage"],
        ["build #2146", "api·main · 0m 42s build stage"],
        ["runner-04",   "cache reset · 14:18 UTC"],
        ["deploy/api",  "v2.3.8 promoted at 14:18 UTC"],
      ],
      at: "1m ago",
    },
  ];

  return (
    <section style={{ padding: 0, display: "grid", gridTemplateColumns: "260px 1fr", height: "calc(100dvh - 56px)", minHeight: 600 }}>
      {/* Sidebar */}
      <aside style={{
        borderRight: "1px solid var(--border)",
        background: "var(--bg)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <Eyebrow>copilot</Eyebrow>
          <h2 className="display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", margin: "8px 0 12px" }}>Arcentra Copilot</h2>
          <Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />} style={{ width: "100%" }}>New conversation</Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ padding: "8px 16px 4px" }}>
            <div className="eyebrow" style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--fg-subtle)",
            }}>History</div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <button onClick={() => setActiveId(c.id)} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 16px", border: 0,
                    background: active ? "var(--bg-elevated)" : "transparent",
                    boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
                    cursor: "pointer",
                  }}>
                    <div style={{
                      fontSize: 12.5, color: active ? "var(--fg)" : "var(--fg-muted)",
                      fontFamily: "var(--font-sans)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{c.title}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 2 }}>{c.date}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 6,
            background: "color-mix(in oklab, var(--brand-signal) 6%, transparent)",
            border: "1px solid var(--brand-signal-dim)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--brand-signal)" }} className="pulse-dot" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brand-signal)" }}>connected · 14 tools</span>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
        {/* Conversation header */}
        <header style={{
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h3 className="display" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>
              {conversations.find((c) => c.id === activeId)?.title}
            </h3>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", marginTop: 2 }}>
              model · arcentra-copilot-v0.4 · 5 messages · 14 tool calls available
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="ghost" size="sm" leftIcon={<Icon d={I.copy} size={12} />}>Share</Button>
            <Button variant="ghost" size="sm">Archive</Button>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((m, i) => (
              <ChatMessage key={i} {...m} />
            ))}

            {/* Live "typing" indicator */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--fg-subtle)" }}>
              <span style={{
                width: 28, height: 28, borderRadius: 9999,
                border: "1px solid var(--brand-signal-dim)",
                background: "color-mix(in oklab, var(--brand-signal) 8%, transparent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--brand-signal)",
              }}>
                <Icon d={I.brain} size={14} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>copilot is thinking…</span>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <Composer draft={draft} setDraft={setDraft} />
            <div style={{
              marginTop: 8, display: "flex", justifyContent: "space-between",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)",
            }}>
              <span>↵ send · ⇧↵ newline · / for commands</span>
              <span>copilot may make mistakes — verify before applying to prod</span>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .ars-mono-inline {
          font-family: var(--font-mono);
          font-size: 0.92em;
          padding: 1px 5px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--fg);
        }
      `}} />
    </section>
  );
}

function ChatMessage({ role, content, tool, code, sources, at }) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: 10, borderTopRightRadius: 4,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          fontSize: 14, lineHeight: 1.55, color: "var(--fg)",
        }}>
          {content}
          <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)", textAlign: "right" }}>{at}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{
        flexShrink: 0,
        width: 28, height: 28, borderRadius: 9999,
        border: "1px solid var(--brand-signal-dim)",
        background: "color-mix(in oklab, var(--brand-signal) 8%, transparent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--brand-signal)",
      }}>
        <Icon d={I.brain} size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tool && <ToolCard tool={tool} />}
        {code && <CodeBlock code={code} />}
        {content && (
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--fg)" }}>
            {content}
          </div>
        )}
        {sources && (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0,
                       display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sources.map(([title, sub], i) => (
              <li key={i} style={{
                display: "inline-flex", flexDirection: "column",
                padding: "6px 10px",
                border: "1px solid var(--border)", borderRadius: 6,
                background: "var(--bg-elevated)",
                fontFamily: "var(--font-mono)",
              }}>
                <span style={{ fontSize: 11.5, color: "var(--fg)" }}>{title}</span>
                <span style={{ fontSize: 10.5, color: "var(--fg-subtle)" }}>{sub}</span>
              </li>
            ))}
          </ul>
        )}
        {at && <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>{at}</div>}
      </div>
    </div>
  );
}

function ToolCard({ tool }) {
  return (
    <div style={{
      borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg-elevated)",
      marginBottom: 10,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--font-mono)", fontSize: 11,
      }}>
        <Icon d={I.zap} size={12} style={{ color: "var(--brand-signal)" }} />
        <span style={{ color: "var(--brand-signal)" }}>tool</span>
        <span style={{ color: "var(--fg)" }}>{tool.name}</span>
        <span style={{ color: "var(--fg-subtle)", marginLeft: "auto" }}>
          {tool.status === "ok" ? "✓ 320ms" : tool.status}
        </span>
      </div>
      <div style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
        <div style={{ color: "var(--fg-subtle)" }}>
          <span style={{ color: "var(--fg-muted)" }}>args</span> ={" "}
          <span style={{ color: "var(--fg)" }}>{JSON.stringify(tool.args)}</span>
        </div>
        <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ color: "var(--fg-subtle)", textAlign: "left" }}>
              <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>Stage</th>
              <th style={{ padding: "4px 8px",       fontWeight: 500 }}>Duration</th>
              <th style={{ padding: "4px 0 4px 8px",fontWeight: 500, textAlign: "right" }}>Δ vs median</th>
            </tr>
          </thead>
          <tbody>
            {tool.result.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "4px 8px 4px 0", color: "var(--fg)" }}>{r[0]}</td>
                <td style={{ padding: "4px 8px",       color: "var(--fg-muted)" }}>{r[1]}</td>
                <td style={{ padding: "4px 0 4px 8px", textAlign: "right",
                              color: r[2].startsWith("+") && parseInt(r[2]) > 20 ? "var(--accent-warn)" : "var(--fg-muted)" }}>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ code }) {
  return (
    <div style={{
      borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg-elevated)",
      margin: "8px 0 12px",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px", borderBottom: "1px solid var(--border)",
        fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)",
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        <span>{code.language} · {code.path}</span>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 6px", borderRadius: 4,
          border: 0, background: "transparent",
          color: "var(--fg-muted)", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 10,
        }}>
          <Icon d={I.copy} size={11} />Copy
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 14,
        fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7,
        color: "var(--fg)", whiteSpace: "pre",
        overflowX: "auto",
      }}>{code.body}</pre>
    </div>
  );
}

function Composer({ draft, setDraft }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
  }, [draft]);
  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--bg-elevated)",
      padding: 12,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ask copilot anything · type / for commands"
        rows={1}
        style={{
          width: "100%", resize: "none", border: 0, outline: "none",
          background: "transparent", color: "var(--fg)",
          fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55,
          padding: "4px 6px",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ComposerChip icon={I.plus}        label="Attach" />
        <ComposerChip icon={I.gitBranch}   label="api·main" />
        <ComposerChip icon={I.zap}         label="Tools"  count={14} />
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" leftIcon={<Icon d={I.arrowRight} size={13} />}>Send</Button>
      </div>
    </div>
  );
}

function ComposerChip({ icon, label, count }) {
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 26, padding: "0 8px",
      borderRadius: 6, border: "1px solid var(--border)",
      background: "var(--bg)",
      color: "var(--fg-muted)",
      fontFamily: "var(--font-mono)", fontSize: 11,
      cursor: "pointer",
    }}>
      <Icon d={icon} size={11} />
      {label}
      {typeof count === "number" && (
        <span style={{ color: "var(--fg-subtle)" }}>· {count}</span>
      )}
    </button>
  );
}

window.Chat = Chat;
