/* Web app — Secure page. Tabbed: Overview / Users / Roles / Identity / Secrets / Audit.
   Mirrors arcentra-web/src/pages/Secure/* (5 sub-tabs) plus the standalone
   /users and /roles surfaces from the same codebase. */

function Secure() {
  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "users",    label: "Users",    count: 91 },
    { id: "roles",    label: "Roles",    count: 6 },
    { id: "identity", label: "Identity", count: 3 },
    { id: "secrets",  label: "Secrets",  count: 184 },
    { id: "audit",    label: "Audit" },
  ];
  const [tab, setTab] = React.useState("overview");

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="secure / access control"
        title="Secure"
        sub="Users, roles, identity providers, secrets, policies and audit trail."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.shield} size={14} />}>Policies</Button>
            <SecureCTA tab={tab} />
          </div>
        }
      />

      {/* Tab strip */}
      <div role="tablist" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)",
        padding: 4, alignSelf: "flex-start",
      }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 30, padding: "0 12px", borderRadius: 6,
              background: active ? "var(--bg)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              boxShadow: active ? "inset 0 0 0 1px var(--border-strong)" : "none",
              border: 0, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            }}>
              {t.label}
              {typeof t.count === "number" && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: active ? "var(--fg-muted)" : "var(--fg-subtle)",
                  fontVariantNumeric: "tabular-nums",
                }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <SecureOverview />}
      {tab === "users"    && <SecureUsers />}
      {tab === "roles"    && <SecureRoles />}
      {tab === "identity" && <SecureIdentity />}
      {tab === "secrets"  && <SecureSecrets />}
      {tab === "audit"    && <SecureAudit />}
    </section>
  );
}

function SecureCTA({ tab }) {
  if (tab === "users")  return <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>Invite user</Button>;
  if (tab === "roles")  return <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>New role</Button>;
  if (tab === "secrets")return <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>New secret</Button>;
  if (tab === "identity") return <Button variant="primary" size="md" leftIcon={<Icon d={I.plus} size={14} />}>Add provider</Button>;
  return null;
}

/* ─────────────────────────── Overview ─────────────────────────── */

