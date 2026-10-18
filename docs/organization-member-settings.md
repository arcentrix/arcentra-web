# Organizations, scoped members, and project settings

This slice replaces the organization placeholders and read-only member/settings views with versioned server-backed operations. It does not add secrets, Inbox history, invitations, or automatic adoption of legacy role-grant scopes.

## Navigation and scope

- Open **Organizations** in the top command bar for the permission-filtered real organization directory, create flow, metadata, and memberships.
- Accessible records distinguish explicit membership from access through other grants. Arbitrary legacy scope IDs are never promoted into records or memberships.
- Existing project creation still accepts an administrator-approved organization scope. The organization directory link explains where real records are managed.
- Project **Members** and **Settings** retain direct URLs and Back/Forward navigation. Reads, drafts, and pending callbacks are isolated by authenticated user/token and routed resource.

## Server-backed mutations

- Organization creation creates a real record; updates include the latest numeric version and omit its immutable name. Archive is a versioned DELETE and is blocked when active enabled projects remain. This slice has no organization restore.
- Member forms accept an existing user ID. Offered roles come only from the server's assignableRoleIds. Protected creation owners have no edit/remove controls. Member updates/removals carry numeric versions and only affect their explicitly managed association/grant. Other direct, team, or inherited access may remain.
- Project settings use GET/PATCH /project/:id/settings and explicit POST /settings/archive or /settings/restore. The opaque version is never synthesized. Editable fields are displayName, description, defaultBranch, tags, language, framework, and visibility metadata. Repository URL, credentials, scope, and stable name are not editable.
- Visibility labels are metadata, not access changes. Project archive stops new admission and does not cancel or roll back executing effects.
- In-flight writes are synchronously single-submit; Cancel/Close are blocked until completion. Browser navigation is allowed and late callbacks cannot navigate or repopulate the abandoned screen. Live denial hides/revalidates stale data. Conflicting metadata drafts remain visible until explicit reload or Cancel; no write is retried automatically.

## Verification

Run pnpm test:run, pnpm test:browser:harness, pnpm typecheck, pnpm lint, pnpm format:check, and pnpm build.

The simulated UI journey remains separate from real backend acceptance. The original honesty assertions still reject fabricated inventories and unsupported actions on Inbox/secrets. Member/settings assertions now compare real scoped DTO fields and exact capability-gated controls.

For disposable real-backend build acceptance, set ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY=1 and ARCENTRA_ACCEPTANCE_MEMBER_USER_ID to an existing synthetic observer's user ID. The browser journey performs organization CRUD, both scoped membership/role flows, project metadata editing, archive/restore, and the active-project organization-archive conflict. Its public summary contains only the fixed journey identifier, bounded synthetic organization/project IDs, completed flag, and fifteen allowlisted verified steps. It does not log in as the observer or create platform grants.

Browser execution requires the repository's official Playwright environment; passing unit or harness-contract checks alone is not a browser pass.
