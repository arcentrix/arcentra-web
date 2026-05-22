# Page specs · index

Use these specs in addition to the prototype JSX files. **The prototype JSX
is the source of truth for pixel values**; these MD docs are the
high-level explanation of layout intent (which Claude Code can read faster
than parsing 600-line JSX).

## Reading order

1. **`../README.md`** — overall handoff plan, 3-phase rollout, token migration
2. **`../SKILL.md`** — operating rules (font sizes, color rules, do/don't)
3. **This index** — find your page
4. **The page spec** — read for the page you're working on
5. **The prototype JSX** at `../prototypes/dashboard/<Page>.jsx` — for exact pixel values

## All page specs

| Spec | Implements | Source file in arcentra-web |
|---|---|---|
| [`Dashboard.md`](./Dashboard.md) | `/` (Overview) | `pages/Dashboard/index.tsx` |
| [`Projects.md`](./Projects.md) | `/projects` | `pages/Projects/index.tsx` |
| [`ProjectDetail.md`](./ProjectDetail.md) | `/projects/:id` (8 sub-tabs) | merges `pages/Project/*` |
| [`Build.md`](./Build.md) | `/build` | `pages/Project/Pipelines/*` |
| [`Deploy.md`](./Deploy.md) | `/deploy` | `pages/Deploy/index.tsx` |
| [`Agents.md`](./Agents.md) | `/agents` | `pages/Models/Agents/Overview/index.tsx` |
| [`Chat.md`](./Chat.md) | `/chat` (Copilot) | `pages/LLMDialogue/Chat/index.tsx` |
| [`Observe.md`](./Observe.md) | `/observe` | `pages/Observe/index.tsx` |
| [`Secure.md`](./Secure.md) | `/secure` (**6 tabs, absorbs Users + Roles**) | merges `pages/Secure/* + pages/Users/ + pages/Roles/` |
| [`Settings.md`](./Settings.md) | `/settings` (workspace config) | `pages/Settings/* + pages/GeneralSettings/` |
| [`Account.md`](./Account.md) | **`/account` (NEW)** — personal profile | doesn't exist yet — create it |
| [`Inbox.md`](./Inbox.md) | `/inbox` (bell icon → notification center) | `pages/Inbox/index.tsx` |
| [`LoginForm.md`](./LoginForm.md) | `/login` | `components/login-form.tsx` |

## Cross-page patterns

These appear in multiple pages — implement once, reuse:

- **`<PageHeader eyebrow title sub action>`** — every page top. `prototypes/dashboard/_pages.jsx`
- **`<Panel>`** — every card container. `borderRadius: 8`, `border: 1px solid var(--border)`, `background: var(--bg)`
- **`<PanelHeader title sub action>`** — every panel's header strip. 18px 20px padding, borderBottom
- **`<Eyebrow>`** — uppercase mono caps with `▸` arrow prefix. Goes above every heading.
- **`<StatusDot tone="ok|info|warn|fail|muted" pulse>`** — 6×6 colored circle
- **`<StatusBadge tone>`** — pill with icon + label (Passed/Failed/Running/Queued)
- **`<Meta label value mono>`** — label-value row pattern used in Deploy env cards, Account, ProjectDetail
- **Inset-shadow tab pills** — Secure, Inbox, ProjectDetail all use it. `inset 0 0 0 1px var(--border-strong)` on active.
- **Cyan inset bar (2px) on active list items** — Build pipeline list, Settings/Account sidebars, Chat history sidebar, AppDock items. `box-shadow: inset 2px 0 0 0 var(--brand-signal)`
- **Table column headers** — mono caps, fontSize 10.5, letterSpacing 0.06em, uppercase. Cells default to `padding: 12px 16px`.

## When the prototype and the spec disagree

The **prototype JSX wins**. The MD docs are simplified explanations; the
JSX has every edge case (light/dark token swap, pulse animations, hover
states, etc.) wired correctly.
