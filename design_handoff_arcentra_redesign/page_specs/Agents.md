# Page spec · Agents

**Route:** `/agents`  
**Reference prototype:** `prototypes/dashboard/Agents.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Models/Agents/Overview/index.tsx`

## Layout

```
┌─ PageHeader (with Register token + Add runner CTAs) ──────┐
├─ Stats row (4 cards, grid 4-col) ─────────────────────────┤
│ [Active 28]  [Idle 4]  [Capacity 67%]  [Through 2.4k]     │
├─ Body (grid 1.6fr / 1fr, gap 16, items-start) ────────────┤
│ ┌─ Runners panel ─────────────┐  ┌─ Sidebar ───────┐      │
│ │ ▸ RUNNERS — 32 active        │  │ ▸ RUNNER DETAIL│      │
│ │                               │  │ runner-01      │      │
│ │ Grid 4-col, gap=1 over        │  │ ─ Meta rows ─  │      │
│ │ border background (paneled    │  │ Cluster …      │      │
│ │ trick):                       │  │ Arch …         │      │
│ │ ┌runner─┐ ┌runner─┐ ┌──┐ ┌──┐│  │ Version …      │      │
│ │ │id   ⊙ │ │id   ⊙ │ │  │ │  ││  │ Load …         │      │
│ │ │cluster│ │cluster│ │  │ │  ││  │ Jobs 24h …     │      │
│ │ │▓▓▓░░░ │ │▓▓░░░░ │ │  │ │  ││  ├────────────────┤      │
│ │ │67% 84 │ │43% 91 │ │  │ │  ││  │ [Drain] [Restart][Logs]│
│ │ └───────┘ └───────┘ └──┘ └──┘│  └────────────────┘      │
│ │ … 32 cards total              │  ┌─ Clusters ──────┐    │
│ └───────────────────────────────┘  │ ▸ CLUSTERS · 4  │    │
│                                    │ ▣ prod-eu  12/13│    │
│                                    │ ▣ prod-us   9/9 │    │
│                                    │ ▣ edge      4/6 │    │
│                                    │ ⊞ dev       3/4 │    │
│                                    └─────────────────┘    │
```

## Runner grid (panel)

```jsx
<Panel>
  <PanelHeader title="Runners" sub="32 active" />
  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,                             /* ← 1px gap */
    padding: 1,                         /* ← 1px outer padding */
    background: "var(--border)"         /* ← shows through gaps */
  }}>
    {runners.map(r => <RunnerCard … />)}
  </div>
</Panel>
```

⚠️ **The "paneled grid" trick:** instead of borders on each cell, set the container background to `--border` and the cells to `--bg`. The 1px gap becomes the visible border. This is reused in Marketing CoreWorkflow.

## RunnerCard internal

```jsx
<button style={{
  textAlign: "left", border: 0, cursor: "pointer", padding: 14,
  background: active ? "var(--bg-elevated)" : "var(--bg)",
  boxShadow: active ? "inset 0 0 0 1px var(--brand-signal-dim)" : "none",
  display: "flex", flexDirection: "column", gap: 8,
}}>
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ fontFamily: mono, fontSize: 12 }}>{r.id}</span>
    <StatusDot tone={r.status} pulse={r.status === "info"} />
  </div>
  <div style={{ fontFamily: mono, fontSize: 10.5, color: subtle }}>
    {r.cluster} · {r.arch}
  </div>
  {/* Load bar */}
  <div style={{ height: 4, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
    <div style={{
      height: "100%", width: `${r.load}%`,
      background: r.load > 80 ? "var(--accent-warn)"
                : r.status === "info" ? "var(--brand-signal)"
                : "var(--fg)",
      opacity: r.status === "muted" ? 0.3 : 0.75,
    }} />
  </div>
  <div style={{ fontFamily: mono, fontSize: 10, color: subtle,
                display: "flex", justifyContent: "space-between" }}>
    <span>{r.load}% load</span><span>{r.runs} runs</span>
  </div>
</button>
```

⚠️ The selected runner card shows **inset cyan ring** (`inset 0 0 0 1px var(--brand-signal-dim)`), not a left bar — because it's in a grid, not a list.

## Sidebar (right column)

Stack two `<Panel>`s with gap 16:

1. **Runner detail** — Eyebrow, h3 mono (runner-XX), Meta rows for cluster/arch/version/load/jobs, footer actions
2. **Clusters list** — `<PanelHeader>` + `<ul>` of clusters, each row has icon (server/cpu) + mono cluster name / region + right-aligned mono count "N / N+M"
