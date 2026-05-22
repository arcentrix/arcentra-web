# Page spec · Account (NEW page)

**Route:** `/account`  
**Reached from:** Bottom-left dock user-menu dropdown → "Account" item  
**Reference prototype:** `prototypes/dashboard/Account.jsx`  
**Mirrors source:** NEW — doesn't exist in the codebase today

## Layout

```
┌─ PageHeader (no action) ────────────────────────────────────┐
├─ Two-col body (220px / 1fr, items-start) ───────────────────┤
│ ┌─ Sidebar 220px ──────┐  ┌─ Section body ────────────────┐│
│ │ ┌─ Identity card ──┐ │  │ ┌─── AccountCard ────────────┐││
│ │ │ EC  Evelyn Chen  │ │  │ │ Identity                    │││
│ │ │     e.chen·Admin │ │  │ ├─────────────────────────────┤││
│ │ └──────────────────┘ │  │ │ ┌──────┐                    │││
│ │                      │  │ │ │ EC + │ Avatar upload area │││
│ │ 👤 Profile           │  │ │ └──────┘                    │││
│ │ 🛡 Security          │  │ │ Display name      [input]   │││
│ │ 🖳 Sessions          │  │ │ Handle           [@input]   │││
│ │ ⚙ Preferences        │  │ │ Title             [input]   │││
│ │ □ API tokens         │  │ │ Time zone         [input]   │││
│ │                      │  │ │ Bio              [textarea] │││
│ │                      │  │ └─────────────────────────────┘││
│ └──────────────────────┘  │ ┌─── Contact ─────────────────┐ │
```

## Sidebar — Identity card (top)

```jsx
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
    fontFamily: mono, fontSize: 13, fontWeight: 600,
  }}>EC</span>
  <div>
    <div style={{ fontSize: 13, fontWeight: 500 }}>Evelyn Chen</div>
    <div style={{ fontFamily: mono, fontSize: 10.5, color: subtle }}>e.chen · Admin</div>
  </div>
</div>
```

Below the identity card, the same sidebar nav pattern as Settings (with 2px inset cyan bar on active).

## Profile tab — Avatar block

The avatar block at the top of the Identity card is the first row inside the card body (NOT in FormRow grid):

```jsx
<div style={{
  display: "flex", alignItems: "center", gap: 20,
  padding: "14px 0", borderBottom: "1px solid var(--border)"
}}>
  <div style={{ position: "relative", flexShrink: 0 }}>
    <span /* 64px avatar */ />
    <button /* 24px circular + button in bottom-right */>
      <Icon d={I.plus} size={12} />
    </button>
  </div>
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, color: muted }}>
      PNG or JPEG, square, 1MB max. Or use a Gravatar by email.
    </div>
    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
      <Button variant="outline" size="sm">Upload image</Button>
      <Button variant="ghost" size="sm">Use Gravatar</Button>
      <Button variant="ghost" size="sm" style={{ color: muted }}>Remove</Button>
    </div>
  </div>
</div>
```

## Profile tab — special input with prefix

The "Handle" input shows a leading `@` prefix:

```jsx
<div style={{
  display: "inline-flex", alignItems: "center",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 6, maxWidth: 360, width: "100%",
}}>
  <span style={{ paddingLeft: 12, paddingRight: 6,
                 color: subtle, fontFamily: mono, fontSize: 13 }}>@</span>
  <input style={{ flex: 1, height: 32, padding: "0 12px 0 0",
                  background: "transparent", border: 0, … }} />
</div>
```

## Security tab — 2FA radio cards

Each method renders as a clickable `<label>` containing a radio input + content:

```jsx
<label style={{
  display: "flex", alignItems: "flex-start", gap: 12,
  padding: 14, borderRadius: 8,
  border: active ? "1px solid var(--brand-signal-dim)" : "1px solid var(--border)",
  background: active ? "color-mix(in oklab, var(--brand-signal) 5%, transparent)" : "transparent",
  cursor: "pointer",
}}>
  <input type="radio" name="tfa" checked={active}
         style={{ marginTop: 3, accentColor: "var(--brand-signal)" }} />
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
    <div style={{ fontSize: 12, color: muted }}>{sub}</div>
  </div>
  {active && <Button variant="outline" size="sm">Manage</Button>}
</label>
```

⚠️ The selected radio card uses **`brand-signal-dim` border + 5% brand-signal tint background**. This is the strongest "active card" marker in the system.

## Security tab — recovery codes grid

```jsx
<div style={{
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
  fontFamily: mono, fontSize: 13,
}}>
  {codes.map(c => (
    <div style={{
      padding: "8px 12px", borderRadius: 6,
      border: "1px solid var(--border)", background: "var(--bg-elevated)",
      color: muted,
    }}>{c}</div>
  ))}
</div>
```

## Sessions tab — current device badge

The "this device" row gets a special green badge instead of a Revoke button:

```jsx
<Badge tone="success">
  <span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--accent-success)" }} />
  this device
</Badge>
```

## Preferences tab — SegmentedControl

Used for theme (Dark/Light/System) and density (Comfortable/Compact). Pattern:

```jsx
<div style={{
  display: "inline-flex", alignItems: "center", gap: 2,
  padding: 2, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
}}>
  {options.map(o => (
    <button style={{
      height: 28, padding: "0 12px", borderRadius: 6,
      background: active ? "var(--bg)" : "transparent",
      boxShadow: active ? "inset 0 0 0 1px var(--border-strong)" : "none",
      // …
    }}>{o.label}</button>
  ))}
</div>
```

## Preferences tab — PrefRow with toggle

For boolean notification preferences:

```jsx
<div style={{ display: "flex", alignItems: "center", gap: 14,
              padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
    <div style={{ fontSize: 12, color: subtle, fontFamily: mono, marginTop: 2 }}>{sub}</div>
  </div>
  <Toggle on={on} />
</div>
```

## Connecting the dock menu

In `AppDock.jsx → DockUser`, the dropdown's "Account" menu item should:

```jsx
onClick={() => { setOpen(false); navigate('/account'); }}
```

Same handler for "Preferences" (auto-scrolls to the Preferences tab) and "API tokens" (to the tokens tab). Use querystring or hash routing to deep-link tabs.
