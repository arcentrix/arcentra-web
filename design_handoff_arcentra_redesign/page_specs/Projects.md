# Page spec · Projects (list)

**Route:** `/projects`  
**Reference prototype:** `prototypes/dashboard/Projects.jsx`

## Layout

```
┌─ PageHeader (with [+ New Project]) ──────────────────────┐
├─ Filter bar ─────────────────────────────────────────────┤
│ [🔍 Search projects…] [All] [Active] [Archived]          │
├─ 3-col grid (gap 16) ────────────────────────────────────┤
│ ┌─ Project card ─┐ ┌─ Project card ─┐ ┌─ Project card ─┐│
│ │ ▣ web-app    ⊙ │ │ ▣ api-service⊙ │ │ ▣ mobile-app ⊙ ││
│ │                │ │                │ │                ││
│ │ description…   │ │ description…   │ │ description…   ││
│ ├────────────────┤ ├────────────────┤ ├────────────────┤│
│ │ TS · 12p · 2m  │ │ Go · 18p · 8m  │ │ TS · 9p · 21m  ││
│ └────────────────┘ └────────────────┘ └────────────────┘│
```

## Project card

```jsx
<article onClick={() => onOpen(p.name)} style={{
  borderRadius: 14, border: "1px solid var(--border)",
  background: "var(--bg)", padding: 20,
  cursor: "pointer",
  transition: "border-color 160ms, background-color 160ms",
}}
onMouseEnter={(e) => {
  e.currentTarget.style.borderColor = "var(--border-strong)";
  e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
}}
onMouseLeave={(e) => {
  e.currentTarget.style.borderColor = "var(--border)";
  e.currentTarget.style.backgroundColor = "var(--bg)";
}}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ /* 32px icon tile */ }}><Icon d={I.frame} size={14} /></div>
      <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{p.name}</h3>
    </div>
    <StatusDot tone={p.status} pulse={p.status === "info"} />
  </div>
  <p style={{ marginTop: 12, fontSize: 13, color: muted, lineHeight: 1.55 }}>{p.desc}</p>
  <div style={{
    marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)",
    display: "flex", justifyContent: "space-between",
    fontFamily: mono, fontSize: 11, color: subtle,
  }}>
    <span>{p.lang}</span>
    <span>{p.pipelines} pipelines</span>
    <span>{p.lastRun}</span>
  </div>
</article>
```

⚠️ **Use a 14px radius (`borderRadius: 14`)** for the project card — slightly softer than the 8px panels elsewhere because these are "navigable cards", not data containers.

## Filter bar

Search input (320px max, leading I.search 14px muted) + 3 filter chips (All / Active / Archived).

## On click

`onOpen(p.name)` triggers route → `/project` with projectId state set. See `ProjectDetail.md`.

## Empty state

When search yields 0:
```jsx
<div style={{ gridColumn: "1 / -1", padding: 60, textAlign: "center", color: muted }}>
  No projects match "<q>". <span style={{ color: subtle }}>Try a different search.</span>
</div>
```
