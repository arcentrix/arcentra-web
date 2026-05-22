/* Marketing site — sticky header with logo, nav, CTAs */

const NAV = [
  { label: "Product", href: "#product" },
  { label: "Docs", href: "#", external: true },
  { label: "Pricing", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Community", href: "#" },
];

function Header() {
  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      width: "100%",
      borderBottom: "1px solid var(--border)",
      background: "color-mix(in oklab, var(--bg) 85%, transparent)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      <div style={{
        maxWidth: 1152,
        margin: "0 auto",
        height: 56,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        <LogoLockup size={20} />

        <nav style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginLeft: 16 }}>
          {NAV.map((item) => (
            <a key={item.label} href={item.href} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 10px", borderRadius: 6,
              color: "var(--fg-muted)",
              textDecoration: "none",
              transition: "color var(--duration-2), background-color var(--duration-2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--fg)";
              e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--fg-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}>
              {item.label}
              {item.external && <Icon d={I.arrowUpRight} size={12} className="opacity-60" />}
            </a>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* GitHub stars — mono-styled, signal accent on count */}
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 30, padding: "0 4px 0 10px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--fg-muted)", fontSize: 12, textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}>
            <Icon d={I.github} size={13} />
            <span>arcentrix/arcentra</span>
            <span style={{
              padding: "2px 7px", borderRadius: 5,
              background: "var(--bg)",
              color: "var(--brand-signal)",
              fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-mono)",
              border: "1px solid var(--brand-signal-dim)",
            }}>★ 1.4k</span>
          </a>
          {/* Theme toggle */}
          <ThemeToggle />
          <Button variant="secondary" size="sm">Docs</Button>
          <Button variant="primary" size="sm" rightIcon={<Icon d={I.arrowRight} size={13} />}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}

window.Header = Header;

function ThemeToggle() {
  const [light, setLight] = React.useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light")
  );
  const toggle = () => {
    const next = !light;
    document.documentElement.classList.toggle("light", next);
    setLight(next);
  };
  const SUN  = ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"];
  const MOON = "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--fg-muted)", cursor: "pointer",
      }}>
      <Icon d={light ? MOON : SUN} size={14} stroke={1.7} />
    </button>
  );
}
