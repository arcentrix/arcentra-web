/* Marketing site footer — 5-column nav with operational status indicator */

const FOOTER = [
  { title: "Product", items: ["Overview", "Use cases", "Architecture", "Open source"] },
  { title: "Docs",    items: ["Getting started", "Documentation", "Concepts", "Architecture"] },
  { title: "Community", items: ["GitHub", "Discussions", "Issues", "Discord"] },
  { title: "Resources", items: ["Pricing", "Blog", "Changelog", "Roadmap", "Contribute"] },
  { title: "Legal", items: ["Privacy Policy", "Terms of Service"] },
];

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{
        maxWidth: 1152, margin: "0 auto",
        padding: "56px 24px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 3fr",
          gap: 48,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LogoLockup size={20} />
            <p style={{
              fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: "20rem",
            }}>
              Open-source control plane for CI/CD and agent-native delivery.
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: 11,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--fg-subtle)",
            }}>
              <span className="pulse-dot" style={{
                width: 6, height: 6, borderRadius: 9999,
                background: "color-mix(in oklab, var(--accent-success) 80%, transparent)",
              }} />
              All systems operational
            </div>
          </div>

          <nav style={{
            display: "grid",
            gap: 32,
            gridTemplateColumns: "repeat(5, 1fr)",
          }}>
            {FOOTER.map((col) => (
              <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="eyebrow" style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: "var(--fg-subtle)",
                }}>{col.title}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.items.map((item) => (
                    <li key={item}>
                      <a href="#" style={{
                        fontSize: 14, color: "var(--fg-muted)",
                        textDecoration: "none",
                      }}>{item}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div style={{
          marginTop: 48, paddingTop: 24,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--fg-subtle)",
        }}>
          <p>© {new Date().getFullYear()} Arcentra. Open-source first.</p>
          <p>Built in the open · Self-hosted · Cloud-native</p>
        </div>
      </div>
    </footer>
  );
}

window.Footer = Footer;
