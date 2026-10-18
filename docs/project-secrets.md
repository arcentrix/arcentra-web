# Project Secrets management

The project Secrets page uses only `/api/v1/project/:projectId/secrets` and its scoped metadata, rotate, and disable endpoints. Existing values and ciphertext are never requested or rendered. Creation sends a new value once. Metadata editing sends only description and the exact opaque version; rotation is a separate explicit operation. Name, type, and project identity are immutable.

The complete inventory is limited to 1,000 records, including disabled secrets. At the limit, creation is blocked while existing enabled secrets remain manageable. Descriptions allow up to 4,096 Unicode code points; new values allow up to 65,536 UTF-8 bytes and reject NUL, invalid Unicode, blank values, and configured/redacted/masked placeholders.

The complete bounded inventory returns live `secret:write` / `secret:delete` capabilities, project/organization lifecycle, and encryption readiness. The UI explains each blocker and hides all prior secret metadata after a denied or unverified request. Mutations require the observed version and are never automatically retried. After a network failure, refresh before retrying because the server may already have applied the change.

All value controls are transient and clear at submission, cancellation, dialog close, identity change, or revalidation. Password/token/env values use native password controls. SSH keys use a masked multiline control only when the browser confirms support; unsupported browsers fail closed. No reveal/copy actions or local/session-storage persistence are provided. Returned errors are redacted before they reach logs, toasts, or the page. Secret descriptions are ordinary readable metadata and must not contain credentials.

Rotation and disabling affect later secret resolution. Already queued or running jobs, and their already-approved retries, may retain old values. New unqueued jobs and approval releases recheck pinned versions and fail closed if they changed. Disabled secrets cannot be re-enabled in this milestone. Created/updated timestamps and opaque versions are metadata, not a separate audit-history feed.

## Verification

- `pnpm test:run`: API validation, exact scoped payloads, version conflicts, permissions/readiness/lifecycle, form cancellation, identity changes, late-response safety, and write-only value handling.
- `pnpm test:browser:harness`: strict synthetic transport, evidence allowlists, phase/input validation, and value-exposure guards.
- `pnpm test:ui`: official Chromium synthetic transport journey, keyboard dismissal, creation, metadata preservation, rotation, disabling, reloaded metadata, mobile layout, key/permission/lifecycle blockers, CAS conflict, revoked writes, and denied reads.
- Actual backend acceptance optionally enables the same browser journey when both `ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE` and `ARCENTRA_ACCEPTANCE_SECRET_ROTATED_VALUE` are present in the build phase. Values must be distinct and match `synthetic-ci-secret-[A-Za-z0-9_-]{12,80}`. Setup phases reject them. The browser leaves `CI_BUILD_TOKEN` active and `CI_DISABLED_TOKEN` disabled; the runner independently verifies Agent consumption and log redaction.

The public `projectSecrets` summary contains only `journey`, `completed`, `projectId`, `activeSecretId`, `disabledSecretId`, and allowlisted `steps`. Values, ciphertext, request bodies, and error bodies never enter evidence. Screenshots are taken only with closed or empty secret forms; populated private fields also block failure screenshots.
