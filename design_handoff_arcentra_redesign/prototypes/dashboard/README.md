# Arcentra Dashboard — UI Kit

A pixel-fidelity recreation of the Arcentra web app, lifted from
`arcentrix/arcentra-web` (React 18 + Vite + shadcn/ui base). Recreated here
in plain React + Babel so it can be opened with no build step.

## What's in here

| File | Purpose |
|---|---|
| `index.html` | Loads React, the shared primitives, and the full app shell. Routes between Dashboard / Projects / placeholder pages with the AppDock. Includes ⌘K shortcut. |
| `AppDock.jsx` | Fixed-left navigation rail. Collapses to 56px, hover-expands to 180px after a 300ms peek delay, exactly like the production component. Active indicator is a 2px-wide pill on the left edge. |
| `TopBar.jsx` | Sticky top header with breadcrumb + ⌘K search trigger + utility buttons. Also exports `CommandPalette` — the overlay modal triggered by ⌘K. |
| `Dashboard.jsx` | Landing page: 3 metric rows + recent runs table + projects overview. |
| `Projects.jsx` | Projects list — search + filter + 3-column card grid. Clicking a card opens `ProjectDetail`. |
| `ProjectDetail.jsx` | **Per-project workspace** with 8 sub-tabs: Overview / Pipelines / Deployments / Artifacts / Environments / Secrets / Members / Settings. |
| `Build.jsx` | Workspace-wide pipeline list + selected pipeline detail. |
| `Deploy.jsx` | Environment cards + release history table. |
| `Agents.jsx` | Runner grid + cluster sidebar + selected runner detail. |
| `Chat.jsx` | **Copilot AI chat** — conversation sidebar + chat surface with tool-call cards, code blocks, sources. |
| `Observe.jsx` | SLO summary + latency chart + services table + alerts feed. |
| `Secure.jsx` | Tabbed access control: Overview / Users / Roles / Identity / Secrets / Audit. |
| `Settings.jsx` | Workspace settings — General / Notifications / Identity / System / API tokens. |
| `Account.jsx` | **Personal profile** (avatar menu) — Profile / Security / Sessions / Preferences / API tokens. |
| `Inbox.jsx` | **Notification center** — filter by All / Unread / Approvals / Mentions / Alerts / System. Inline Approve/Ack actions. |
| `LoginForm.jsx` | Centered login with email/password + GitHub + LDAP. |
| `_pages.jsx` | Shared `PageHeader`, `Panel`, `PanelHeader`, `FilterBar`, `StatusBadge`. |

## Try the prototype

Open `index.html` and:

- The **AppDock** auto-expands on hover (300ms delay), collapses on leave.
- Click any item to navigate. **Overview** and **Projects** are fully built;
  the rest show a documented placeholder pointing at the source path.
- Press **⌘K** (or `Ctrl K`) to open the command palette overlay.
- Inside the placeholder, click "Sign out" to drop into the **Login** screen,
  then sign in again to return.

## Coverage notes

Eight of the most-visited screens are fully recreated: Overview, Projects,
Build, Deploy, Agents, Observe, Secure, Settings. The live app has more
nested sub-routes (Project/Pipelines/:id, Project/Artifacts,
LLMDialogue/Chat, etc.) that aren't built here — read those from
`arcentra-web/src/pages/` when needed.

Auth, API calls, and toasts are all stubbed. The real app uses
`react-router-dom`, `react-hook-form`, `react-toastify`, and a Zustand store
(`store/auth.ts`, `store/user.ts`). Wire those in when you graduate from
prototype to production.
