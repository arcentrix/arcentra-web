/* Web app — Account page. Personal profile, security, sessions, preferences.
   Accessed from the Dock's user-menu dropdown, not from the primary AppDock. */

function Account() {
  const TABS = [
    { id: "profile",     label: "Profile",     icon: I.user },
    { id: "security",    label: "Security",    icon: I.shield },
    { id: "sessions",    label: "Sessions",    icon: I.serverCog },
    { id: "preferences", label: "Preferences", icon: I.settings },
    { id: "tokens",      label: "API tokens",  icon: I.copy },
  ];
  const [section, setSection] = React.useState("profile");

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="account / personal"
        title="Account"
        sub="Your profile, security and personal preferences — separate from workspace settings."
      />

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
        {/* Sidebar */}
        <div>
          {/* Identity card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: 14, marginBottom: 14,
            borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)",
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 9999,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
            }}>EC</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Evelyn Chen</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-subtle)" }}>e.chen · Admin</div>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TABS.map((t) => {
              const active = t.id === section;
              return (
                <button key={t.id} onClick={() => setSection(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  height: 34, padding: "0 10px", borderRadius: 6,
                  background: active ? "var(--bg-elevated)" : "transparent",
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  border: 0, cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: active ? 500 : 400,
                  textAlign: "left",
                  boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
                }}>
                  <Icon d={t.icon} size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {section === "profile"     && <ProfileSection />}
          {section === "security"    && <SecuritySection />}
          {section === "sessions"    && <SessionsSection />}
          {section === "preferences" && <PreferencesSection />}
          {section === "tokens"      && <PersonalTokensSection />}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Profile ─────────────────────────── */

function ProfileSection() {
  return (
    <>
      <AccountCard title="Identity" sub="How you appear across the platform.">
        <div style={{
          display: "flex", alignItems: "center", gap: 20,
          padding: "14px 0", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <span style={{
              width: 64, height: 64, borderRadius: 9999,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600,
            }}>EC</span>
            <button style={{
              position: "absolute", right: -4, bottom: -4,
              width: 24, height: 24, borderRadius: 9999,
              border: "1px solid var(--border-strong)", background: "var(--bg)",
              color: "var(--fg)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }} aria-label="Upload avatar">
              <Icon d={I.plus} size={12} />
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              PNG or JPEG, square, 1MB max. Or use a Gravatar by email.
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm">Upload image</Button>
              <Button variant="ghost"   size="sm">Use Gravatar</Button>
              <Button variant="ghost"   size="sm" style={{ color: "var(--fg-muted)" }}>Remove</Button>
            </div>
          </div>
        </div>

        <FormRow label="Display name"   hint="Shown in audit logs, approvals and mentions.">
          <Input defaultValue="Evelyn Chen" />
        </FormRow>
        <FormRow label="Handle"          hint="Used in @mentions and the CLI.">
          <Input defaultValue="e.chen" mono prefix="@" />
        </FormRow>
        <FormRow label="Title"           hint="Optional. Visible to other workspace members.">
          <Input defaultValue="Platform engineering · Tech lead" />
        </FormRow>
        <FormRow label="Time zone"       hint="Notifications and schedules use this.">
          <Input defaultValue="Europe/Berlin (UTC+1)" mono />
        </FormRow>
        <FormRow label="Bio"             hint="Markdown allowed. Shown on your profile page.">
          <textarea defaultValue="Wrangling pipelines and agents across prod-eu and prod-us. Maintainer of the deploy/* workflows."
            rows={3}
            style={{
              width: "100%", maxWidth: 460,
              padding: "10px 12px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--fg)",
              fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55,
              outline: "none", resize: "vertical",
            }} />
        </FormRow>
      </AccountCard>

      <AccountCard title="Contact" sub="How Arcentra reaches you for approvals and security events.">
        <FormRow label="Primary email"
          hint="Verified. Used for login + critical security notifications.">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input defaultValue="e.chen@arcentra.io" mono />
            <Badge tone="success"><Icon d={I.check} size={10} />verified</Badge>
          </div>
        </FormRow>
        <FormRow label="Secondary email" hint="Personal backup for account recovery.">
          <Input placeholder="optional" />
        </FormRow>
        <FormRow label="Slack handle"    hint="Used to route on-call pages and approvals.">
          <Input defaultValue="@evelyn" mono />
        </FormRow>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── Security ─────────────────────────── */

function SecuritySection() {
  const [tfa, setTfa] = React.useState("totp");
  return (
    <>
      <AccountCard title="Password" sub="Last changed 47 days ago.">
        <FormRow label="Current password">
          <Input type="password" placeholder="•••••••••" />
        </FormRow>
        <FormRow label="New password" hint="Minimum 12 characters · 1 number · 1 symbol.">
          <Input type="password" />
        </FormRow>
        <FormRow label="Confirm new password">
          <Input type="password" />
        </FormRow>
        <div style={{ paddingTop: 10, display: "flex", gap: 8 }}>
          <Button variant="primary" size="sm">Update password</Button>
          <Button variant="ghost"   size="sm">Cancel</Button>
        </div>
      </AccountCard>

      <AccountCard title="Two-factor authentication"
        sub="Required for production approvals and secret rotation."
        action={<Badge tone="success">Enabled · TOTP</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["totp",        "Authenticator app",       "TOTP code from 1Password / Authy / Google Authenticator"],
            ["webauthn",    "Hardware key · WebAuthn", "YubiKey, Titan or platform passkey"],
            ["sms",         "SMS code",                "Backup only — phishable, not recommended"],
          ].map(([id, title, sub]) => {
            const active = id === tfa;
            return (
              <label key={id} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: 14, borderRadius: 8,
                border: active ? "1px solid var(--brand-signal-dim)" : "1px solid var(--border)",
                background: active ? "color-mix(in oklab, var(--brand-signal) 5%, transparent)" : "transparent",
                cursor: "pointer",
              }}>
                <input type="radio" name="tfa" checked={active} onChange={() => setTfa(id)}
                  style={{ marginTop: 3, accentColor: "var(--brand-signal)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3 }}>{sub}</div>
                </div>
                {active && <Button variant="outline" size="sm">Manage</Button>}
              </label>
            );
          })}
        </div>
      </AccountCard>

      <AccountCard title="Recovery codes" sub="Generate one-time codes for account recovery."
        action={<Button variant="outline" size="sm" leftIcon={<Icon d={I.refresh} size={13} />}>Regenerate</Button>}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
          fontFamily: "var(--font-mono)", fontSize: 13,
        }}>
          {["9F4A-2B71-D3CE", "4811-CC0A-7E29", "AAFD-2204-9182", "5733-EA8B-F0CC", "BC91-7240-EE3A", "0FA2-5B19-873D"].map((c) => (
            <div key={c} style={{
              padding: "8px 12px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              color: "var(--fg-muted)",
            }}>{c}</div>
          ))}
        </div>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── Sessions ─────────────────────────── */

function SessionsSection() {
  const sessions = [
    { device: "MacBook Pro · Berlin",   browser: "Arc · 1.78.0",     ip: "94.234.117.42",  current: true,  last: "now",       provider: "github" },
    { device: "iPhone 15 · Berlin",     browser: "Safari · iOS 17",  ip: "94.234.117.42",  current: false, last: "12m ago",   provider: "github" },
    { device: "Linux desktop · Tokyo",  browser: "Firefox · 124",    ip: "203.0.113.18",   current: false, last: "2 days ago",provider: "okta"   },
    { device: "iPad · Berlin",          browser: "Safari · iPadOS",  ip: "94.234.117.42",  current: false, last: "5 days ago",provider: "github" },
  ];
  return (
    <>
      <AccountCard title="Active sessions" sub={`${sessions.length} devices currently signed in.`}
        action={<Button variant="outline" size="sm" style={{ color: "var(--accent-danger)", borderColor: "color-mix(in oklab, var(--accent-danger) 40%, var(--border))" }}>Revoke all others</Button>}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--fg-muted)", textAlign: "left",
                         fontFamily: "var(--font-mono)", fontSize: 10.5,
                         textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <th style={th4}>Device</th>
              <th style={th4}>IP</th>
              <th style={th4}>Provider</th>
              <th style={th4}>Last seen</th>
              <th style={{ ...th4, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td4}>
                  <div style={{ fontWeight: 500 }}>{s.device}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{s.browser}</div>
                </td>
                <td style={{ ...td4, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{s.ip}</td>
                <td style={{ ...td4, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{s.provider}</td>
                <td style={{ ...td4, color: "var(--fg-muted)" }}>{s.last}</td>
                <td style={{ ...td4, textAlign: "right" }}>
                  {s.current
                    ? <Badge tone="success"><span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--accent-success)" }} />this device</Badge>
                    : <Button variant="ghost" size="sm" style={{ color: "var(--accent-danger)" }}>Revoke</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccountCard>

      <AccountCard title="Login history" sub="Last 5 sign-ins.">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {[
            ["now",            "94.234.117.42 · Berlin",   "ok",   "github"],
            ["12m ago",        "94.234.117.42 · Berlin",   "ok",   "github"],
            ["2 days ago",     "203.0.113.18 · Tokyo",     "info", "okta · approved"],
            ["5 days ago",     "94.234.117.42 · Berlin",   "ok",   "github"],
            ["12 days ago",    "172.16.4.9 · unknown",     "fail", "blocked · geo policy"],
          ].map(([when, where, status, note], i) => (
            <li key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)",
              fontSize: 13,
            }}>
              <StatusDot tone={status} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{where}</div>
                <div style={{ fontSize: 11.5, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{note}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{when}</span>
            </li>
          ))}
        </ul>
      </AccountCard>
    </>
  );
}

/* ─────────────────────────── Preferences ─────────────────────────── */

function PreferencesSection() {
  return (
    <>
      <AccountCard title="Appearance" sub="Visual preferences for this account.">
        <FormRow label="Theme" hint="Light, dark, or follow the system.">
          <SegmentedControl options={[
            { id: "dark", label: "Dark" },
            { id: "light", label: "Light" },
            { id: "system", label: "System" },
          ]} active="dark" />
        </FormRow>
        <FormRow label="Density" hint="Compact rows fit more data per screen.">
          <SegmentedControl options={[
            { id: "comfortable", label: "Comfortable" },
            { id: "compact",     label: "Compact" },
          ]} active="comfortable" />
        </FormRow>
        <FormRow label="Accent dot animation" hint="Pulsing dots on running pipelines.">
          <PrefToggle on={true} />
        </FormRow>
      </AccountCard>

      <AccountCard title="Notifications" sub="Personal channel · separate from workspace alerts.">
        <PrefRow title="Pipeline failures on projects I own"        sub="Slack DM + email"     on={true} />
        <PrefRow title="Approvals waiting on me"                     sub="Slack DM"             on={true} />
        <PrefRow title="@mentions in comments"                       sub="Slack DM"             on={true} />
        <PrefRow title="Weekly digest · pipelines & deploys"         sub="Email · Mon 9am"      on={true} />
        <PrefRow title="Security alerts on my workspace"             sub="Email + SMS"          on={true} />
        <PrefRow title="Product updates from Arcentra"               sub="Email · monthly"      on={false} />
      </AccountCard>

      <AccountCard title="Defaults" sub="Where the app sends you by default.">
        <FormRow label="Default workspace">
          <Input defaultValue="arcentra-internal" mono />
        </FormRow>
        <FormRow label="Default landing page" hint="Where ⌘1 takes you.">
          <Input defaultValue="/" mono />
        </FormRow>
        <FormRow label="Default time range" hint="For Observe charts.">
          <Input defaultValue="6h" mono />
        </FormRow>
      </AccountCard>
    </>
  );
}

function PrefRow({ title, sub, on }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{sub}</div>
      </div>
      <PrefToggle on={on} />
    </div>
  );
}

function PrefToggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={() => setOn(!on)} aria-pressed={on} style={{
      width: 36, height: 20, padding: 2, borderRadius: 9999,
      border: 0,
      background: on ? "var(--brand-signal)" : "var(--border-strong)",
      display: "inline-flex", alignItems: "center",
      cursor: "pointer",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 9999, background: "var(--bg)",
        transform: on ? "translateX(16px)" : "translateX(0)",
        transition: "transform 150ms var(--easing-out)",
      }} />
    </button>
  );
}

function SegmentedControl({ options, active: initial }) {
  const [active, setActive] = React.useState(initial);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      padding: 2, borderRadius: 8, border: "1px solid var(--border)",
      background: "var(--bg-elevated)",
    }}>
      {options.map((o) => {
        const isActive = o.id === active;
        return (
          <button key={o.id} onClick={() => setActive(o.id)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: 28, padding: "0 12px", borderRadius: 6,
            border: 0, cursor: "pointer",
            background: isActive ? "var(--bg)" : "transparent",
            color: isActive ? "var(--fg)" : "var(--fg-muted)",
            boxShadow: isActive ? "inset 0 0 0 1px var(--border-strong)" : "none",
            fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500,
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Personal API tokens ─────────────────────────── */

function PersonalTokensSection() {
  const tokens = [
    ["My CLI",              "wrk:read · pipe:run",   "32d ago",  "12d"],
    ["Local dev macbook",   "wrk:read",              "1d ago",   "47d"],
    ["github-actions · pr", "pipe:run · deploy:read","never",    "expired"],
  ];
  return (
    <AccountCard
      title="Personal API tokens"
      sub="Tokens scoped to your identity. Workspace-wide tokens live under Settings → API tokens."
      action={<Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>New token</Button>}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--fg-muted)", textAlign: "left",
                       fontFamily: "var(--font-mono)", fontSize: 10.5,
                       textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ ...th4, paddingLeft: 0 }}>Name</th>
            <th style={th4}>Scopes</th>
            <th style={th4}>Last used</th>
            <th style={{ ...th4, textAlign: "right", paddingRight: 0 }}>Expires</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t[0]} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td4, paddingLeft: 0, fontWeight: 500 }}>{t[0]}</td>
              <td style={{ ...td4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{t[1]}</td>
              <td style={{ ...td4, color: "var(--fg-muted)" }}>{t[2]}</td>
              <td style={{ ...td4, textAlign: "right", paddingRight: 0,
                          color: t[3] === "expired" ? "var(--accent-danger)" : "var(--fg-subtle)",
                          fontFamily: "var(--font-mono)" }}>{t[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AccountCard>
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */

function AccountCard({ title, sub, children, action }) {
  return (
    <Panel>
      <div style={{
        padding: "18px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <h3 className="display" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
          {sub && <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: "4px 0 0" }}>{sub}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </Panel>
  );
}

function FormRow({ label, hint, children }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr", gap: 24,
      padding: "14px 0", borderBottom: "1px solid var(--border)",
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Input({ defaultValue, type = "text", placeholder, mono, prefix }) {
  const baseStyle = {
    height: 34, padding: "0 12px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--fg)",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: 13, outline: "none",
  };
  if (prefix) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center",
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: 6, maxWidth: 360, width: "100%",
      }}>
        <span style={{
          paddingLeft: 12, paddingRight: 6,
          color: "var(--fg-subtle)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: 13,
        }}>{prefix}</span>
        <input type={type} defaultValue={defaultValue} placeholder={placeholder} style={{ ...baseStyle, border: 0, background: "transparent", padding: "0 12px 0 0", flex: 1, height: 32 }} />
      </div>
    );
  }
  return (
    <input type={type} defaultValue={defaultValue} placeholder={placeholder}
      style={{ ...baseStyle, width: "100%", maxWidth: 360 }} />
  );
}

const th4 = { padding: "10px 16px", fontWeight: 500 };
const td4 = { padding: "12px 16px", verticalAlign: "middle" };

window.Account = Account;
