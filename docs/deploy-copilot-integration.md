# Deploy and Copilot integration boundary

Deploy, project Deployments/Environments, and Copilot currently have no backing deployment or AI service in this repository. Their routes remain available as explicit “Not integrated” states. They do not represent an empty API result, verified environment health, or a configured provider.

- Deployment screens contain no fabricated environment inventory, versions, regions, release records, or rollout progress. Release, rollback, promotion, sync, and environment configuration controls are absent.
- Copilot contains no fabricated conversation history, model list, tool count, connected indicator, timed response, message composer, or share/archive action. Legacy `title` and `historyId` query parameters do not load or manufacture conversations and are not rewritten.
- Copilot drawer, command palette, quick actions, and breadcrumbs label the integration status explicitly. Drawer links close it and navigate to existing routes; close/Escape return to the current page.
- Existing Build, project pipelines/artifacts, and Agents routes remain accessible through real navigation. Their own authorization and data-loading behavior is unchanged.
- These screens do not collect credentials or send data to an external deployment or AI provider. No provider has been selected or configured.

## Decisions required before integration

### Deploy

1. Choose the deployment provider/target and the supported environment and release lifecycle.
2. Define authenticated, project-scoped backend contracts for inventory, release history, live state, and mutations. Define permission checks, approvals, audit records, and retry/idempotency rules for consequential actions.
3. Implement and verify actual lifecycle results before displaying success, health, rollout progress, or enabling release/rollback/promotion controls.

### Copilot

1. Choose an AI provider/model policy and decide what project data may be transmitted, retained, and disclosed to users.
2. Define authenticated conversation/history and response-streaming contracts, including cancellation, failures, and session ownership.
3. Define the allowlisted tools and authorization/confirmation requirements for each operation. Provider credentials belong in an approved server-side integration, not browser state.
4. Verify provider/model/tool availability from the backend before exposing a composer, model selection, tool counts, or connected status.

Regression coverage includes all unavailable routes, legacy chat URLs, project-scoped links, drawer dismissal/reopening/navigation, and accurate quick-action labels. No live provider or deployment test is claimed by these UI tests.
