# Browser acceptance

There are two deliberately separate browser checks. Both use the official Chromium revision bundled with the exact Playwright version in `pnpm-lock.yaml`. Neither uses production accounts, credentials, repositories, storage, model providers, or deployment targets.

## Simulated API transport regression

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:browser:harness
pnpm test:ui
```

The `Chromium UI (simulated API transport)` GitHub Actions job runs on `ubuntu-24.04`, on ordinary `pull_request` and main-branch push events. Its permissions are `contents: read`, its checkout does not persist credentials, and it does not read secrets or use `pull_request_target`. Pinned official actions upload seven-day-retention synthetic screenshots and a strictly allowlisted summary even when the test fails. Login/password inputs are masked in failure screenshots. Raw console/HTTP diagnostics, HTML, Vite logs and credential-bearing traces are never uploaded. Tracing is disabled.

This is a real-browser regression of UI behavior with **simulated API responses and a seeded synthetic session**. It is not a backend integration or end-to-end execution claim. It covers run dismissal/start/cancel, definition validation/save UI, project navigation and browser history, desktop/mobile layouts, artifact filter/paging/download bytes, empty/error/retry, and authorization recovery. Every API route must be handled explicitly; an unexpected request fails instead of receiving a permissive empty success response.

Artifact controls are checked at 390×844, 320×568, and 1440×1050. Pointer hit tests cover button centers and edges before ordinary, unforced clicks on Refresh, pagination, download, and Copilot. The suite also checks the reserved mobile Copilot row, long single-line run IDs, Copilot close/reopen/Escape, and table-only horizontal scrolling. Desktop bottom spacing keeps the last controls clear of the floating launcher.

## Actual backend / Agent journey

The backend repository's disposable acceptance runner owns service setup and teardown. It must start real Control and Agent binaries, MySQL, Redis, Kafka, MinIO artifact storage and a local Git daemon, initialize/register the synthetic account, and bootstrap its platform-admin role. After services and the Agent are ready, it invokes this command **with the frontend repository as its working directory**:

```sh
pnpm test:acceptance
```

Required environment:

- `ARCENTRA_ACCEPTANCE_BACKEND_URL`: `http://127.0.0.1:18080` (an origin, not `/api/v1`)
- `ARCENTRA_ACCEPTANCE_REPO_URL`: e.g. `git://127.0.0.1:19418/acceptance.git`
- `ARCENTRA_ACCEPTANCE_ORG_ID`: synthetic org scope, e.g. `ci-acceptance-org`
- `ARCENTRA_ACCEPTANCE_ARTIFACT_NAME`: real Agent output basename, e.g. `acceptance.txt`
- `ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT`: exact expected UTF-8 bytes, including the final newline when the fixture writes one

Optional environment:

- `ARCENTRA_ACCEPTANCE_COMMIT`: expected full Git commit SHA, asserted against the reviewed definition and initial checkout
- `ARCENTRA_ACCEPTANCE_BRANCH`: defaults to `main`
- `ARCENTRA_ACCEPTANCE_DEFINITION_PATH`: defaults to `.arcentra/pipeline.yaml`
- `UI_TEST_OUTPUT_DIR` or `ARCENTRA_ACCEPTANCE_EVIDENCE_DIR`: screenshots, allowlisted `summary.json`, local-only diagnostics and `journey.json` output directory
- `PLAYWRIGHT_BROWSERS_PATH`: official browser installation location, particularly when the runner isolates `HOME`
- `UI_TEST_BASE_URL`: an already-running loopback frontend; normally omit it so the harness starts and stops Vite itself on `http://127.0.0.1:5174` with the actual backend proxy

The synthetic fixture account is fixed to `ci-admin` / `Ci-Only-Password-123!`. No arbitrary credentials or saved browser profile are accepted. The bootstrap org scope reflects the current MVP: the project service accepts a nonempty administrator-provided scope; this is not a test of implemented organization onboarding.

The committed build-only definition must clone its source from the same local repository, verify a committed marker, produce/upload the expected artifact, and emit `arcentra-real-stack-acceptance` into its real execution logs. The actual browser script:

1. Logs in through the visible form and real login endpoint.
2. Dismisses project/pipeline/run dialogs without creating anything.
3. Creates a project and pipeline through their forms.
4. Reviews the actual repository definition, requires a full commit SHA and explicit `deploymentPlan: null`, then triggers exactly one run.
5. Observes real backend polling until success, checks persisted logs and Agent-reported initial source checkout.
6. Reloads the run page, filters the artifact list by its real run ID, and verifies the downloaded filename and exact bytes.
7. Checks artifact control hit targets and repeats real refresh/download at both mobile sizes and desktop, then signs out and back in and reopens the persisted run deep link.

There is no API response fulfillment, token injection or fallback to simulated transport in this mode. The browser's network safety guard passes allowed same-origin requests unchanged and aborts off-origin requests. The Vite proxy targets only the explicit numeric-loopback backend. Missing prerequisites, unexpected HTTP/console errors, forbidden remote requests, terminal run failure, or timeouts fail the test. The top-level `summary.json` status is the authoritative browser-test outcome; `journey.json` records which steps completed before any failure.

The job uses only disposable synthetic data. Tracing is disabled, and uploads are restricted to screenshots plus the allowlisted count/status summary. Raw browser diagnostics and Vite output remain local to the runner. Do not point this harness at real accounts or production services. Build/artifact success does not establish Kubernetes, approval, OAuth, or model-provider readiness. Those need their own explicit dependency/target acceptance.

## Verification limits

A syntax check, the Node harness unit checks, or jsdom component tests do not establish browser acceptance. Browser jobs must actually run successfully on an environment permitting Chromium sockets. No local browser attempt is made in a restricted executor where that route was denied. CI results for the exact candidate commit must be reviewed before reporting browser or actual-backend acceptance as passed.

Official installation and CI guidance: [Playwright browsers](https://playwright.dev/docs/browsers) and [Playwright CI](https://playwright.dev/docs/ci).
