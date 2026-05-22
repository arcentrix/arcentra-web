# Page spec · Inbox (Notification center)

**Route:** `/inbox`  
**Reached from:** TopBar bell icon (with brand-signal unread count badge)  
**Reference prototype:** `prototypes/dashboard/Inbox.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Inbox/index.tsx`

## Layout

```
┌─ PageHeader (CTAs: [Subscriptions] [Mark all read]) ────┐
├─ Tab strip ─────────────────────────────────────────────┤
│ [All 10] [Unread 3] [Approvals 3] [Mentions 2] [Alerts 3] [System 2] │
├─ Notifications panel ───────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐  │
│ │ ● ⊙ Title bold              [approval]             │  │ ← unread (cyan tint bg + dot)
│ │   ↳ body muted                                     │  │
│ │   actor · 2m ago                  [Approve][Decl.] │  │
│ ├────────────────────────────────────────────────────┤  │
│ │   ⊙ Title 500                [alert]               │  │ ← read
│ │   ↳ body muted                                     │  │
│ │   system · 4m ago                            [Ack] │  │
│ │ …                                                  │  │
```

## Tab strip — special signal coloring

Same tab pattern as Secure. **Differentiator:** when **Unread** tab is active AND its count > 0, the count number turns brand-signal cyan instead of muted:

```jsx
<span style={{
  fontFamily: mono, fontSize: 11,
  color: active
    ? (t.id === "unread" && t.count > 0 ? "var(--brand-signal)" : "var(--fg-muted)")
    : "var(--fg-subtle)",
}}>{t.count}</span>
```

## Notification row

```jsx
<li onClick={() => markRead(id)} style={{
  display: "flex", alignItems: "flex-start", gap: 14,
  padding: "14px 20px",
  borderTop: i === 0 ? "none" : "1px solid var(--border)",
  background: unread
    ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)"
    : "transparent",
  cursor: "pointer",
}}>
  {/* Left indicator column (12px wide, stack of two markers) */}
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    paddingTop: 4, gap: 8, flexShrink: 0,
  }}>
    {unread
      ? <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--brand-signal)" }} />
      : <span style={{ width: 8, height: 8 }} /> /* invisible spacer for alignment */}
    <StatusDot tone={n.sev} pulse={false} />
  </div>

  {/* Body */}
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontSize: 13.5, fontWeight: unread ? 600 : 500 }}>{title}</span>
      <span /* type chip — bordered, mono caps 10px */>approval</span>
    </div>
    <p style={{ fontSize: 12.5, color: muted, margin: "4px 0 0" }}>{body}</p>
    <div style={{ marginTop: 6, fontFamily: mono, fontSize: 11, color: subtle,
                  display: "flex", gap: 10 }}>
      <span>{actor}</span><span>·</span><span>{when}</span>
    </div>
  </div>

  {/* Right action stack */}
  <div style={{ flexShrink: 0, display: "flex", gap: 6, paddingTop: 2 }}>
    {type === "approval" && <>
      <Button variant="outline" size="sm">Approve</Button>
      <Button variant="ghost"   size="sm">Decline</Button>
    </>}
    {type === "alert" && <Button variant="outline" size="sm">Ack</Button>}
    {(type === "mention" || type === "system") &&
      <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={12} />}>Open</Button>}
  </div>
</li>
```

## Empty state

When the active filter yields 0 results:

```jsx
<div style={{ padding: 60, textAlign: "center", color: muted, fontSize: 14 }}>
  Nothing here. <span style={{ color: subtle }}>Inbox zero · clean.</span>
</div>
```

## Unread badge on the bell

In `TopBar.jsx`, the bell button has a count badge:

```jsx
<button style={{ position: "relative", … }}>
  <Icon d={I.bell} size={14} />
  {unreadCount > 0 && (
    <span style={{
      position: "absolute", top: -4, right: -4,
      minWidth: 16, height: 16, padding: "0 4px",
      borderRadius: 9999,
      background: "var(--brand-signal)",
      color: "var(--bg)",
      fontSize: 10, fontWeight: 600, fontFamily: mono,
      border: "2px solid var(--bg)",
      fontVariantNumeric: "tabular-nums",
    }}>{unreadCount}</span>
  )}
</button>
```

⚠️ The badge uses brand-signal as **background fill** (rare — most uses are foreground). Acceptable here because it's at 16px size and the contrast ratio works.
