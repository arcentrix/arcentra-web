# Page spec · Secure (tabbed)

**Route:** `/secure`  
**Reference prototype:** `prototypes/dashboard/Secure.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Secure/*` + `pages/Users/` + `pages/Roles/`

## Major restructure

The current production code has:
- `pages/Secure/{Overview, Identity, Secrets, Audit, Policies}.tsx` — 5 sub-tabs
- `pages/Users/index.tsx` — separate page
- `pages/Roles/index.tsx` — separate page

**The redesign consolidates these into a single Secure page with 6 tabs:**
**Overview / Users / Roles / Identity / Secrets / Audit.**

The Users and Roles routes (`/users`, `/roles`) become deep links into Secure tabs (`/secure?tab=users`, `/secure?tab=roles`). Standalone routes should redirect.

## Page structure

```jsx
<section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
  <PageHeader
    eyebrow="secure / access control"
    title="Secure"
    sub="Users, roles, identity providers, secrets, policies and audit trail."
    action={<>
      <Button variant="outline">Policies</Button>
      {tab === "users"  && <Button variant="primary">Invite user</Button>}
      {tab === "roles"  && <Button variant="primary">New role</Button>}
      {tab === "secrets"&& <Button variant="primary">New secret</Button>}
      {tab === "identity" && <Button variant="primary">Add provider</Button>}
    </>}
  />
  <TabStrip /> {/* same inset-shadow pattern as ProductPreview */}
  {tab === "overview" && <SecureOverview />}
  {tab === "users"    && <SecureUsers />}
  {tab === "roles"    && <SecureRoles />}
  …
</section>
```

## Tab strip

```jsx
<div role="tablist" style={{
  display: "inline-flex", alignItems: "center", gap: 4,
  borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  padding: 4, alignSelf: "flex-start",
}}>
  {tabs.map(t => (
    <button role="tab" aria-selected={active} style={{
      height: 30, padding: "0 12px", borderRadius: 6,
      background: active ? "var(--bg)" : "transparent",
      boxShadow: active ? "inset 0 0 0 1px var(--border-strong)" : "none",
      // …
    }}>
      {t.label}
      {typeof t.count === "number" && <span style={{ fontFamily: mono, fontSize: 11, color: subtle }}>{t.count}</span>}
    </button>
  ))}
</div>
```

## Overview tab

6 stat cards in a 3-col grid. Same DashCard pattern as Dashboard but slightly larger (this is the tab landing).

## Users tab

`<Panel>` with TWO regions:

**1. Filter bar (padding: 14px, borderBottom):**
- Search input (320px max, with leading search icon, mono 12.5)
- FilterChips: All / Admins / Services / External (warn tone) / Inactive (muted tone)

**2. Users table (full-width)**

Columns:
- **User** — Avatar (28px circle + 8px status dot in bottom-right with 2px outline of bg) + name (500) + handle (mono 11 subtle)
- **Email** — mono 12 muted
- **Role** — `<RoleChip role>` (see below)
- **Provider** — mono 12 muted
- **Last seen** — mono 12 muted
- **Status** (right-aligned) — Badge tone="success/warn/outline"

## RoleChip component

```jsx
const tones = {
  Admin:      ["var(--brand-signal)",      "var(--brand-signal-dim)",  brandSignalBg],
  Maintainer: ["var(--fg)",                "var(--border-strong)",     "var(--bg-elevated)"],
  Developer:  ["var(--fg-muted)",          "var(--border)",            "transparent"],
  Service:    ["var(--accent-warn)",       warnBorder,                 warnBg],
  Viewer:     ["var(--fg-subtle)",         "var(--border)",            "transparent"],
}[role];
return (
  <span style={{
    height: 22, padding: "0 8px", borderRadius: 4,
    fontFamily: mono, fontSize: 11, fontWeight: 500,
    color: tones[0], border: `1px solid ${tones[1]}`, background: tones[2],
  }}>{role}</span>
);
```

⚠️ **Admin uses brand-signal cyan** — this is the one place outside the navigation where the brand color marks priority/hierarchy in data.

## Roles tab — RBAC matrix

```
┌─ Roles (left, 240px) ────┐  ┌─ Permissions matrix (right) ──────────────┐
│ ▸ ROLES · 5 · 3 BUILT-IN │  │ ▸ PERMISSIONS — read-only built-ins        │
│ ┌─────────────────────┐  │  │ ┌─────────────────────────────────────────┐│
│ │ Admin  │ all perms ▸│  │  │ │ WORKSPACE (group header in mono caps)   ││
│ │ Maint  │ 12 of 16  ▸│  │  │ │ workspace:read  Adm Mt Dv Vw Sv         ││
│ │ Dev    │ 7 of 16   ▸│  │  │ │ workspace:write Adm Mt — — —            ││
│ │ Viewer │ 5 of 16   ▸│  │  │ │                                          ││
│ │ Service│ 5 of 16   ▸│  │  │ │ PIPELINES                                ││
│ └─────────────────────┘  │  │ │ pipeline:read   Adm Mt Dv Vw Sv         ││
│                           │  │ │ …                                        ││
│                           │  │ └─────────────────────────────────────────┘│
```

- Layout: `grid-template-columns: 240px 1fr; gap: 16; align-items: start;`
- Roles panel: list of 5 rows; each shows RoleChip + permission count + chevron-right
- Matrix panel: table with the **permission** column on the left (40% width), then one column per role (5 cols). Group headers span all columns with mono-caps label and `bg-elevated` background.
- Cell rendering: `<Icon d={I.check} size={14} style={{color: var(--accent-success)}} />` if allowed, `<span>—</span>` (mono subtle) if not.

## Identity / Secrets / Audit tabs

Each is a single `<Panel>` with the corresponding table. See `SecureIdentity`, `SecureSecrets`, `SecureAudit` in the prototype JSX for exact column layouts.

## tableHeadRow shared constant

```js
const tableHeadRow = {
  color: "var(--fg-muted)", textAlign: "left",
  fontFamily: "var(--font-mono)", fontSize: 10.5,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
```

Use this for **every table in the system**. Cells default to `padding: 12px 16px`.
