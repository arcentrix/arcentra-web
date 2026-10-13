# Project artifact workspace

The project Artifacts tab loads persisted run outputs from the control API. No sample rows, synthetic tags, checksums, timers or console-only downloads remain in this production page.

## Behavior

- The authenticated list endpoint filters metadata by each pipeline's `pipeline:read` grant, including pipeline-only grants. The UI does not require a broader project-level pipeline grant. Downloads reauthorize the individual artifact on the server.
- Name substring, exact run ID, status and page live in the URL. Apply filters resets to page 1; Back/Forward restores previous filters and pages. Filtering and pagination happen on the server.
- The table displays stored names, source-run links, byte sizes, storage types, creation dates, availability and retention/unavailability information. Legacy records explicitly marked `sizeKnown: false` display “Unknown.” No checksum or version is invented.
- Refresh makes a new API request. Loading, empty results, missing permissions and failures are visible; failures can be retried. Refresh failures hide stale rows, including authorization failures. An empty later page offers a route back to the first page.
- Download requests use the existing API base URL, bearer/session credentials and cancellation signals. The server streams the attachment; the browser saves the returned bytes using a sanitized basename. No storage URL or object key is navigated to. Binary JSON errors remain visible, and a successful response must contain `Content-Disposition: attachment` before anything is saved.
- Repeated download clicks are locked while a request is active. Leaving the page, switching projects or changing the current query aborts it and prevents late responses from saving an obsolete download. List requests also ignore aborted and late responses.

## HTTP contract

Both endpoints are relative to `VITE_API_CLIENT_URL`, normally `/api/v1`.

```
GET /projects/:projectID/artifacts?page=1&pageSize=20&name=report&runId=run-1&status=available
GET /projects/:projectID/artifacts/:artifactID/download
```

List uses the standard `{code: 200, detail: {list, total, page, pageSize}}` envelope. Status values are `available`, `expired`, and `unavailable`. IDs are encoded path segments. The binary response supplies a filename using Content-Disposition; cross-origin deployments must expose that header. Download errors use non-2xx HTTP status and JSON errors, including 404 for inaccessible/nonexistent records, 410 for expired outputs, and 409 for unavailable outputs.

An empty registry is shown honestly. Historical outputs without captured metadata are not replaced with fabricated rows. Availability is rechecked by the backend when downloading; an available listing cannot guarantee a file still exists later.

## Verification

```
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

Component tests cover pipeline-only grants and endpoint authorization/retry, server loading/error/retry/empty states, server-side filters and paging, history restoration, newer project reads winning over late responses, repeated refresh/download clicks, missing/expired outputs, unknown sizes, download errors, and cancellation on project/filter/page navigation. API tests verify actual binary responses, encoded IDs, filename safety, object URL cleanup and rejection of non-attachment responses.

The existing `pnpm test:ui` browser fixture now also exercises artifact filters, pagination/history, real browser attachment bytes, responsive overflow, refresh, empty/error/retry and access recovery. These are fixture-driven browser tests, not evidence of a live storage/control integration. Browser execution must occur in an environment that permits Chromium sockets; this restricted executor's previously denied browser route was not retried or bypassed.

The official Chromium CI jobs and distinct simulated-transport versus real-Control/Agent journey contracts are documented in [Browser acceptance](browser-acceptance.md).
