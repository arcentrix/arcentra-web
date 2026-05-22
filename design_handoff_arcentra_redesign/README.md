# Handoff · Arcentra "Engineering Blueprint" Redesign

> A complete visual redesign for the **arcentrix/arcentra-web** control plane
> and **arcentrix/arcentra-website** marketing site, ready to apply to the
> existing codebases.

## About this bundle

The files in `prototypes/` are **design references** — high-fidelity React
+ Babel prototypes showing intended look and behavior. They run in plain
HTML for offline review.

**Do not ship the prototypes as-is.** The target codebases already have
their own stack (Vite + Tailwind v4 + shadcn/ui for the web app; Next.js
15 + Tailwind v4 + shadcn/ui base for the marketing site). The job is to
**port the design decisions** — tokens, type rules, components, layouts —
into those existing codebases following their established patterns.

## Fidelity

**High-fidelity (hifi).** Exact hex/oklch values, exact font sizes,
specific tracking, named utility classes. Treat the design tokens as the
contract; the JSX styling is implementation reference, not source of truth.

## What changed vs. the current production design

The current `arcentra-web` design is competent monochrome dev-tool design,
but it reads as generic — close to Vercel/Linear/Cal.com. The redesign
adds an **engineering-blueprint identity** that's distinct without
introducing a new font family or a flashy color system.

### 7 signature moves

1. **One brand signal color: `--brand-signal` (desaturated electric cyan,
   `oklch(0.82 0.16 195)`).** Used only on 5 specific elements:
   the wordmark's trailing slash, the active AppDock indicator, `running`
   status, the GitHub stars count badge, and the `▸` eyebrow arrow.
   Never as a background fill or gradient.

2. **Wordmark redesign: `arcentra/` in Geist Mono lowercase** with the
   trailing `/` painted brand-signal cyan — like a CLI namespace prefix.
   **Do not use** `public/images/logo.svg` — it's a blank placeholder in
   the repo (references an empty `<image>` element). The icon
   (`public/images/logo-icon.svg`) is fine.

3. **Display headlines in Geist Sans 600** with `-0.03em` tracking. An
   early version tried Geist Mono for headlines — that read as flippant
   for a commercial SaaS. Sans 600 carries authority while mono accents
   (wordmark, eyebrows, FIG captions, meta strips, metric readouts) keep
   the engineering identity.

4. **Background texture: `.blueprint-bg`** (16+64px engineering graph
   paper drawn with linear gradients) on heroes and CTAs. Replaces the
   legacy radial dot grid (`.grid-bg`).

5. **`▸ EYEBROW` pattern.** Every section/page title is preceded by an
   uppercase mono eyebrow with a leading brand-signal `▸` glyph.

6. **`.reading` measure line** on big numeric readouts in the dashboard
   — a 1px brand-signal underline under metric values, evoking printed
   instrument readouts.

7. **Marketing hero artwork = architecture schematic**, not a tilted
   browser frame. Drawn flat like an engineering plate
   (`FIG.01 · system topology`).

---

## Target codebases

| Repo | Stack | Where to apply |
|---|---|---|
| `github.com/arcentrix/arcentra-web` | Vite, React 18, TS, Tailwind v4, shadcn/ui | The web app / control plane UI |
| `github.com/arcentrix/arcentra-website` | Next.js 15, React 19, TS, Tailwind v4, shiki, next-themes | The marketing site |

Both ship a dark theme by default; both support light mode through a
toggle. The redesign maintains both themes.

---

## How to implement — 3 phases

### Phase 1: Token sync (10 min · zero risk · 80% of the visual change)

Merge `colors_and_type.css` into each codebase's existing CSS file:

| arcentrix/arcentra-web | arcentrix/arcentra-website |
|---|---|
| `src/styles/global.css` | `src/app/globals.css` |

