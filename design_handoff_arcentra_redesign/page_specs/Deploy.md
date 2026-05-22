# Page spec · Deploy

**Route:** `/deploy`  
**Reference prototype:** `prototypes/dashboard/Deploy.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Deploy/index.tsx` + `pages/Project/Deployments/index.tsx`

## Layout

```
┌─ PageHeader (with Sync + Release CTAs) ────────────┐
├─ 3 environment cards (grid 3-col, gap 16) ─────────┤
│ ┌─ production ─┐ ┌─ staging ─┐ ┌─ dev ─┐           │
│ │ ▸ EU-WEST-1  │ │ ▸ EU-WEST │ │ ▸ US- │           │
│ │ production ⊙ │ │ staging ⊙ │ │ dev ⊙ │           │
│ │              │ │           │ │       │           │
│ │ Revision …   │ │ Revision …│ │ Revis │           │
│ │ State    …   │ │ State   … │ │ State │           │
│ │ Strategy …   │ │ Strategy …│ │ Strat │           │
│ │ Updated  …   │ │ Updated  …│ │ Updat │           │
│ ├──────────────┤ ├───────────┤ ├───────┤           │
│ │ [View] [RB] ↗│ │ [View][RB]│ │       │           │
│ └──────────────┘ └───────────┘ └───────┘           │
├─ Release history table ────────────────────────────┤
```

## Environment card

```jsx
<Panel>
  <div style={{ padding: 20 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Eyebrow>{e.region}</Eyebrow>           {/* eu-west-1 etc. */}
      <StatusDot tone={e.status} pulse={status === "info"} />
    </div>
    <h3 className="display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "10px 0 0" }}>
      {e.name}
    </h3>
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
      <Meta label="Revision" value={e.revision} mono />
      <Meta label="State"    value={e.age} />
      <Meta label="Strategy" value={e.strategy} />
      <Meta label="Updated"  value={e.lastDeploy} />
    </div>
  </div>
  <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 6 }}>
    <Button variant="outline" size="sm">View</Button>
    <Button variant="ghost" size="sm">Rollback</Button>
    <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={13} />}>Logs</Button>
  </div>
</Panel>
```

**Meta row pattern** (used everywhere — Deploy, Account, ProjectDetail):
```jsx
<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
  <span style={{ color: "var(--fg-subtle)", fontFamily: mono,
                 fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
  <span style={{ color: "var(--fg)", fontFamily: mono ? mono : sans }}>{value}</span>
</div>
```

⚠️ Production env shows status=info + pulse for "rolling" deploys. Static envs use status=ok.

## Release history table

`<Panel>` wrapper. Header: `<PanelHeader title="Release history" sub="Last 7 releases" />`.

Table columns (cells 12px 20px padding):
1. **Version** — mono 500
2. **Env** — plain text
3. **Status** — `<StatusBadge tone>` (ok/fail/info/warn)
4. **When** — muted text
5. **By** — plain text
6. **Strategy** — muted text
7. **Progress** — mono right-aligned (e.g. "4/8 pods", "—")

Column headers use the standard mono-caps treatment.
