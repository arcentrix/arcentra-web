# Whole-job new-execution acceptance boundary

This frontend implements the separate terminal whole-job rerun contract. It does not activate a server service. Missing, disabled or failed `/copilot/rerun-intents/availability` reads leave the controls hidden. Existing bound-retry approval and private history remain separate.

## Implemented browser behavior

- An explicit original job is checked against the selected project and original run using read-only eligibility. The model provider need not be configured.
- A deliberate Prepare creates one RequestID, stores only opaque recovery IDs in tab session storage before sending, and submits the exact snapshot digest. Storage failure blocks the first write.
- Confirm requires a new unchecked acknowledgement bound to the prepared intent's version, intent digest and reviewed run-context digest. The requester does not cast an approval vote.
- Lost responses, reload, focus changes, permission changes and failed reads clear protected review/consent. Recovery uses an owner/project/original-run-partitioned RequestID or IntentID. Inspection never prepares, confirms or cancels. There is no automatic mutation replay.
- Server-time-based expiry disables fresh confirmation. Durable confirmed receipts remain confirmed after the preparation deadline. Only server-observed non-prepared records offer a new deliberate review.
- Cancellation affects only the prepared intent. No target-cancellation control or success is fabricated. The original/new execution links use the existing authorized project pipeline workspace's `pipeline` and `run` query parameters.
- Expected source checkout SHA and definition revision are distinct. Commands, environment values, provider configuration, credentials, encrypted envelopes and nonces are neither displayed nor persisted.

## Real hosted journey required before activation

The coordinator must connect a separate real browser journey to the production full router and actual Control/MySQL/Agent fixture. The existing retry-budget browser case must remain intact. Simulated API tests, source assertions and component tests do not prove runtime acceptance.

1. Produce the original through the production verified-manual capture path with an encrypted prospective definition snapshot and captured RetryApprovalContext. Use one failed, terminal, supported whole-job container job. Shell steps followed by output uploads are allowed. Persist original run/job/approval/decision identities and row timestamps before the journey.
2. Authenticate the requester through the real login route. Load the Copilot page without a model provider. Check the selected original job's eligibility, verifying project/pipeline/run/job IDs, original failed statuses, snapshot digest, separate full definition revision and expected full source SHA.
3. Count GET eligibility separately from POST Prepare and POST Confirm. Confirm zero writes from eligibility, status observation and inspection. Prepare through the exact stable button name, record the returned reserved new Run/Job IDs and exact digests/version/createdAt/expiresAt, and require an unchecked acknowledgement before Confirm.
4. Move the source branch after the original snapshot. Explicit Confirm must create exactly the reserved target tuple while the original rows and approval stay unchanged. It must not approve or start user commands. Check the persisted initial/replay timestamps, new schedule/gate and one fixed target tuple in MySQL.
5. Authenticate a genuinely independent eligible candidate in a separate browser context through real login. Read and approve NEW evidence through the existing run approval dialog. Prove different new Claim/Approval/Decision IDs, requester self-approval denial, and zero user-command observation before that independent approval.
6. Run the real command, collect output and exact terminal result, and follow the browser's new execution link to its persisted jobs/steps/logs. Compare original and new execution IDs and verify the source checkout remains the exact full SHA despite branch movement. The initial rerun receipt alone only says “New execution created”; terminal success must come from the existing runtime view.
7. Preserve official Playwright Chromium, full-router current-identity checks, host/container budgets, process-group cleanup and same-source evidence. Record screenshots and network counts separately for Prepare, Confirm and approval.

## Required negative/interaction journeys

- Legacy or missing snapshot; active/successful source; multi-job; failed-step mode; upstream artifact input; secret references; nonempty Source.Auth; original context/run mismatch.
- Policy/candidate drift, version conflict, expiry and current permission revocation. Review and consent must clear, while an authorized minimal receipt may remain inspectable.
- Lost Prepare before IntentID is known; lost Confirm; tab reload; focus/navigation during mutation; double clicks and concurrent confirmations; repeated inspection with identical fixed targets and timestamps.
- Prepared cancellation wins before confirmation. Do not add post-confirm or claim-versus-cancel UI claims until an actual authorized target-cancellation endpoint exists.
- Wrong source/seal/new identity; same-Agent restart with unknown task state. Unknown is displayed without an implicit retry/start button.
- Stable role/name locators for section `Whole-job new executions`, article `Whole-job re-execution {intentId}`, and buttons `Prepare new execution`, `Confirm new execution`, `Inspect rerun request`, `Cancel prepared request`.
- At a 390px mobile viewport: no horizontal overflow, all acknowledgement text/IDs wrap, and each actionable control passes real pointer hit-target checks including the floating Copilot launcher.
