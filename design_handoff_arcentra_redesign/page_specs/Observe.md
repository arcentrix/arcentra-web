# Page spec · Observe

**Route:** `/observe`  
**Reference prototype:** `prototypes/dashboard/Observe.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Observe/index.tsx`

## Layout

```
┌─ PageHeader (CTAs: [Last 6h] [Refresh]) ────────────────────┐
├─ Top split row (grid 1fr / 1.5fr, gap 16) ──────────────────┤
│ ┌─ SLO summary ──────┐  ┌─ Latency chart ──────────────────┐│
│ │ ▸ SERVICE LEVEL    │  │ ▸ P50 / P95 · LAST 6H            ││
│ │                    │  │   ─ p50 42ms  ─ p95 138ms        ││
│ │ ┌──┐               │  │                                   ││
│ │ │99.94%            │  │ [SVG line chart with gridlines]  ││
│ │ └──┘               │  │                                   ││
│ │ ── (measure line)  │  │                                   ││
│ │ 14m budget left    │  │                                   ││
│ │ ▓▓▓▓▓▓▓░░ 67%      │  │                                   ││
│ │ ────────────────── │  │                                   ││
│ │ MTTR │ MTBF        │  │                                   ││
│ │ BURN │ WINDOW      │  │                                   ││
│ └────────────────────┘  └───────────────────────────────────┘│
├─ Services table ────────────────────────────────────────────┤
├─ Active alerts feed ────────────────────────────────────────┤
```

## SLO summary card

Padding 20px. Eyebrow "service level · last 30d". Big mono value `99.94%` with the % muted smaller (24px). Below: error budget remaining (14m emerald) of 21m monthly. Then a 6px-tall progress bar (rounded 9999) at 67% width emerald 0.7 opacity.

Bottom: grid 1fr 1fr with 4 Meta rows (MTTR / MTBF / Burn / Window).

## Latency chart card

Padding 20px. Eyebrow + inline legend on the right (two small swatches: `fg` line for p50, `brand-signal` for p95).

```jsx
<svg viewBox="0 0 400 140" preserveAspectRatio="none"
     style={{ width: "100%", height: 140, marginTop: 12, color: "var(--fg-muted)" }}>
  <defs>
    <linearGradient id="grad-p50" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%"   stopColor="var(--fg)" stopOpacity="0.25" />
      <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
    </linearGradient>
  </defs>
  {/* dashed gridlines at y 28,56,84,112 */}
  {/* p95 line in brand-signal opacity 0.7 stroke 1.6 */}
  {/* p50 area gradient + line in --fg stroke 1.4 */}
</svg>
```

## Services table

Standard table-in-panel pattern. Columns: Service / Env / Latency p95 (mono) / RPS (mono) / Errors (mono — colored danger/warn if status matches) / Status (just a StatusDot) / right-aligned ↗ "Open" ghost button.

## Active alerts feed

`<ul>` of alerts in panel. Each row 14px 20px padding, leading StatusDot, title (500) + rule (mono 11px subtle) middle, "Xm ago" mono on right, "Ack" outline button rightmost.

## Status colors used

- info (sky-blue) for in-flight / running
- success (emerald) for healthy
- warn (amber) for elevated latency
- fail (rose) for breached SLO

Brand-signal is **NOT** used in the chart even though it's a "running" line — too saturated against the gridlines. p95 reads as info-blue.
