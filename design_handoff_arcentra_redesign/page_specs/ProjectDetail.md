# Page spec · ProjectDetail (per-project workspace)

**Route:** `/project` (with projectId held in app state, OR `/projects/:id` in production)  
**Reached from:** Click a project card on `/projects`  
**Reference prototype:** `prototypes/dashboard/ProjectDetail.jsx`  
**Mirrors source:** `arcentra-web/src/pages/Projects/Detail/*` + `src/pages/Project/*` (the entire nested route tree)

## Major restructure

The current production code has the project sub-routes scattered across:
- `pages/Project/Pipelines/index.tsx`
- `pages/Project/Pipelines/Detail/`
- `pages/Project/Pipelines/History/`
- `pages/Project/Deployments/`
- `pages/Project/Artifacts/`
- `pages/Project/Environments/`
- `pages/Project/Secrets/`
- `pages/Project/Settings/`
- `pages/Project/Members/`

**The redesign consolidates these into a single ProjectDetail page with 8 tabs:**
**Overview / Pipelines / Deployments / Artifacts / Environments / Secrets / Members / Settings.**

These don't need to be separate route components in the redesign; they're tab panels inside one page.

## Header region

```
[← Projects]
▸ PROJECT / TYPESCRIPT
web-app
Customer-facing web client
arcentrix/web-app · maintained by @e.chen      [Run pipeline] [Deploy]
```

```jsx
<div>
  {/* Back link */}
  <button onClick={onBack} style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 8px", borderRadius: 6,
    background: "transparent", border: 0, cursor: "pointer",
    color: muted, fontSize: 12,
  }}>
    <Icon d={I.arrowLeft} size={12} />Projects
  </button>

  <div style={{ display: "flex", alignItems: "flex-end",
                justifyContent: "space-between", gap: 16, marginTop: 8 }}>
    <div>
      <Eyebrow>project / {lang.toLowerCase()}</Eyebrow>
      <h2 className="display" style={{ fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.03em", margin: "8px 0 0" }}>{name}</h2>
      <p style={{ fontSize: 13, color: muted, marginTop: 6 }}>{desc}</p>
      <div style={{ marginTop: 12, display: "flex", gap: 14,
                    fontFamily: mono, fontSize: 11.5, color: subtle }}>
        <span><Icon d={I.github} size={11} /> {repo}</span>
        <span>·</span>
        <span>maintained by <span style={{ color: muted }}>@{owner}</span></span>
      </div>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <Button variant="outline" leftIcon={<Icon d={I.play} size={13} />}>Run pipeline</Button>
      <Button variant="primary" leftIcon={<Icon d={I.rocket} size={14} />}>Deploy</Button>
    </div>
  </div>
</div>
```

## Tab strip

Same pattern as Secure. 8 tabs:

```js
[
  { id: "overview",     label: "Overview" },
  { id: "pipelines",    label: "Pipelines",    count: 12 },
  { id: "deployments",  label: "Deployments",  count: 47 },
  { id: "artifacts",    label: "Artifacts",    count: 318 },
  { id: "environments", label: "Environments", count: 3 },
  { id: "secrets",      label: "Secrets",      count: 14 },
  { id: "members",      label: "Members",      count: 11 },
  { id: "settings",     label: "Settings" },
]
```

⚠️ The strip allows `flexWrap: wrap` because 8 tabs can overflow narrow viewports.

## Tab bodies — at-a-glance

| Tab | Layout |
|---|---|
| Overview | 4-card stats row + 2-col split (recent activity / readme card) |
| Pipelines | Single Panel with table — columns: Name / Trigger / Schedule / Last run / Status / Total runs |
| Deployments | Single Panel with table — columns: Version / Env / Status / When / By / Strategy |
| Artifacts | Single Panel with table — columns: Name / Tag / Type / Size / SHA / Pushed |
| Environments | 3-col grid of env cards (same pattern as global Deploy page) |
| Secrets | Single Panel with table — columns: Key / Description / Scope / Rotated |
| Members | Single Panel with table — columns: User (avatar) / Role chip / Since / Action |
| Settings | Single Panel with FormRow rows + Danger zone |

See prototype JSX for exact column content. All tables use the shared mono-caps header treatment.

## State management

```jsx
const [tab, setTab] = useState("overview");
```

In production code, use `useSearchParams` so tab selection is URL-shareable: `/projects/web-app?tab=members`.

## Project meta data

The prototype hardcodes a 6-project lookup table. In production this comes from the API. The lookup keys (name, desc, lang, repo, owner) cover the minimum required to render the header.