**Add to `:root` (in both, dark theme):**
```css
--brand-signal:     oklch(0.82 0.16 195);
--brand-signal-dim: oklch(0.65 0.11 195);
--brand-signal-bg:  color-mix(in oklab, var(--brand-signal) 12%, transparent);
```

**Add to `.light` (light-theme override) in both:**
```css
--brand-signal:     oklch(0.55 0.15 200);
--brand-signal-dim: oklch(0.70 0.10 200);
```

**Append these utility classes** (any `@layer base` / global section):
```css
.display      { font-family: var(--font-sans); font-weight: 600;
                letter-spacing: -0.03em; line-height: 1.04; }
.eyebrow-arrow::before { content: "▸"; margin-right: 6px;
                         color: var(--brand-signal); opacity: 0.9; }
.blueprint-bg {
  background-image:
    linear-gradient(to right,  var(--grid-dot) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-dot) 1px, transparent 1px),
    linear-gradient(to right,
      color-mix(in oklab, var(--grid-dot) 50%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom,
      color-mix(in oklab, var(--grid-dot) 50%, transparent) 1px, transparent 1px);
  background-size: 64px 64px, 64px 64px, 16px 16px, 16px 16px;
}
.bracket-frame { position: relative; }
.bracket-frame::before, .bracket-frame::after {
  content: ""; position: absolute; width: 14px; height: 14px;
  border: 1px solid var(--brand-signal-dim); pointer-events: none; opacity: 0.7;
}
.bracket-frame::before { top: -1px; left: -1px;
                         border-right: none; border-bottom: none; }
.bracket-frame::after  { bottom: -1px; right: -1px;
                         border-left: none; border-top: none; }
.reading { position: relative; padding-bottom: 6px; display: inline-block; }
.reading::after {
  content: ""; position: absolute; left: 0; bottom: 0;
  width: 32px; height: 1px; background: var(--brand-signal); opacity: 0.6;
}
```

After Phase 1: existing shadcn cards/buttons/badges remain functional;
new `display` and `eyebrow-arrow` classes are available to use.

### Phase 2: Component-level changes (half day → 1 day)

Map of which existing source files need touches:

| Existing file in `arcentra-web` | Change to make | Reference |
|---|---|---|
| `src/components/site/logo.tsx`<br>(or wherever logo renders in the web app) | **Replace the wordmark rendering.** The current source uses a CSS mask of `logo.svg` (blank). Replace with: `arcentra` (Geist Mono, lowercase, 500, `-0.02em`) + `/` (`var(--brand-signal)`). Keep the icon as it is. | `prototypes/_shared/primitives.jsx` → `LogoLockup` |
| `src/components/app-dock.tsx` | • Icon size `h-5 w-5` → `h-4 w-4`<br>• Button `h-10` → `h-9` (or `h-[34px]`)<br>• Active indicator: `bg-foreground` → `background: var(--brand-signal); box-shadow: 0 0 6px color-mix(...)` glow<br>• `text-sm` → `text-[12.5px]` for label | `prototypes/dashboard/AppDock.jsx` |
| `src/components/breadcrumb.tsx` (top bar) | • Add a theme toggle button<br>• The inbox bell button gets an unread count badge (`bg-[var(--brand-signal)]`, `text-[var(--bg)]`) when count > 0 | `prototypes/dashboard/TopBar.jsx` |
| `src/components/nav-user-dock-trigger.tsx` | The user-menu dropdown now includes **Account** as an entry above Preferences. Workspace switcher gets a colored avatar tile (`bg-[var(--brand-signal)]`). | `prototypes/dashboard/AppDock.jsx` → `DockUser` + `MenuItem` |
| `src/components/ui/button.tsx` | The primary variant stays inverted-canvas. **Add** a `focus-visible:ring-1 focus-visible:ring-[var(--brand-signal)]` modifier to all variants. | `prototypes/_shared/primitives.jsx` → `Button` |
| `src/components/ui/badge.tsx` | Existing `success/warning/info/critical` variants stay; the formula for the muted bg should use `color-mix(in oklab, $accent 12%, var(--bg))` to keep the same ratio across light/dark. | `prototypes/_shared/primitives.jsx` → `Badge` |
| `src/components/command-palette.tsx` | Already exists. Style touch only: section headers use the new `eyebrow-arrow` class; keyboard hints use mono. | `prototypes/dashboard/TopBar.jsx` → `CommandPalette` |
| (new) Section/page header pattern | Create a `<PageHeader eyebrow title sub action>` component and apply it to **every** `pages/*/index.tsx`. Replaces the existing `h2 className="text-3xl font-bold..."`. | `prototypes/dashboard/_pages.jsx` → `PageHeader` |

