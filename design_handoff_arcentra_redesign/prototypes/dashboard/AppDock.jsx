/* Web app — fixed-left AppDock with hover-to-expand behavior.
   Faithful to arcentra-web/src/components/app-dock.tsx. */

const PRIMARY = [
  { label: "Overview", url: "/",         icon: I.layoutDash, exact: true },
  { label: "Projects", url: "/projects", icon: I.frame },
  { label: "Build",    url: "/build",    icon: I.hammer },
  { label: "Deploy",   url: "/deploy",   icon: I.rocket },
  { label: "Agents",   url: "/agents",   icon: I.bot },
  { label: "Copilot",  url: "/chat",     icon: I.brain },
  { label: "Observe",  url: "/observe",  icon: I.activity },
  { label: "Secure",   url: "/secure",   icon: I.shield },
  { label: "Settings", url: "/settings", icon: I.settings },
];

const SECONDARY = [
  { label: "Document", icon: I.helpCircle },
  { label: "Discord",  icon: I.message },
  { label: "GitHub",   icon: I.github },
];

function AppDock({ active = "/", onNavigate, onOpenPalette, onOpenAccount, onSignOut }) {
  const [expanded, setExpanded] = React.useState(false);
  const timer = React.useRef(null);
  const PEEK = 300;

  const handleEnter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setExpanded(true), PEEK);
  };
  const handleLeave = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setExpanded(false);
  };

  return (
    <nav
      aria-label="Primary"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        position: "fixed",
        top: 0, bottom: 0, left: 0, zIndex: 30,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border)",
        background: "var(--bg)",
        paddingBottom: 8,
        width: expanded ? 180 : 56,
        transition: "width 200ms var(--easing-out)",
        boxShadow: expanded ? "var(--shadow-overlay)" : "none",
      }}>
      <div style={{ display: "flex", alignItems: "center", height: 48, padding: "0 4px" }}>
        <DockButton
          label="Arcentra"
          icon={I.panelLeft}
          expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        />
      </div>
      <div style={{ margin: "0 8px", height: 1, background: "var(--border)", opacity: 0.6 }} />

      <div style={{ padding: "8px 4px 0" }}>
        <DockButton
          label="Search"
          icon={I.search}
          expanded={expanded}
          onClick={onOpenPalette}
          hint={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, color: "var(--fg-subtle)" }}>
              <kbd style={kbdStyle}>⌘</kbd><kbd style={kbdStyle}>K</kbd>
            </span>
          }
        />
      </div>

      <ul style={{ listStyle: "none", margin: 0, marginTop: 4, padding: "0 4px", display: "flex", flexDirection: "column", gap: 2 }}>
        {PRIMARY.map((item) => {
          const isActive = item.exact ? active === item.url : active === item.url || active.startsWith(item.url + "/");
          return (
            <li key={item.url}>
              <DockButton
                label={item.label}
                icon={item.icon}
                active={isActive}
                expanded={expanded}
                onClick={() => onNavigate?.(item.url)}
              />
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: "auto", padding: "0 4px", display: "flex", flexDirection: "column", gap: 2 }}>
        {SECONDARY.map((s) => (
          <DockButton key={s.label} label={s.label} icon={s.icon} expanded={expanded} />
        ))}
        <DockUser expanded={expanded} onOpenAccount={onOpenAccount} onSignOut={onSignOut} />
      </div>
    </nav>
  );
}

const kbdStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 14, height: 14, padding: "0 3px",
  borderRadius: 3, border: "1px solid var(--border)", background: "var(--bg)",
  fontFamily: "var(--font-mono)", fontSize: 10,
};

