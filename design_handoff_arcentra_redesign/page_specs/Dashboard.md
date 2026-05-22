# Page spec · Dashboard (Overview)

**Route:** `/`  
**Reached from:** AppDock "Overview" item (default landing) · workspace breadcrumb left-most  
**Reference prototype:** `prototypes/dashboard/Dashboard.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Dashboard/index.tsx`

## Page-level container

```jsx
<section style={{ display: "flex", flexDirection: "column", gap: 24, padding: 32 }}>
```

- **Padding:** 32px all sides
- **Vertical rhythm:** 24px gap between major sections (NOT margins on children)

## Region 1 — Header bar

```
┌─────────────────────────────────────────────────────────────────┐
│ ▸ SYSTEM / OVERVIEW              ● LIVE · CLUSTER-PROD          │
│ Control Plane                                                    │
└─────────────────────────────────────────────────────────────────┘
```

- Layout: `display: flex; alignItems: center; justifyContent: space-between`
- **Left side:** `<Eyebrow>system / overview</Eyebrow>` (with default `▸` arrow prefix in brand-signal) + `<h2 className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Control Plane</h2>`
- **Right side:** "live · cluster-prod" status with a brand-signal pulsing 6px dot, all caps mono `fontSize: 11; letterSpacing: 0.08em`

⚠️ The h2 used to be "control plane/" with a cyan slash — **changed to "Control Plane" plain Sans Title-Case**. The slash treatment is reserved for the wordmark only.

## Region 2 — Top metric row (4 cards)

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
  <DashCard … />  // ×4
</div>
```

**Cards:** Running / Success / Failed / Avg Duration. Each shows:
- Mono uppercase label (top, fontSize: 12, letterSpacing: 0.04em)
- Big mono value with `.reading` class for measure line (fontSize: 30, weight 600)
- Footer text 12px muted with trend icon if applicable

## Region 3 — Efficiency metrics row (3 cards)

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
```

Same DashCard pattern. Deploy Frequency / Lead Time / MTTR.

## Region 4 — Health metrics row (4 cards)

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
```

Agents Online (with "32 / 48" split — the "/ 48" muted 500-weight) / Queue Length / Change Failure Rate / Execution Delay.

## Region 5 — Recent runs + Projects sidebar

```jsx
<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
```

⚠️ **Note: 2fr/1fr split, gap 24** (not 16 like the metric rows — this row is the bottom anchor and breathes more).

### Left panel: Recent runs
- `<Panel>` wrapper (8px radius, 1px border)
- Header: 18px 20px padding, h3.display 17px / mono sub "Last 10 across all projects · 24h window" + "View all" button (variant=outline, rightIcon=arrow-up-right)
- Table: cells `padding: 12px 20px`. Column headers in mono caps (fontSize 10.5, letterSpacing 0.06em uppercase). Status uses `<StatusBadge tone="ok|fail|info|warn">` with icon + label.

### Right panel: Projects Overview
- `<Panel>` wrapper, padding 18px 20px, flex column gap 18px
- h3.display 17px "Projects" + 12px mono sub
- List of 5 project rows: name (500) / sub (12px muted) on left, `<Badge tone>` on right
- Tones: Healthy → success / Warning → warn / Critical → danger

## DashCard internal layout

```
┌──────────────────┐
│ LABEL          ⊙ │  ← top row: justifyContent space-between
│                  │
│ ┌──┐             │  ← .reading wrapper around value
│ │ 12               ← value (mono 30px weight 600)
│ └──┘             │
│ ────             │  ← brand-signal measure line (auto via .reading)
│ +3 from last hr  │  ← footer (fontSize 12 muted)
└──────────────────┘
```

- Radius: 8px
- Border: 1px var(--border)
- Background: var(--bg) (not var(--bg-elevated) — keep cards flat on the same surface as the page)
- Padding: 18px 20px
- Children gap: 10px (flexDirection column)

## Empty state

If a metric resolves to 0 or "—": value displays as "—" in mono var(--fg-subtle). Don't hide the card.

## Responsive

The 4-column grids collapse on mobile (the prototype doesn't show this — keep `md:grid-cols-2 lg:grid-cols-4` from current production code).