### Phase 3: Page-level redesigns (1–2 weeks, page by page)

Each existing page file gets visual-only changes. The data layer
(API hooks, react-router, react-hook-form, zustand stores) is unchanged.

| Existing page in `arcentra-web` | What changes | Prototype reference |
|---|---|---|
| `src/pages/Dashboard/index.tsx` | Header → `eyebrow + h2.display + live-cluster chip`. Metric cards: padding tightens, label switches to mono caps, value gets `.reading` measure line. | `prototypes/dashboard/Dashboard.jsx` |
| `src/pages/Project/Pipelines/*` | Split-pane layout: filter bar + list (60%) + selected pipeline detail (40%). The detail panel shows step-by-step status with running stage outlined in `--brand-signal-dim`. | `prototypes/dashboard/Build.jsx` |
| `src/pages/Deploy/index.tsx` and `src/pages/Project/Deployments/index.tsx` | 3 env cards (dev/staging/production) above a release history table. Card uses Meta-row layout (label / value pairs) with right-aligned mono values. | `prototypes/dashboard/Deploy.jsx` |
| `src/pages/Models/Agents/Overview/index.tsx` | Stats row + 4-column runner grid (each cell has status dot + cluster + load bar + mono ID) + selected runner detail panel on the right. | `prototypes/dashboard/Agents.jsx` |
| `src/pages/Observe/index.tsx` | New layout: SLO summary card (left) + p50/p95 latency chart (right) + services table + active alerts feed. | `prototypes/dashboard/Observe.jsx` |
| `src/pages/Secure/index.tsx` and friends | **Major restructure.** Currently 5 sub-tabs (Overview/Identity/Secrets/Policies/Audit). Add **Users** and **Roles** as tabs here (merging `src/pages/Users/` and `src/pages/Roles/` into Secure). | `prototypes/dashboard/Secure.jsx` |
| `src/pages/Settings/*` and `src/pages/GeneralSettings/index.tsx` | Left sidebar with 5 sections (General / Notifications / Identity / System info / API tokens). Each section is a stack of `<AccountCard>` panels with `<FormRow>` rows. | `prototypes/dashboard/Settings.jsx` |
| **NEW · `src/pages/Account/index.tsx`** | Doesn't exist today — create it. 5 tabs (Profile / Security / Sessions / Preferences / API tokens). Reachable from the user-menu dropdown in the dock. | `prototypes/dashboard/Account.jsx` |
| `src/pages/Inbox/index.tsx` | 6-tab strip (All / Unread / Approvals / Mentions / Alerts / System), unread items get `bg: color-mix(in oklab, var(--brand-signal) 4%, transparent)` and a leading 8px dot. Inline Approve / Ack / Open actions. | `prototypes/dashboard/Inbox.jsx` |
| `src/pages/LLMDialogue/Chat/index.tsx` | Sidebar conversation list + main chat surface. Assistant messages can render **ToolCard** (gradient-free, mono header) and **CodeBlock** (with language + path eyebrow + copy button). Sources rendered as mono chips. | `prototypes/dashboard/Chat.jsx` |
| `src/pages/Projects/Detail/*` | 8 sub-tabs: Overview / Pipelines / Deployments / Artifacts / Environments / Secrets / Members / Settings. Currently fewer; collapse `pages/Project/Pipelines, Deployments, Artifacts, Environments, Secrets, Settings, Members` into nested routes here. | `prototypes/dashboard/ProjectDetail.jsx` |
| `src/pages/Login/index.tsx` + `components/login-form.tsx` | Heading switches to `.display` 22px 600. The form layout is unchanged. | `prototypes/dashboard/LoginForm.jsx` |

