/* Web app — top command bar: breadcrumb + actions */

function TopBar({ breadcrumb = ["Arcentra", "Overview"], onOpenPalette, onOpenInbox, unreadCount = 3 }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16,
      height: 56, paddingLeft: 24, paddingRight: 24,
      borderBottom: "1px solid var(--border)",
      background: "color-mix(in oklab, var(--bg) 85%, transparent)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {breadcrumb.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon d={I.chevronRight} size={14} className="muted" />}
            <span style={{
              fontSize: 13,
              color: i === breadcrumb.length - 1 ? "var(--fg)" : "var(--fg-muted)",
              fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
            }}>{crumb}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onOpenPalette}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 32, padding: "0 8px 0 10px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--fg-muted)", fontSize: 12, cursor: "pointer",
            fontFamily: "var(--font-sans)",
            minWidth: 220,
          }}>
          <Icon d={I.search} size={13} />
          <span style={{ flex: 1, textAlign: "left" }}>Search · projects, runs, agents…</span>
          <span style={{ display: "inline-flex", gap: 2 }}>
            <kbd style={kbd2}>⌘</kbd><kbd style={kbd2}>K</kbd>
          </span>
        </button>
        <ThemeToggle />
        <button onClick={onOpenInbox} aria-label="Inbox" style={{
          position: "relative",
          width: 32, height: 32, borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--bg-elevated)",
          color: "var(--fg-muted)", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon d={I.bell} size={14} />
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 9999,
              background: "var(--brand-signal)",
              color: "var(--bg)",
              fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--bg)",
              fontVariantNumeric: "tabular-nums",
            }}>{unreadCount}</span>
          )}
        </button>
        <IconBtn icon={I.plus} aria-label="Create new" />
      </div>
    </header>
  );
}

/* Theme toggle — flips `light` class on <html>. Defaults to dark.
   Reads the current state on mount so toggling survives reload-by-state. */
function ThemeToggle() {
  const [light, setLight] = React.useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light")
  );
  const toggle = () => {
    const next = !light;
    document.documentElement.classList.toggle("light", next);
    setLight(next);
  };
  // Sun (light) / Moon (dark) glyphs
  const SUN  = ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"];
  const MOON = "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: "1px solid var(--border)", background: "var(--bg-elevated)",
        color: "var(--fg-muted)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
      <Icon d={light ? MOON : SUN} size={14} stroke={1.7} />
    </button>
  );
}
const kbd2 = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 18, height: 18, padding: "0 4px",
  borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)",
  fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-muted)",
};
function IconBtn({ icon, ...rest }) {
  return (
    <button {...rest} style={{
      width: 32, height: 32, borderRadius: 8,
      border: "1px solid var(--border)", background: "var(--bg-elevated)",
      color: "var(--fg-muted)", cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon d={icon} size={14} />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Command palette — overlaid full-screen dialog. Searches projects,
   runs, agents. Lifted from command-palette.tsx.
   ────────────────────────────────────────────────────────────── */
function CommandPalette({ open, onClose }) {
  const [q, setQ] = React.useState("");
  if (!open) return null;
  const sections = [
    { title: "Pipelines", items: [
      ["api · main",          I.gitBranch, "2148"],
      ["web · feat/auth-v2",  I.gitBranch, "2147"],
      ["worker · main",       I.gitBranch, "2146"],
    ] },
    { title: "Projects", items: [
      ["web-app",     I.frame, ""],
      ["api-service", I.frame, ""],
      ["mobile-app",  I.frame, ""],
    ] },
    { title: "Agents", items: [
      ["runner-04",   I.bot, "prod-eu"],
      ["runner-12",   I.bot, "prod-us"],
    ] },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "color-mix(in oklab, #000 60%, transparent)",
      display: "flex", justifyContent: "center", paddingTop: "12vh",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(620px, 92vw)", maxHeight: "70vh",
        background: "var(--bg)",
        border: "1px solid var(--border)", borderRadius: 14,
        boxShadow: "var(--shadow-elevated)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
        }}>
          <Icon d={I.search} size={16} className="muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, pipelines, agents…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              color: "var(--fg)", fontSize: 14, fontFamily: "var(--font-sans)",
            }}
          />
          <kbd style={{
            fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)",
            padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4,
          }}>esc</kbd>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 0" }}>
          {sections.map((sec) => (
            <div key={sec.title} style={{ padding: "8px 16px" }}>
              <div className="eyebrow" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 6 }}>{sec.title}</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {sec.items
                  .filter(([n]) => !q || n.toLowerCase().includes(q.toLowerCase()))
                  .map(([n, ico, meta]) => (
                  <li key={n}>
                    <button style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      height: 32, padding: "0 8px", borderRadius: 6,
                      background: "transparent", border: 0, color: "var(--fg)",
                      cursor: "pointer", fontSize: 13, fontFamily: "var(--font-sans)",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-elevated)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                      <Icon d={ico} size={14} className="muted" />
                      <span style={{ flex: 1 }}>{n}</span>
                      {meta && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{meta}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 16px", borderTop: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)",
        }}>
          <span>↑ ↓ navigate · ↵ open</span>
          <span>arcentra cmd · v0.4.0</span>
        </div>
      </div>
    </div>
  );
}

window.TopBar = TopBar;
window.CommandPalette = CommandPalette;