function SecureOverview() {
  const stats = [
    ["Users",                "91",  ["91 active · ", "0 locked"]],
    ["Roles",                "6",   "3 built-in · 3 custom"],
    ["Identity providers",   "3",   "active · 1 disabled"],
    ["Active secrets",       "184", "across 12 workspaces"],
    ["Policy checks (24h)",  "1.2k",["1.2k · ", "0 violations"]],
    ["Audit events (24h)",   "412", "across all surfaces"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {stats.map(([label, value, sub]) => (
        <Panel key={label} style={{ padding: 18 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--fg-subtle)" }}>{label}</div>
          <div className="reading" style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)",
                letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{value}</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6 }}>
            {Array.isArray(sub) ? (
              <span>{sub[0]}<span style={{ color: "var(--accent-success)" }}>{sub[1]}</span></span>
            ) : sub}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ─────────────────────────── Users ─────────────────────────── */

function SecureUsers() {
  const users = [
    { handle: "e.chen",          name: "Evelyn Chen",         email: "e.chen@arcentra.io",     role: "Admin",      provider: "github", status: "ok",    lastSeen: "1m ago" },
    { handle: "mark.weber",      name: "Mark Weber",          email: "mark@arcentra.io",       role: "Maintainer", provider: "github", status: "ok",    lastSeen: "12m ago" },
    { handle: "j.park",          name: "Jihoon Park",         email: "j.park@arcentra.io",     role: "Maintainer", provider: "okta",   status: "ok",    lastSeen: "1h ago" },
    { handle: "alex.morales",    name: "Alex Morales",        email: "alex@arcentra.io",       role: "Developer",  provider: "github", status: "ok",    lastSeen: "3h ago" },
    { handle: "sara.li",         name: "Sara Li",             email: "sara@arcentra.io",       role: "Developer",  provider: "google", status: "ok",    lastSeen: "yesterday" },
    { handle: "deploy-bot",      name: "Deploy Bot",          email: "—",                      role: "Service",    provider: "token",  status: "ok",    lastSeen: "now" },
    { handle: "release-bot",     name: "Release Bot",         email: "—",                      role: "Service",    provider: "token",  status: "ok",    lastSeen: "12m ago" },
    { handle: "contractor-114",  name: "Contractor · S. Vo",  email: "svo+ext@example.com",    role: "Viewer",     provider: "magic",  status: "warn",  lastSeen: "expires 4d" },
    { handle: "ml.intern",       name: "Riku Tanaka",         email: "riku@arcentra.io",       role: "Developer",  provider: "google", status: "muted", lastSeen: "30d ago" },
  ];
  const [q, setQ] = React.useState("");
  const filtered = users.filter((u) => !q || u.handle.includes(q) || u.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel>
      <div style={{ padding: 14, borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          height: 32, padding: "0 12px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--bg-elevated)",
          flex: 1, maxWidth: 320,
        }}>
          <Icon d={I.search} size={13} className="muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              color: "var(--fg)", fontFamily: "var(--font-sans)", fontSize: 12.5,
            }} />
        </div>
        <FilterChip label="All"        count={users.length} active />
        <FilterChip label="Admins"     count={1} />
        <FilterChip label="Services"   count={2} />
        <FilterChip label="External"   count={1} tone="warn" />
        <FilterChip label="Inactive"   count={1} tone="muted" />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th3}>User</th>
            <th style={th3}>Email</th>
            <th style={th3}>Role</th>
            <th style={th3}>Provider</th>
            <th style={th3}>Last seen</th>
            <th style={{ ...th3, textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.handle} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td3}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar handle={u.handle} status={u.status} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{u.handle}</div>
                  </div>
                </div>
              </td>
              <td style={{ ...td3, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.email}</td>
              <td style={td3}><RoleChip role={u.role} /></td>
              <td style={{ ...td3, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.provider}</td>
              <td style={{ ...td3, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.lastSeen}</td>
              <td style={{ ...td3, textAlign: "right" }}>
                {u.status === "ok"    && <Badge tone="success">Active</Badge>}
                {u.status === "warn"  && <Badge tone="warn">Pending</Badge>}
                {u.status === "muted" && <Badge variant="outline">Inactive</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Avatar({ handle, status }) {
  const initials = handle.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <span style={{
        width: 28, height: 28, borderRadius: 9999,
        border: "1px solid var(--border)", background: "var(--bg-elevated)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600,
        color: "var(--fg-muted)",
      }}>{initials}</span>
      <span style={{
        position: "absolute", right: -2, bottom: -2,
        width: 8, height: 8, borderRadius: 9999,
        background: status === "ok" ? "var(--accent-success)" : status === "warn" ? "var(--accent-warn)" : "var(--fg-subtle)",
        outline: "2px solid var(--bg)",
      }} />
    </span>
  );
}

function RoleChip({ role }) {
  const tones = {
    Admin:      ["var(--brand-signal)",      "var(--brand-signal-dim)",       "color-mix(in oklab, var(--brand-signal) 10%, transparent)"],
    Maintainer: ["var(--fg)",                "var(--border-strong)",          "var(--bg-elevated)"],
    Developer:  ["var(--fg-muted)",          "var(--border)",                 "transparent"],
    Service:    ["var(--accent-warn)",       "color-mix(in oklab, var(--accent-warn) 40%, transparent)", "color-mix(in oklab, var(--accent-warn) 8%, transparent)"],
    Viewer:     ["var(--fg-subtle)",         "var(--border)",                 "transparent"],
  }[role] || ["var(--fg-muted)", "var(--border)", "transparent"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      height: 22, padding: "0 8px", borderRadius: 4,
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      color: tones[0], border: `1px solid ${tones[1]}`, background: tones[2],
    }}>{role}</span>
  );
}

function FilterChip({ label, count, active, tone }) {
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 30, padding: "0 10px", borderRadius: 6,
      border: active ? "1px solid var(--border-strong)" : "1px solid var(--border)",
      background: active ? "var(--bg)" : "transparent",
      color: active ? "var(--fg)" : "var(--fg-muted)",
      fontSize: 12.5, fontWeight: 500, fontFamily: "var(--font-sans)",
      cursor: "pointer",
    }}>
      {tone && <StatusDot tone={tone === "warn" ? "warn" : "muted"} />}
      {label}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

/* ─────────────────────────── Roles ─────────────────────────── */

function SecureRoles() {
  // RBAC matrix — permissions × roles.
  const perms = [
    { group: "Workspace",
      rows: [["workspace:read", "View workspace"], ["workspace:write", "Edit workspace settings"]] },
    { group: "Pipelines",
      rows: [["pipeline:read","View pipelines & runs"], ["pipeline:run","Trigger pipelines"], ["pipeline:write","Create / edit pipelines"]] },
    { group: "Deploy",
      rows: [["deploy:read", "View environments"], ["deploy:approve","Approve releases"], ["deploy:rollback","Rollback releases"]] },
    { group: "Agents",
      rows: [["agent:read","View agents"], ["agent:register","Register / drain agents"]] },
    { group: "Secrets",
      rows: [["secret:read","Read secret metadata"], ["secret:write","Write secret values"], ["secret:rotate","Rotate secrets"]] },
    { group: "Access",
      rows: [["user:invite","Invite users"], ["role:write","Manage roles"], ["audit:read","Read audit log"]] },
  ];
  const roles = ["Admin", "Maintainer", "Developer", "Viewer", "Service"];
  const matrix = {
    Admin:      "all",
    Maintainer: ["workspace:read","pipeline:read","pipeline:run","pipeline:write","deploy:read","deploy:approve","deploy:rollback","agent:read","agent:register","secret:read","secret:rotate","audit:read"],
    Developer:  ["workspace:read","pipeline:read","pipeline:run","pipeline:write","deploy:read","agent:read","secret:read"],
    Viewer:     ["workspace:read","pipeline:read","deploy:read","agent:read","audit:read"],
    Service:    ["pipeline:read","pipeline:run","deploy:read","agent:read","secret:read"],
  };
  const allows = (role, key) => matrix[role] === "all" || (matrix[role] || []).includes(key);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
      {/* Role list */}
      <Panel>
        <PanelHeader title="Roles" sub={`${roles.length} configured · 3 built-in`} />
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {roles.map((r, i) => (
            <li key={r} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
              cursor: "pointer",
            }}>
              <RoleChip role={r} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }}>
                  {r === "Admin"      ? "all permissions"
                  : r === "Maintainer" ? "12 of 16"
                  : r === "Developer"  ? "7 of 16"
                  : r === "Viewer"     ? "5 of 16"
                  : "5 of 16"}
                </div>
              </div>
              <Icon d={I.chevronRight} size={13} className="muted" />
            </li>
          ))}
        </ul>
      </Panel>

      {/* Permission matrix */}
      <Panel>
        <PanelHeader
          title="Permissions"
          sub="Built-in roles are read-only; create custom roles to override."
          action={<Button variant="outline" size="sm" leftIcon={<Icon d={I.plus} size={13} />}>Add permission</Button>}
        />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={tableHeadRow}>
              <th style={{ ...th3, width: "40%" }}>Permission</th>
              {roles.map((r) => (
                <th key={r} style={{ ...th3, textAlign: "center" }}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms.map((g) => (
              <React.Fragment key={g.group}>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td colSpan={roles.length + 1} style={{
                    padding: "8px 16px",
                    background: "var(--bg-elevated)",
                    fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em",
                    textTransform: "uppercase", color: "var(--fg-subtle)",
                  }}>{g.group}</td>
                </tr>
                {g.rows.map(([key, label]) => (
                  <tr key={key} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td3}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)" }}>{key}</div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-subtle)", marginTop: 1 }}>{label}</div>
                    </td>
                    {roles.map((r) => (
                      <td key={r} style={{ ...td3, textAlign: "center" }}>
                        {allows(r, key)
                          ? <Icon d={I.check} size={14} style={{ color: "var(--accent-success)", margin: "0 auto", verticalAlign: "middle" }} />
                          : <span style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── Identity ─────────────────────────── */

function SecureIdentity() {
  const providers = [
    { name: "github", type: "oauth", users: 47, status: "ok",    priority: 1, since: "Jan 2025" },
    { name: "google", type: "oidc",  users: 28, status: "ok",    priority: 2, since: "Mar 2025" },
    { name: "okta",   type: "ldap",  users: 12, status: "ok",    priority: 3, since: "May 2025" },
    { name: "magic",  type: "email", users: 4,  status: "muted", priority: 4, since: "—" },
  ];
  return (
    <Panel>
      <PanelHeader title="Identity providers" sub={`${providers.length} configured · drag to reorder priority`} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th3}>Provider</th>
            <th style={th3}>Type</th>
            <th style={th3}>Users</th>
            <th style={th3}>Priority</th>
            <th style={th3}>Since</th>
            <th style={{ ...th3, textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.name} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td3}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon d={p.name === "github" ? I.github : p.name === "okta" ? I.shield : p.name === "google" ? I.user : I.message}
                        size={14} className="muted" />
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                </div>
              </td>
              <td style={{ ...td3, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.type}</td>
              <td style={{ ...td3, fontFamily: "var(--font-mono)" }}>{p.users}</td>
              <td style={{ ...td3, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.priority}</td>
              <td style={{ ...td3, color: "var(--fg-muted)" }}>{p.since}</td>
              <td style={{ ...td3, textAlign: "right" }}>
                {p.status === "ok"
                  ? <Badge tone="success">Active</Badge>
                  : <Badge variant="outline">Disabled</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────────────────────── Secrets ─────────────────────────── */

function SecureSecrets() {
  const secrets = [
    ["DATABASE_URL",      "postgres credentials",  "production · staging", "vault",      "32d ago"],
    ["GITHUB_APP_KEY",    "GitHub webhook signing","all workspaces",       "vault",      "84d ago"],
    ["STRIPE_SECRET",     "Stripe API · live",     "production",           "vault",      "12d ago"],
    ["HONEYCOMB_API_KEY", "Observability ingest",  "all workspaces",       "vault",      "—"],
    ["OPENAI_API_KEY",    "ML inference fallback", "ml-platform",          "vault",      "3d ago"],
    ["S3_BACKUP_CREDS",   "Off-site backups",      "infrastructure",       "vault",      "47d ago"],
    ["CLOUDFLARE_API",    "DNS automation",        "infrastructure",       "kubernetes", "8d ago"],
  ];
  return (
    <Panel>
      <PanelHeader title="Secrets" sub={`${secrets.length} keys · vault + k8s-backed`} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={tableHeadRow}>
            <th style={th3}>Key</th>
            <th style={th3}>Description</th>
            <th style={th3}>Scope</th>
            <th style={th3}>Backing</th>
            <th style={{ ...th3, textAlign: "right" }}>Rotated</th>
          </tr>
        </thead>
        <tbody>
          {secrets.map((s) => (
            <tr key={s[0]} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td3, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{s[0]}</td>
              <td style={{ ...td3, color: "var(--fg-muted)" }}>{s[1]}</td>
              <td style={{ ...td3, color: "var(--fg-muted)" }}>{s[2]}</td>
              <td style={{ ...td3, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{s[3]}</td>
              <td style={{ ...td3, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}>{s[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─────────────────────────── Audit ─────────────────────────── */

function SecureAudit() {
  const audit = [
    ["e.chen",     "approved release v2.4.0-rc.3",        "production", "info", "2m ago"],
    ["mark.weber", "rotated STRIPE_SECRET",               "production", "ok",   "12m ago"],
    ["deploy-bot", "deployed v2.3.8 (canary 25%)",        "production", "info", "12m ago"],
    ["j.park",     "added runner-32",                     "prod-eu",    "ok",   "1h ago"],
    ["deploy-bot", "failed to acquire k8s lock",          "prod-us",    "fail", "1h ago"],
    ["e.chen",     "invited contractor-114",              "all",        "ok",   "2h ago"],
    ["e.chen",     "revoked access · contractor session", "all",        "warn", "3h ago"],
    ["mark.weber", "rolled back v2.3.6",                  "production", "warn", "2d ago"],
    ["e.chen",     "edited role · Maintainer",            "workspace",  "info", "2d ago"],
    ["sara.li",    "logged in via okta",                  "all",        "ok",   "5d ago"],
  ];
  return (
    <Panel>
      <PanelHeader title="Audit log" sub={`${audit.length} of 412 events (24h)`}
        action={<Button variant="outline" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Export CSV</Button>} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {audit.map((a, i) => (
          <li key={i} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
          }}>
            <StatusDot tone={a[3]} pulse={a[3] === "info"} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{a[0]}</span>
                <span style={{ color: "var(--fg-muted)" }}> · {a[1]}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", marginTop: 3 }}>{a[2]}</div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", flexShrink: 0 }}>{a[4]}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const tableHeadRow = {
  color: "var(--fg-muted)", textAlign: "left",
  fontFamily: "var(--font-mono)", fontSize: 10.5,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
const th3 = { padding: "10px 16px", fontWeight: 500 };
const td3 = { padding: "12px 16px", verticalAlign: "middle" };

window.Secure = Secure;
