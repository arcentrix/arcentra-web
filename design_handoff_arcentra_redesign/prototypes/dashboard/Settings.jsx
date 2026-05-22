/* Web app — Settings page. Sectioned: General, Notifications, System.
   Adapted from arcentra-web/src/pages/Settings + GeneralSettings. */

function Settings() {
  const [section, setSection] = React.useState("general");

  const sections = [
    { id: "general",       label: "General",       icon: I.settings },
    { id: "notifications", label: "Notifications", icon: I.bell },
    { id: "identity",      label: "Identity",      icon: I.user },
    { id: "system",        label: "System info",   icon: I.serverCog },
    { id: "api",           label: "API tokens",    icon: I.copy },
  ];

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="settings"
        title="Settings"
        sub="Workspace configuration, integrations, identity providers and system info."
      />

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>
        {/* Sidebar nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map((s) => {
            const active = s.id === section;
            return (
              <button key={s.id} onClick={() => setSection(s.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                height: 34, padding: "0 10px", borderRadius: 6,
                background: active ? "var(--bg-elevated)" : "transparent",
                color: active ? "var(--fg)" : "var(--fg-muted)",
                border: 0, cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: active ? 500 : 400,
                textAlign: "left",
                boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
              }}>
                <Icon d={s.icon} size={14} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Section body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {section === "general"       && <GeneralSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "identity"      && <IdentitySection />}
          {section === "system"        && <SystemSection />}
          {section === "api"           && <ApiTokensSection />}
        </div>
      </div>
    </section>
  );
}

function SettingsCard({ title, sub, children, action }) {
  return (
    <Panel>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, padding: "14px 0",
                  borderBottom: "1px solid var(--border)", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TextInput({ defaultValue, mono, placeholder }) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      style={{
        height: 34, padding: "0 12px", width: "100%", maxWidth: 360,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: 6, color: "var(--fg)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: 13, outline: "none",
      }}
    />
  );
}

function Toggle({ on }) {
  const [v, setV] = React.useState(on);
  return (
    <button onClick={() => setV(!v)} aria-pressed={v} style={{
      width: 36, height: 20, padding: 2, borderRadius: 9999,
      border: 0,
      background: v ? "var(--brand-signal)" : "var(--border-strong)",
      display: "inline-flex", alignItems: "center",
      cursor: "pointer",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 9999, background: "var(--bg)",
        transform: v ? "translateX(16px)" : "translateX(0)",
        transition: "transform 150ms var(--easing-out)",
      }} />
    </button>
  );
}

function GeneralSection() {
  return (
    <>
      <SettingsCard title="Workspace" sub="Identity used across runs, audit logs and approvals.">
        <FormRow label="Name"        hint="Displayed in the UI and audit log."><TextInput defaultValue="Arcentra · Internal" /></FormRow>
        <FormRow label="Handle"      hint="Used in URLs and CLI commands."><TextInput defaultValue="arcentra-internal" mono /></FormRow>
        <FormRow label="Default branch"><TextInput defaultValue="main" mono /></FormRow>
        <FormRow label="Time zone"   hint="All logs and schedules are stored in UTC."><TextInput defaultValue="UTC" mono /></FormRow>
      </SettingsCard>

      <SettingsCard title="Pipeline defaults" sub="Applied to every newly-created pipeline.">
        <FormRow label="Timeout"          hint="Hard cap for any single pipeline run."><TextInput defaultValue="60m" mono /></FormRow>
        <FormRow label="Concurrency"      hint="Max parallel runs per pipeline."><TextInput defaultValue="4" mono /></FormRow>
        <FormRow label="Auto-cancel push" hint="Cancel in-flight runs on new pushes."><Toggle on={true} /></FormRow>
        <FormRow label="Require approval" hint="Production deploys need 2 reviewers."><Toggle on={true} /></FormRow>
      </SettingsCard>

      <SettingsCard title="Danger zone" sub="Destructive actions on the workspace.">
        <FormRow label="Archive workspace" hint="Read-only for everyone; data retained."><Button variant="outline" size="sm">Archive</Button></FormRow>
        <FormRow label="Delete workspace"  hint="Irreversible. All runs and logs are removed."><Button variant="outline" size="sm" style={{ color: "var(--accent-danger)", borderColor: "color-mix(in oklab, var(--accent-danger) 50%, var(--border))" }}>Delete</Button></FormRow>
      </SettingsCard>
    </>
  );
}

function NotificationsSection() {
  const channels = [
    ["Slack",   "#deploys · #ops",        true],
    ["Email",   "ops@arcentra.io",        true],
    ["Webhook", "https://hooks.…/incident", false],
    ["PagerDuty", "production-rotation",  true],
  ];
  return (
    <SettingsCard title="Channels" sub="Where Arcentra sends events.">
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {channels.map((c, i) => (
          <li key={c[0]} style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "14px 0", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon d={I.message} size={13} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c[0]}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-subtle)" }}>{c[1]}</div>
            </div>
            <Toggle on={c[2]} />
            <Button variant="ghost" size="sm">Edit</Button>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function IdentitySection() {
  return (
    <SettingsCard title="Identity providers" sub="Linked from `Secure` page; manage priority here.">
      <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
        Provider configuration is managed under <a href="#" style={{ color: "var(--brand-signal)" }}>Secure / Identity</a> —
        this section is reserved for fallback rules and provisioning policy.
      </p>
    </SettingsCard>
  );
}

function SystemSection() {
  return (
    <>
      <SettingsCard title="Control plane" sub="Running build and health.">
        <FormRow label="Version">             <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>v0.4.0</span></FormRow>
        <FormRow label="Commit">              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)" }}>89efb90 · 4d ago</span></FormRow>
        <FormRow label="Uptime">              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>14d 8h 22m</span></FormRow>
        <FormRow label="Database"             hint="postgres 16.3 · 4 connections live"><span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-success)" }}>healthy</span></FormRow>
        <FormRow label="Object storage"       hint="s3 · 14gb used"><span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-success)" }}>healthy</span></FormRow>
      </SettingsCard>

      <SettingsCard title="Telemetry" sub="Anonymous usage reporting back to the Arcentra project.">
        <FormRow label="Send telemetry" hint="No PII, no commit content. See docs."><Toggle on={true} /></FormRow>
        <FormRow label="Crash reports"  hint="Stacktraces only, no env values."><Toggle on={true} /></FormRow>
      </SettingsCard>
    </>
  );
}

function ApiTokensSection() {
  const tokens = [
    ["CI pipeline",    "ci-bot",      "wrk:read · pipe:run",   "v2.4.0 deploy",  "32d ago"],
    ["Personal · readonly", "e.chen", "wrk:read",               "—",              "12d ago"],
    ["Terraform",      "platform",    "wrk:write · agent:reg",  "infra release",  "84d ago"],
  ];
  return (
    <SettingsCard
      title="API tokens"
      sub="Used by CLI, CI bots, and external integrations."
      action={<Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>New token</Button>}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--fg-muted)", textAlign: "left",
                       fontFamily: "var(--font-mono)", fontSize: 10.5,
                       textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ ...th2, paddingLeft: 0 }}>Name</th>
            <th style={th2}>Owner</th>
            <th style={th2}>Scopes</th>
            <th style={th2}>Last used</th>
            <th style={{ ...th2, textAlign: "right", paddingRight: 0 }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr key={t[0]} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td2, paddingLeft: 0, fontWeight: 500 }}>{t[0]}</td>
              <td style={td2}>{t[1]}</td>
              <td style={{ ...td2, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{t[2]}</td>
              <td style={{ ...td2, color: "var(--fg-muted)" }}>{t[3]}</td>
              <td style={{ ...td2, textAlign: "right", paddingRight: 0, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>{t[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  );
}
const th2 = { padding: "10px 12px", fontWeight: 500 };
const td2 = { padding: "12px 12px" };

window.Settings = Settings;
