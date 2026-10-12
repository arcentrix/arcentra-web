# Pipeline execution workspace

The Build page and project pipeline routes read real data from the control service. Project lists, project headers, and project overviews also use the project/pipeline APIs. The existing blueprint design language is preserved, with responsive panels instead of placeholder executions.

## Available flows

- Create a Git project with an organization ID, repository URL, and default branch. Repository credentials are deliberately not collected by these forms.
- Connect a pipeline definition already committed to a repository. Creating the definition does not execute it.
- Inspect/edit its JSON representation, validate it, and save with the repository head SHA for optimistic concurrency. Save follows the pipeline's configured direct/PR mode.
- Trigger a pipeline with optional string-valued JSON variables. Retries retain the same idempotency key until inputs change.
- Inspect paginated run history and filter by status. Selected pipeline and run IDs live in the URL for Back/Forward navigation.
- Poll run, job, step, and log snapshots while execution is active. Stop run/job polling after a known terminal status, and keep log polling for a bounded 15-second catch-up window for delayed final output. Manual Refresh remains available.
- Cancel a run with an explicit confirmation, inspect assigned agents, and read stdout/stderr-backed output. Long logs can be browsed per step using line cursors.
- View agent availability and navigate to existing agent details. Availability alone does not guarantee that a pipeline's label selectors match.

Mutation controls resolve effective permissions in the selected project or organization, including inherited grants, without replacing global workspace menus. All operations preserve API failures as visible errors. Aborted/stale reads cannot overwrite a newer route. A trigger/create response arriving after navigation does not take the user back to the old page. No mock data is used by these production flows.

## API contract

The client uses the existing `VITE_API_CLIENT_URL` base and session-aware Axios instance. Pipeline endpoints live under `/pipelines`, projects under `/project`, and agents under `/agent`.

Run detail, jobs, and logs use scoped paths:

- `GET /pipelines/:pipelineID/runs/:runID`
- `GET /pipelines/:pipelineID/runs/:runID/jobs`
- `GET /pipelines/:pipelineID/runs/:runID/logs?stepRunId=...&fromLine=...&limit=1000`

The jobs response is `{list, total}` with nested `steps`; logs are `{entries, truncated}`. Log line numbers are per step, so paging is enabled only with a selected step. Pipeline/run status numbers differ from job/step status numbers; the API adapter normalizes them separately. It accepts both legacy snake_case and protojson camelCase, including string-encoded integers and named enum values. Durations are milliseconds.

Project responses omit credentials and webhook secrets. No absent secret field is submitted as an empty update. HTTP 403 is an authorization error and no longer automatically clears the user's session.

## Verification

Use Node from `.nvmrc` and install the lockfile:

```sh
pnpm install --frozen-lockfile
pnpm test:run
pnpm lint
pnpm build
pnpm format:check
```

ESLint now uses the ESLint 9 flat config; `lint` is read-only and `lint:fix` is explicit. Existing hook-dependency warnings in unrelated legacy screens remain visible.

The browser regression uses only local test fixtures and is not a real control/agent integration test:

```sh
pnpm exec playwright install chromium
pnpm test:ui
# Or use an existing local Chromium binary:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:ui
```

`test:ui` starts a local Vite server on port 5174, mocks API responses in the browser, and exercises run dismissal/start/cancellation, definition validation/save, loading and error recovery, narrow-screen overflow, and project navigation/back. Screenshots are named `*-fixture.png` and written to `/tmp/arcentra-web-ui` (override with `UI_TEST_OUTPUT_DIR`). Set `UI_TEST_BASE_URL` to test an already-running local server.

In a restricted executor, Chromium may be unable to create a Unix socket. That is a blocked browser test, not a pass; run it in a compatible development/CI environment. Unit/component tests do not depend on a browser binary.

Other product areas such as Deploy, Dashboard, Artifacts, and Environments remain outside this execution integration and may still contain their existing prototypes.

Build-log transport can replay delayed output after a network outage or process restart. A terminal run is not a guarantee that all output has arrived. The detail view retains its final catch-up window and manual Refresh, and now explains delayed replay after that window. The backend persists redacted output in a bounded private spool; failed local acceptance is reported as a failed step rather than silent log loss.
