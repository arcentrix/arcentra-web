---
name: arcentra-design
description: Use this skill to generate well-branded interfaces and assets for Arcentra, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc),
copy assets out and create static HTML files for the user to view. If
working on production code, you can copy assets and read the rules here to
become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what
they want to build or design, ask some questions, and act as an expert
designer who outputs HTML artifacts _or_ production code, depending on the
need.

## Quick orientation (don't skip — this is what makes designs feel like Arcentra and not like every other Next.js dashboard)

1. **Always import `colors_and_type.css`** in any HTML you write. It carries
   the full token system (neutrals, semantic vars, type scale, radii,
   spacing, shadows, motion). Defaults to the dark theme. Add `<html class="light">`
   to flip.
2. **Geist Variable** is the only typeface. `fonts/Geist[wght].woff2` is
   loaded by the CSS file. Don't use any other font.
3. **Logo lockup:** `<img src="…/assets/logo-icon.svg" style="filter:invert(1)">`
   + `arcentra/` in **Geist Mono, lowercase, weight 500, `-0.02em` tracking**,
   with the trailing `/` painted `--brand-signal`. **Do not use the wordmark
   SVG** — it's a blank placeholder in the source repo. **Do not** spell it
   "Arcentra" in Title Case Sans — that's the old direction.
4. **One brand color: `--brand-signal`** (desaturated electric cyan,
   `oklch(0.82 0.16 195)`). Use it on: the wordmark's `/`, the active
   AppDock indicator, `running` status, the GitHub star count badge,
   `FIG.0X` captions, and `▸` eyebrow prefixes. **Never as background fill,
   never as gradient, never on >1 element per region.**
5. **Display headlines = Geist Sans, weight 600 (semibold).** Apply
   `className="display"` on every h1/h2 hero/section title — `.display`
   sets Sans 600 with tight tracking. Mono is **not** the headline face
   (an earlier iteration tried it; it reads as flippant on commercial
   surfaces). Mono is reserved for: wordmark `arcentra/`, eyebrows, FIG
   captions, meta strips, code, dashboard metric values & labels, kbd hints.
6. **Background texture: `.blueprint-bg`** (engineering graph paper) on
   heroes and CTAs, paired with `.fade-mask-radial`. The legacy `.grid-bg`
   (radial dots) is no longer the default — use it only for variation.
7. **Iconography:** lucide-react. Inline SVGs from <https://lucide.dev> or
   import from `ui_kits/_shared/primitives.jsx` (the `I` object).
8. **No emoji. No big gradients. No hand-drawn SVGs.**
9. **Eyebrow caps before every section heading** — uppercase mono, 11px,
   `0.08em` tracking, `--fg-subtle`, with a leading `▸` glyph in
   `--brand-signal` (use the `Eyebrow` component, it adds the arrow by default).
10. **Middot (`·`) as separator** in every meta string. Em-dash (`—`) as the
    body break.

## When the user asks for a new screen / page

1. Open `ui_kits/dashboard/` or `ui_kits/website/` (whichever matches) and
   pull components from there — `AppDock`, `TopBar`, `Hero`, `BrowserFrame`,
   `MockCard`, `Badge`, `StatusDot`, etc. The `_shared/primitives.jsx`
   defines `Button`, `Badge`, `Eyebrow`, `LogoLockup`, `GridBg`, `StatusDot`,
   and the `Icon`/`I` toolkit.
2. If you cannot find a matching component, **read the live source** at
   `github.com/arcentrix/arcentra-web` (web app) or
   `github.com/arcentrix/arcentra-website` (marketing). Both are
   open-source and the user has access.
3. Match the density of the surface: marketing = 15px body, 80–96px section
   padding, 16r cards. Dashboard = 13px body, 32px page padding, 14r cards.

## When the user asks for a deck or slide

1. Use `deck_stage.js` for the chrome.
2. Section headers get the same `eyebrow + h2` treatment as marketing site
   sections.
3. Background: solid `--bg`, optionally with `.grid-bg` + `.fade-mask-radial`
   on title slides. Never a colored gradient.

## When the user asks for visual exploration / multiple options

1. Use `design_canvas.jsx` to lay options side-by-side.
2. Anchor every variation in the system — vary one axis at a time
   (layout, density, copy style, color emphasis). Do not invent new
   palettes; this brand is monochromatic.

## Style guard-rails for this brand specifically

- ❌ **Never invent a colored hero gradient.** The hero is solid bg + dot grid.
- ❌ **Never use a card with a colored left border accent.** Cards have a
   uniform 1px `--border` perimeter.
- ❌ **Never use emoji as bullets, status, or decoration.**
- ❌ **Never increase a card's padding to "make it feel premium".** The kit
   ships specific values (14, 18, 20, 24) — pick from those.
- ✅ **When in doubt, inset shadow + border-strong** to mark active/selected.
- ✅ **When you need to draw the eye, invert the surface** (white-on-black or
   black-on-white pill button). Color is not the answer.
- ✅ **Quote `·`-joined meta-strings under every metric and every chip group.**
- ✅ **Status communication = StatusDot (6px) + uppercase mono label.**

## Files in this skill

| Path | Contents |
|---|---|
| `README.md` | The full design system documentation. Read this first if unsure. |
| `colors_and_type.css` | The single source of truth for tokens. Import this in every HTML file. |
| `fonts/Geist[wght].woff2` | Variable font, 100–900. Loaded by the CSS. |
| `assets/logo-icon.svg` | The brand icon. Always render with `filter: invert(1)` on dark. |
| `assets/favicon-*.png` | Favicons. |
| `preview/*.html` | Token & component swatches. Reference only — do not consume in designs. |
| `ui_kits/website/` | Full marketing-site recreation. Components are reusable. |
| `ui_kits/dashboard/` | Full web-app recreation with AppDock, Dashboard page, Projects, Login, command palette. |
| `ui_kits/_shared/primitives.jsx` | Shared `Button`, `Badge`, `StatusDot`, `Icon/I` set, `Eyebrow`, `LogoLockup`, `GridBg`. |

## Source-of-truth repos (read these for anything not covered here)

- Control plane (Go backend): <https://github.com/arcentrix/arcentra>
- Web app (React + Vite): <https://github.com/arcentrix/arcentra-web>
- Marketing site (Next.js): <https://github.com/arcentrix/arcentra-website>