### Phase 3 — marketing site (`arcentra-website`)

| Existing file | What changes | Prototype reference |
|---|---|---|
| `src/components/home/hero.tsx` | **Replace MockDashboard** (tilted browser frame) with a flat **SchematicHero** — labeled architecture diagram with `FIG.01 · system topology` caption and `bracket-frame` corners. Hero h1 stays sentence-case English. | `prototypes/website/Hero.jsx` |
| `src/components/site/header.tsx` | GitHub stars button: count badge uses `color: var(--brand-signal); border-color: var(--brand-signal-dim);`. Replace the `eye` placeholder icon with a real theme toggle. CTA copy: "Get Started" / "View on GitHub" stay; demote "Try Cloud" or drop. | `prototypes/website/Header.jsx` |
| All `src/components/home/*` h2 elements | Add `className="display"`. Existing classes can stay alongside (the new class replaces inline `font-medium tracking-tight`). | `prototypes/website/Sections.jsx`, `Architecture.jsx`, `ProductPreview.jsx` |
| Every section's eyebrow div | Wrap or add `eyebrow-arrow` class so the `▸` prefix appears. | All home sections |
| `src/app/globals.css` | The hero's `<GridBg>` should swap to `<BlueprintBg>` (or pass a `variant="blueprint"` prop). | `prototypes/website/Hero.jsx` |

---

## Design tokens reference

### Colors (oklch)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `oklch(0.145 0 0)` | `oklch(1 0 0)` |
| `--bg-elevated` | `oklch(0.185 0 0)` | `oklch(0.985 0 0)` |
| `--fg` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` |
| `--fg-muted` | `oklch(0.72 0 0)` | `oklch(0.45 0 0)` |
| `--fg-subtle` | `oklch(0.55 0 0)` | `oklch(0.6 0 0)` |
| `--border` | `oklch(0.269 0 0)` | `oklch(0.922 0 0)` |
| `--border-strong` | `oklch(0.34 0 0)` | `oklch(0.85 0 0)` |
| `--accent-bg` | `oklch(0.985 0 0)` (inv) | `oklch(0.145 0 0)` (inv) |
| **`--brand-signal`** | **`oklch(0.82 0.16 195)`** | **`oklch(0.55 0.15 200)`** |
| `--brand-signal-dim` | `oklch(0.65 0.11 195)` | `oklch(0.70 0.10 200)` |
| `--accent-success` | `oklch(0.696 0.17 162.48)` | same |
| `--accent-info` | `oklch(0.7 0.14 220)` | same |
| `--accent-warn` | `oklch(0.8 0.18 84)` | same |
| `--accent-danger` | `oklch(0.645 0.246 16.4)` | same |

### Typography

- **Geist Variable** (100–900). Already in both repos at
  `src/assets/fonts/Geist[wght].woff2`.
- **Geist Mono** for all engineering-flavor text: wordmark, eyebrows,
  meta strips, code, metric values, kbd hints, table column headers,
  `FIG.0X` captions.
- **Geist Sans** for everything else, with `.display` class for h1/h2
  (weight 600, tracking `-0.03em`).

| Size | Family | Weight | Tracking | Use |
|---|---|---|---|---|
| 64–68px | Sans (`.display`) | 600 | `-0.035em` | Hero h1 |
| 38–48px | Sans (`.display`) | 600 | `-0.03em` | Section h2 |
| 30px | Sans (`.display`) | 600 | `-0.03em` | Page h2 |
| 22px | Sans (`.display`) | 600 | `-0.02em` | Login welcome / panel headline |
| 18–20px | Sans | 600 | `-0.02em` | Panel h3 |
| 28–30px | Mono | 600 | `-0.03em` | Metric readout values |
| 16px | Sans | 400 | 0 | Body |
| 14px | Sans | 400 | 0 | Dashboard body |
| 13px | Sans | 400 / 500 | 0 | Card body / table |
| 12.5px | Sans | 400 / 500 | 0 | Dense rows, dock label |
| 11px | Mono | 400 | `0.08em` UPPER | Eyebrow / column header / chip |
| 10.5px | Mono | 400 | `0.06em` UPPER | Meta caption / `FIG.0X` |

### Spacing scale (4px base)

`--space-1: 4px` · `2: 8` · `3: 12` · `4: 16` · `5: 20` · `6: 24` ·
`8: 32` · `10: 40` · `12: 48` · `16: 64` · `20: 80` · `24: 96`.

### Radii

`xs: 4` · `sm: 6` · `md: 8` (button default) · `lg: 10` · `xl: 12` ·
`2xl: 16` (card) · `3xl: 24` (frame) · `full: 9999`.

**Cards in the redesign use `radius: 8px`** (down from the old 12–14px).
Tighter feels more technical.

### Shadows

Only **one** drop shadow recipe across the system:
```
box-shadow:
  0 1px 0 0 rgba(255,255,255,0.04) inset,   /* top inner highlight */
  0 8px 24px -12px rgba(0,0,0,0.5);          /* soft drop           */
