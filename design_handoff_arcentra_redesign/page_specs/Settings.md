# Page spec · Settings (workspace)

**Route:** `/settings`  
**Reference prototype:** `prototypes/dashboard/Settings.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Settings/*` + `pages/GeneralSettings/index.tsx`

## Layout

```
┌─ PageHeader (no action) ────────────────────────────────────┐
├─ Two-col body ──────────────────────────────────────────────┤
│ ┌─ Sidebar (200px) ─┐  ┌─ Section content (1fr) ──────────┐│
│ │ ⚙ General          │  │ ┌─── SettingsCard ────────────┐ ││
│ │ 🔔 Notifications   │  │ │ Workspace                    │ ││
│ │ 👤 Identity        │  │ │ How you appear …             │ ││
│ │ 🖳 System info     │  │ ├──────────────────────────────┤ ││
│ │ □ API tokens       │  │ │ FormRow rows…                │ ││
│ │                    │  │ └──────────────────────────────┘ ││
│ │                    │  │ ┌─── another card …             ││
│ │                    │  │ …                                ││
│ └────────────────────┘  └──────────────────────────────────┘│
```

## Sidebar nav (left)

```jsx
<nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
  {sections.map(s => {
    const active = s.id === current;
    return (
      <button onClick={() => set(s.id)} style={{
        display: "flex", alignItems: "center", gap: 10,
        height: 34, padding: "0 10px", borderRadius: 6,
        background: active ? "var(--bg-elevated)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        fontSize: 13, fontWeight: active ? 500 : 400,
        boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
        // …
      }}>
        <Icon d={s.icon} size={14} />
        <span>{s.label}</span>
      </button>
    );
  })}
</nav>
```

⚠️ **Active item gets the same 2px-inset cyan bar** as the AppDock and pipeline list. Consistent "selected" marker throughout the app.

## SettingsCard pattern

Every section is composed of one or more `<SettingsCard>` panels:

```jsx
<Panel>
  <div style={{
    padding: "18px 20px", borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "space-between"
  }}>
    <div>
      <h3 className="display" style={{ fontSize: 16, fontWeight: 600,
            letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 12.5, color: muted, margin: "4px 0 0" }}>{sub}</p>}
    </div>
    {action /* optional CTA in header */}
  </div>
  <div style={{ padding: 20 }}>
    {/* FormRow rows OR custom content */}
  </div>
</Panel>
```

## FormRow pattern

```jsx
<div style={{
  display: "grid", gridTemplateColumns: "200px 1fr", gap: 24,
  padding: "14px 0", borderBottom: "1px solid var(--border)",
  alignItems: "center"
}}>
  <div>
    <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
    {hint && <div style={{ fontSize: 12, color: subtle, marginTop: 2 }}>{hint}</div>}
  </div>
  <div>{children /* input, toggle, button */}</div>
</div>
```

⚠️ Last FormRow in a card should have `borderBottom: 0` OR the container's padding-bottom can be 0. The prototype keeps the border on the last row — it's fine because the panel's padding hides it. Just make sure the panel's bottom 20px padding is present.

## TextInput

```jsx
<input style={{
  height: 34, padding: "0 12px", width: "100%", maxWidth: 360,
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 6, color: "var(--fg)",
  fontFamily: mono ? mono : sans, fontSize: 13, outline: "none",
}} />
```

## Toggle (custom switch)

36×20 pill. On = `bg: var(--brand-signal)`, off = `bg: var(--border-strong)`. Inside knob is 16×16 round, translates 16px on toggle, 150ms ease-out.

## Sections (left → right body)

1. **General** — Workspace card (3 rows) + Pipeline defaults card (4 rows with 2 toggles) + Danger zone card (2 destructive buttons)
2. **Notifications** — Channels card with 4 rows (Slack/Email/Webhook/PagerDuty); each row has icon tile + name + sub + toggle + Edit button
3. **Identity** — Single card explaining the link to /secure?tab=identity (this section is reserved for fallback rules, not config)
4. **System info** — Control plane card (5 read-only rows: Version/Commit/Uptime/Database/Object storage) + Telemetry card (2 toggles)
5. **API tokens** — Single card with workspace-wide token table

⚠️ **Account page (`/account`) and Settings (`/settings`) are different.** Settings = workspace config (admin-only for most). Account = personal user profile (anyone). They share the sidebar+card pattern but are distinct routes.
