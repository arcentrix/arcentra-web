# Arcentra Marketing Site — UI Kit

A pixel-fidelity recreation of <https://arcentra.io>, lifted from
`arcentrix/arcentra-website` (Next.js 15 + RSC). Recreated here in plain
React + Babel so it can be opened with no build step.

## What's in here

| File | Purpose |
|---|---|
| `index.html` | Loads React, the shared primitives, and every section in order. Open this to see the full landing page. |
| `Header.jsx` | Sticky top nav · logo lockup · routes · GitHub-stars button · theme toggle · CTAs. |
| `Footer.jsx` | 5-column footer · live status indicator · "Open-source first" rail. |
| `Hero.jsx` | Eyebrow chip, 64px h1, body, CTAs, tilted browser-frame mock dashboard. |
| `ProductPreview.jsx` | Tabbed product preview — Overview / Build / Approve / Deploy / Agents / Observe / Secure. Each tab renders a different mock view inside the same `BrowserFrame`. |
| `Sections.jsx` | `CoreWorkflow` (step circles + capability grid), `WhyArcentra` (before/after), `Workloads` (3 large cards). |
| `Architecture.jsx` | Architecture diagram (SVG flow with dashed arrows) + 3 layer cards + `OpenSource` (terminal block) + `BottomCta`. |

## Coverage notes

This kit covers the **homepage end-to-end**. The live site also has
`/pricing`, `/blog`, `/community`, `/changelog`, and legal pages — these
re-use the Header + Footer + a smaller `PageHero` and are not recreated
here. Add a single `PageHero.jsx` and reuse the chrome if you need them.

Every component is **client-side React only** (the live site mixes RSC and
client components, but everything visual works without a server). The shiki
code-highlighter is replaced with hand-styled mono spans inside
`OpenSource` — visually identical for the strings shown.

The hero artwork is a custom `MiniDashboard` inline component (compressed
overview), not the full `MockOverview` used inside `ProductPreview`. This
matches the live site, where the hero uses a *different* mock from the
product-preview section.