```
Used on the browser-frame mock and dropdown popovers only. Cards default
to no shadow — **borders carry the weight**.

For active/selected pills, use **inset shadow**:
```
box-shadow: inset 0 0 0 1px var(--border-strong);
```

For active route in the dock, use the **2px-wide vertical bar**:
```
position: absolute; left: 0;
width: 2px; height: 18px;
background: var(--brand-signal);
box-shadow: 0 0 6px color-mix(in oklab, var(--brand-signal) 50%, transparent);
border-radius: 0 9999px 9999px 0;
```

---

## Brand voice rules (apply when writing new copy)

- **No emoji.** Anywhere. Status uses dots + uppercase mono labels.
- **`·` (middot) is the universal separator** in meta strings:
  `Apache-2.0 · Self-hosted · Kubernetes-native`,
  `api · main · a4f9c2 · 2m ago`.
- **`→`** for delivery flows in headings: `Code → Build → Approve →
  Deploy → Observe → Recover.`
- **`—`** (em-dash) for mid-sentence breaks.
- **Sentence case** for headings and buttons. Never Title Case.
- **Section eyebrows are UPPERCASE MONO** with the `▸` prefix.
- **In-app code paths, branch names, IDs, commit hashes are lowercase
  mono**, never quoted.
- **No "I" / no "we" in product copy.** The product describes itself in
  third person ("Arcentra unifies…"). "You" is reserved for CTAs and
  onboarding.

---

## Iconography

The codebases already use **lucide-react**. **Do not switch icon sets.**
The redesign uses the same icons; only the size convention changes.

| Context | Size | Stroke |
|---|---|---|
| AppDock items | 16px (was 20) | 1.7 |
| Inline buttons | 13–14px | 1.7 |
| Eyebrow inline glyphs (`▸` is a Unicode glyph, not an icon) | — | — |
| Chip indicators | 11–12px | 1.7 |
| Table row icons | 12–14px | 1.7 |

---

## Assets in this bundle

- `assets/logo-icon.svg` — the brand icon. Render via CSS mask with
  `background-color: var(--fg)` so it tints with the theme. **Don't use
  the wordmark SVG** — `logo.svg` in the source repo is empty.
- `fonts/Geist[wght].woff2` — already in both codebases at
  `src/assets/fonts/Geist[wght].woff2`. No change needed.

---

## Reference prototypes

Open `prototypes/dashboard/index.html` in any browser (no build step
needed) to interact with the full redesigned app:

- AppDock with hover-expand
- 9 routes: Overview / Projects / Build / Deploy / Agents / Copilot /
  Observe / Secure / Settings — plus Account, Inbox, ProjectDetail
- ⌘K command palette
- Theme toggle (☀ / ☾)
- User-menu dropdown with workspace switcher
- Inbox bell with unread badge

Open `prototypes/website/index.html` for the marketing redesign:
hero with SchematicHero artwork, blueprint grid, all sections updated.

---

## File index

```
design_handoff_arcentra_redesign/
├── README.md                          ← you are here
├── SKILL.md                           ← agent-facing rules (cross-compatible with Agent Skills)
├── colors_and_type.css                ← full token system, copy/merge into both codebases
├── page_specs/                        ← per-page layout intent (read before each page!)
│   ├── _INDEX.md
│   ├── Dashboard.md, Projects.md, ProjectDetail.md
│   ├── Build.md, Deploy.md, Agents.md, Chat.md
│   ├── Observe.md, Secure.md, Settings.md
│   ├── Account.md, Inbox.md, LoginForm.md
├── assets/
│   └── logo-icon.svg                  ← brand icon (mask-rendered)
├── fonts/
│   └── Geist[wght].woff2              ← variable font, already in source repos
└── prototypes/
    ├── _shared/
    │   └── primitives.jsx             ← Button, Badge, StatusDot, LogoLockup, Eyebrow, Icon set
    ├── dashboard/                     ← 17 files — the web app redesign
    │   ├── index.html
    │   ├── AppDock.jsx, TopBar.jsx, _pages.jsx
    │   ├── Dashboard.jsx, Projects.jsx, ProjectDetail.jsx
    │   ├── Build.jsx, Deploy.jsx, Agents.jsx
    │   ├── Observe.jsx, Secure.jsx, Settings.jsx
    │   ├── Account.jsx, Inbox.jsx, Chat.jsx
    │   ├── LoginForm.jsx
    │   └── README.md
    └── website/                       ← marketing site redesign
        ├── index.html
        ├── Header.jsx, Footer.jsx
        ├── Hero.jsx, Sections.jsx, Architecture.jsx
        ├── ProductPreview.jsx
        └── README.md
