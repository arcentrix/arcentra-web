# Page spec · Build

**Route:** `/build`  
**Reached from:** AppDock "Build" item · or click a pipeline in Dashboard "Recent runs"  
**Reference prototype:** `prototypes/dashboard/Build.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Project/Pipelines/*`

## Page structure

```
┌─ PageHeader ────────────────────────────────────────────┐
│ ▸ BUILD / PIPELINES                                     │
│ Build                              [New pipeline +]     │
│ Active and recent pipeline executions across projects.  │
├─ FilterBar ─────────────────────────────────────────────┤
│ [All 248] [Running 12] [Failed 52] [Queued 3]           │
├─ Two-column layout (1.4fr / 1fr) ───────────────────────┤
│ ┌──── Pipeline list ────────┐  ┌── Selected detail ──┐ │
│ │ ⊙ #2148 api·main    a4f9c2 2m │ ▸ PIPELINE · web-app │
│ │ ⊙ #2147 web·feat... 0bcf81 now│ web · feat/auth-v2   │
│ │ ⊙ #2146 worker·main 92ad11 14m│ main · #2147 · run.. │
│ │ …                              │                       │
│ │                                │ ▸ STEPS              │
│ │                                │ ✓ Checkout      2s   │
│ │                                │ ✓ Install     32s    │
│ │                                │ ⊙ Build       0:42   │ ← running outlined cyan
│ │                                │ … Push        —      │
│ │                                ├──────────────────────┤
│ │                                │ [Re-run] [Logs] ↗    │
│ └────────────────────────────────┘ └────────────────────┘
```

## Page container

```jsx
<section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
```

## Region 1 — PageHeader

`<PageHeader eyebrow="build / pipelines" title="Build" sub="…" action={…} />`

## Region 2 — FilterBar (filter chips)

`<FilterBar filters={[{label, count, active, tone}…]} />`

Each filter chip:
- 32px height, 12px padding
- Active: border-strong + bg-elevated, fg
- Inactive: border + transparent, fg-muted
- Status filters have a leading StatusDot (Running/Failed/Queued)
- Counts always in mono tabular-nums

## Region 3 — Two-column body

```jsx
<div style={{
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
  gap: 16,
  alignItems: "start"
}}>
```

⚠️ **Use `minmax(0, …)` not bare `1fr`** — without it, long text inside cells will break the column.

### Left: Pipeline list panel

`<Panel>` with `<PanelHeader title="Recent runs" sub="8 shown · last 24h" />`. Below the header, render each row as a **button** (not div) so click navigates to detail:

```jsx
<button onClick={() => setSelectedId(p.id)} style={{
  display: "grid",
  gridTemplateColumns: "auto auto 1fr auto auto",
  alignItems: "center", gap: 12,
  width: "100%", padding: "12px 20px",
  borderTop: "none", borderBottom: "1px solid var(--border)",
  background: active ? "var(--bg-elevated)" : "transparent",
  boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
}}>
  <StatusDot tone={p.status} pulse={p.status === "info"} />
  <span style={{ fontFamily: mono, fontSize: 11.5, width: 44 }}>#2148</span>
  <span style={{ fontWeight: 500 }}>{p.name}</span>
  <span style={{ fontFamily: mono, fontSize: 11, color: subtle }}>{p.commit}</span>
  <span style={{ fontFamily: mono, fontSize: 11, color: subtle, width: 64, textAlign: "right" }}>{p.time}</span>
</button>
```

⚠️ The 5 grid columns: `auto auto 1fr auto auto` (status dot / pipeline id / name fills / commit / time). The "1fr" column has `overflow: hidden` so name truncates.

⚠️ Active row has a **2px inset cyan bar on the left** — this is the brand's "selected" indicator, mirroring the AppDock's active state.

### Right: Selected pipeline detail panel

`<Panel>` with 3 internal regions:

**1. Header (padding: 20px):**
- Eyebrow + StatusBadge top row
- h3.display 20px name
- Mono meta row 8px below: branch (with GitBranch icon) · id · commit · duration

**2. Steps (padding: 20px, borderTop):**
- Eyebrow "steps"
- Ordered list, gap: 6px
- Each step: `<li>` with display flex gap 10
- Running step: `border: 1px solid var(--brand-signal-dim); background: color-mix(in oklab, var(--brand-signal) 4%, transparent);`
- Others: `border: 1px solid var(--border)`
- Step icon (✓ / × / loader-spinning): inline-flex 18×18 rounded-full border, colored per status
- Step name + tabular-nums duration on the right

**3. Footer actions (padding: 16px, borderTop):**
`[Re-run] [View logs]                    [Open in project ↗]`

## State

`const [selectedId, setSelectedId] = useState("#2147")` — defaults to the running pipeline so the prototype demonstrates the live state.

## Edge cases

- Empty list: render `<div style={{ padding: 60, textAlign: "center" }}>No pipelines yet.</div>` inside the Panel after the header
- 0 selected: keep right panel empty with a centered "Select a pipeline to view details"
- Failed pipeline: status badge uses tone="danger"