function DockButton({ label, icon, active, expanded, onClick, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 10,
        height: 34, width: "100%",
        overflow: "hidden", whiteSpace: "nowrap",
        borderRadius: 6,
        paddingLeft: 16, paddingRight: 10,
        background: "transparent",
        border: 0, cursor: "pointer",
        fontSize: 12.5, fontFamily: "var(--font-sans)",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        transition: "color var(--duration-2), background-color var(--duration-2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--fg)";
        e.currentTarget.style.backgroundColor = "color-mix(in oklab, var(--bg-elevated) 60%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = active ? "var(--fg)" : "var(--fg-muted)";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {active && (
        <span aria-hidden="true" style={{
          position: "absolute", left: 0, top: "50%",
          transform: "translateY(-50%)",
          width: 2, height: 18, borderRadius: "0 9999px 9999px 0",
          background: "var(--brand-signal)",
          boxShadow: "0 0 6px color-mix(in oklab, var(--brand-signal) 50%, transparent)",
        }} />
      )}
      <Icon d={icon} size={16} />
      <span style={{
        minWidth: 0, flex: 1, textAlign: "left",
        overflow: "hidden", textOverflow: "ellipsis",
        opacity: expanded ? 1 : 0,
        transition: "opacity 150ms 75ms",
      }}>{label}</span>
      {hint && expanded && hint}
    </button>
  );
}

function DockUser({ expanded, onOpenAccount, onSignOut }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%",
          height: 44, padding: "0 12px",
          marginTop: 4,
          borderRadius: 6, border: 0, cursor: "pointer",
          background: open ? "color-mix(in oklab, var(--bg-elevated) 60%, transparent)" : "transparent",
          color: "var(--fg)", textAlign: "left",
          fontFamily: "var(--font-sans)",
        }}>
        <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 9999,
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600,
          }}>EC</span>
          <span style={{
            position: "absolute", right: -1, bottom: -1,
            width: 8, height: 8, borderRadius: 9999,
            background: "var(--accent-success)",
            outline: "2px solid var(--bg)",
          }} />
        </span>
        <div style={{
          minWidth: 0, flex: 1,
          opacity: expanded ? 1 : 0,
          transition: "opacity 150ms 75ms",
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.2 }}>e.chen</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)", lineHeight: 1.2 }}>Admin · arcentra</div>
        </div>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          left: expanded ? "calc(100% - 8px)" : "calc(100% + 6px)",
          bottom: 0,
          width: 240,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "var(--shadow-overlay)",
          padding: 6,
          zIndex: 40,
        }}>
          {/* Identity block */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 10px 12px",
            borderBottom: "1px solid var(--border)",
            marginBottom: 4,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 9999,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
            }}>EC</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Evelyn Chen</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>e.chen@arcentra.io</div>
            </div>
          </div>

          {/* Workspace switcher */}
          <div style={{ padding: "2px 10px 6px" }}>
            <div className="eyebrow" style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 4,
            }}>Workspace</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 6px", borderRadius: 5,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 12,
            }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--brand-signal)", opacity: 0.85, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--bg)", fontWeight: 700, fontSize: 9 }}>A</span>
              <span style={{ flex: 1 }}>arcentra-internal</span>
              <Icon d={I.chevronRight} size={12} style={{ transform: "rotate(90deg)", color: "var(--fg-subtle)" }} />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 6px" }} />

          {/* Menu items */}
          <MenuItem icon={I.user}     label="Account"            onClick={() => { setOpen(false); onOpenAccount?.(); }} />
          <MenuItem icon={I.settings} label="Preferences"        onClick={() => { setOpen(false); onOpenAccount?.(); }} hint="⌘ ," />
          <MenuItem icon={I.copy}     label="API tokens"         onClick={() => { setOpen(false); onOpenAccount?.(); }} />
          <MenuItem icon={I.message}  label="Invite teammates"   onClick={() => setOpen(false)} />

          <div style={{ height: 1, background: "var(--border)", margin: "4px 6px" }} />

          <MenuItem icon={I.helpCircle} label="Help & docs"       onClick={() => setOpen(false)} />
          <MenuItem icon={I.arrowUpRight} label="What's new"      onClick={() => setOpen(false)} hint="v0.4.0" />

          <div style={{ height: 1, background: "var(--border)", margin: "4px 6px" }} />

          <MenuItem icon={I.arrowRight} label="Sign out"
                    onClick={() => { setOpen(false); onSignOut?.(); }}
                    tone="danger" />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick, tone }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "7px 10px",
      borderRadius: 5, border: 0, background: "transparent",
      color: tone === "danger" ? "var(--accent-danger)" : "var(--fg)",
      fontFamily: "var(--font-sans)", fontSize: 12.5,
      cursor: "pointer", textAlign: "left",
    }}
    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-elevated)"}
    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
      <Icon d={icon} size={13} style={{ opacity: 0.85 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>{hint}</span>}
    </button>
  );
}

window.AppDock = AppDock;