```

---

## For Claude Code: recommended workflow

1. **Read `SKILL.md` first.** It's the operating manual — top-of-file
   rules that govern every visual decision.
2. **Read `page_specs/_INDEX.md`** to map each spec to its production file.
3. **Phase 1 (token sync).** Merge `colors_and_type.css` tokens into
   - `arcentra-web/src/styles/global.css`
   - `arcentra-website/src/app/globals.css`
4. **Verify Phase 1 didn't break anything.** Run the app, click through
   a few pages. Existing shadcn components should still work; just nothing
   uses the new tokens yet.
5. **Phase 2 (component touches).** Edit `app-dock.tsx`, `breadcrumb.tsx`,
   `logo.tsx`, `nav-user-dock-trigger.tsx`, `button.tsx` per the table
   above. Reference the matching prototype JSX for layout details.
6. **Phase 3 (pages).** For each page, **read its spec in `page_specs/`**
   before touching the production file. Spec gives the layout intent
   (grid columns, panel structure, header pattern); prototype JSX gives
   the exact pixel values. Recommended order:
   Dashboard → Projects/Detail → Build → Deploy → Secure (largest
   restructure: merge Users/Roles in) → Settings → new Account page →
   Inbox → Chat → Observe → Agents → marketing Hero last.
7. After each page, run the dev server and visually compare to the
   matching `prototypes/dashboard/*.jsx` rendered locally.

When in doubt, **the prototype JSX wins over the spec**. Specs are
simplified explanations; JSX has every edge case wired correctly.
