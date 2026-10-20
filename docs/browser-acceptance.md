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

The `container-failed-step-draft` stage checks only the retry editor in the simulated Definition dialog. It covers enabled container failed-step retry with explicit idempotency, 2–5 attempts and distinct allowlisted exit codes; successful-step and partial-write preservation warnings; one continuously live session, no rollback/restart resume, and no background-process survival guarantee. The expanded editor is checked at 320×568 and 1440×1050 for document horizontal overflow, retained warning text and an unforced trial click on Apply after scrolling it into view; the prior viewport is restored. Applying or removing retry changes only the JSON draft. Opening the editor, changing fields, rejecting invalid inputs and inspecting blocked policies must preserve the exact authored text; the fixture also asserts no save, run, cancel or approval request is caused by draft controls.

Container failed-step policies with any approval gate, including the exact durable retry-approval gate, or a continued step (`continueOnError` / `continue_on_error`) remain blocked and unchanged until an explicit edit. Off removes only retry. Unknown authored scopes remain visibly unsupported; exact durable approval remains available for whole-job retry. This UI coverage does not establish a working retry runtime or grant operator capabilities. Backend/Agent acceptance and the separate default-off capability flags are required before execution.

Artifact controls are checked at 390×844, 320×568, and 1440×1050. Pointer hit tests cover button centers and edges before ordinary, unforced clicks on Refresh, pagination, download, and Copilot. The suite also checks the reserved mobile Copilot row, long single-line run IDs, Copilot close/reopen/Escape, and table-only horizontal scrolling. Desktop bottom spacing keeps the last controls clear of the floating launcher.

Run filtering waits for the exact run-scoped GET response and the rendered matching list before download. Actual downloads require one ordinary click, an HTTP 200 response from the specific artifact endpoint, and browser-saved bytes; there is no retry. The safe summary records only numeric download request/response/success/HTTP-error/failed-request counts to distinguish absent download requests from HTTP/network or browser-save failures. The simulated suite includes a delayed filtered response.

### GitLab polling setup fixture

The `polling-fixture.mjs` section of the simulated transport suite exercises the project-only polling panel: read-only refresh, review/dismissal without a write, non-executing baseline before separate enable, current candidate permissions, explicit selections across five pages (101 readable candidates), mobile enable review, disabled state, replacement-baseline discard acknowledgement and 409 recovery without automatic mutation retry. The fixture asserts exact revision/baseline/selected-ID request bodies and the distinction between saved observation, configured definition and actual Agent checkout. It also displays a completed observation with zero event/ref matches without a build-success claim.

These are synthetic frontend assertions. They do not establish a real GitLab scan, baseline completeness, polling admission, revocation fencing, Agent execution, historical replay or cross-webhook deduplication. Actual polling setup requires a separate supported integration and real backend acceptance. Component tests additionally cover stale reads, cross-project navigation, duplicate submission, in-flight dismissal, permission/eligibility errors, restricted summaries and enabled streams with unresolved execution evidence.

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

- `ARCENTRA_ACCEPTANCE_PROFILE`: omit for the default loopback repository fixture. The disposable application-image runner sets exactly `image-build-v1`, which requires exactly `git://git:9418/acceptance.git` for `ARCENTRA_ACCEPTANCE_REPO_URL` on its private Docker bridge. No other profiles or repository URL variants are accepted in image mode. UI and backend URLs remain numeric loopback in both modes; all build, compile-failure and download assertions remain unchanged.
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

### Existing retry-approval confirmation lane

The older actual-browser retry-vote fixture intentionally leaves the separate terminal whole-job new-execution capability disabled. Loading Copilot context still performs its read-only availability probe. This journey requires that exact same-origin GET to return the production default-off 503 envelope with `private, no-store`, and requires the new-execution controls to remain absent. Only its single native Chromium resource error is expected, correlated after browser close and console drain to exactly one request and one 503 response with no failed transport. Duplicate or late errors, altered envelopes, other endpoints and failed approval confirmations remain failures. The permanent approval POST must still succeed once, reach the exact durable decision and observe generation-two runtime success. This is not response-loss coverage; the independent terminal-rerun journey retains its real response-loss and reload-recovery requirements.

## Verification limits

A syntax check, the Node harness unit checks, or jsdom component tests do not establish browser acceptance. Browser jobs must actually run successfully on an environment permitting Chromium sockets. No local browser attempt is made in a restricted executor where that route was denied. CI results for the exact candidate commit must be reviewed before reporting browser or actual-backend acceptance as passed.

Official installation and CI guidance: [Playwright browsers](https://playwright.dev/docs/browsers) and [Playwright CI](https://playwright.dev/docs/ci).


## Terminal rerun owner and response-loss follow-on

The isolated terminal-rerun acceptance extension preserves the existing runtime opt-ins, clean exact frontend checkout pin, same-origin firewall, disposable credentials, and original process/fixture deadlines. It changes acceptance scripts only, not the application or runtime gates. Its workflow frontend pins are deliberately unchanged until the paired follow-on candidate is separately reviewed.

The `prepare` phase deliberately withholds each real successful Prepare and Confirm response at Chromium's response boundary, before the page receives its body. It validates the real bounded response privately, reloads the actual page to abort that request, requires the correlated aborted request, still-pending UI and no completed response, and then uses the visible original-owner Inspect control. Lost Prepare recovers by the RequestID the application saved before its POST; lost Confirm recovers by the same IntentID learned through inspection. Reload and Inspect may send no additional mutation. Consent is absent after reload and must be deliberately checked again before the one Confirm POST. No response is fulfilled, no backend action is mocked, and no recovery ID/session is injected by the test.

A separate `owner-outcome` phase starts a fresh browser with a real login as the original owner, not either reviewer. It reads the original failure and unchanged public job evidence, the same new execution's successful steps/source/logs, and one exact artifact download. It cannot vote, Prepare or Confirm. The independent second-reviewer phase remains mandatory and retains the two-person approval evidence. Owner output does not claim approval/claim evidence it did not inspect, nor overall runtime acceptance.

Hosted proof requires all three phase summaries/receipts plus the Go-owned runtime receipt and parent test/cleanup PASS. The preparation receipt must show one Prepare POST, one Confirm POST, both responses withheld, two reloads and one read-only inspection per loss. Go independently checks persisted identities/row counts, no early command execution, final exact runtime/S3 counts, original immutability and final dispatcher/queue drain. The owner receipt must match the reviewer and Go artifact ID/hash and original/new identity, with zero mutations. Node helper/contract tests are offline lifecycle checks, not proof that Chromium interception, production Control, containerd or storage worked. Until the exact follow-on pair passes hosted acceptance, both added browser journeys remain unverified.
