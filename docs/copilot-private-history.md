# Private Copilot history and review-only plans

This UI supports the optional private-history API. History is disabled unless the
server explicitly reports both `historyEnabled: true` and `historyAvailable:
true`. A configured model is not required to read existing history. Creating a
conversation is a separate visible action acknowledging 30-day encrypted body
retention. Missing managed encryption blocks the private flow before sending.
The UI never falls back from a failed saved request to ephemeral analysis.

The existing ephemeral flow remains available and is labelled **not saved**.
No question, answer, preview, patch, consent, or history selection is stored in
localStorage or sessionStorage. The existing authentication store remains
unchanged. Changing authenticated identity remounts the console; project/run
changes, navigation and drawer dismissal abort pending UI requests and reset
consent. Closing a drawer does not delete a saved conversation.

## Transmission and recovery

Only checked completed, available turns from the current conversation can be
included in a new model request. Checkbox selection order is transmission order.
At most six pairs and 8 KiB of historical text can be selected; whole pairs are
never silently truncated. A history-only follow-up requires an explicit
selection. The user must review the complete server-generated preview and check
fresh consent. Any relevant edit invalidates the preview. Reopening history,
loading plans and refreshing never sends to the model.

Unconfirmed HTTP results show an honest uncertainty state. The saved request can
be read through `/requests/:requestID`; no resend or execution retry is automatic.
Cancellation is best effort and cannot recall transmitted data or guarantee that
provider billing stops. Private API failures clear previously displayed content
and selection, including after permission revocation. Reads revalidate current
scope; focus and explicit refresh reload rather than trusting a browser cache.
Unavailable/expired bodies remain unavailable, even if another field happens to
contain text. Local expiry also removes displayed content without requiring a
new request.

## Plans

Encrypted plan payloads, including separately submitted patches, have a retention
expiry no later than 24 hours or the parent turn retention expiry. Earlier dependent
evidence expiry makes content unavailable on access; bounded maintenance erases
ciphertext after the row retention deadline. Reviewing does not renew retention,
and plan payloads are not copied into the 30-day question/answer history.

The fixed proposal kinds are code patches, new-run review, existing retry approval
review and deployment review. All say **Not executed**. Proposal review records a
version/digest-bound human review only. Proposal cancellation does not cancel a
pipeline, retry approval or deployment. There are no execute, approve, apply,
retry or deploy buttons in Copilot.

Code patches use one explicitly selected earlier evidence file. The server must
re-read and verify the exact base; the browser never applies a patch. Artifact
patches are labelled **Snapshot patch; repository destination unverified**.
New-run proposals label a last-saved definition revision honestly and require
current definition/input revalidation in the existing pipeline flow. They do not
claim terminal-step resume. Model prose, HTML, diffs, URLs and tool-like text are
escaped inert text. Navigation links are assembled only from verified scoped
server IDs and fixed existing application routes, never model URLs.

## Verification

- `pnpm test:run`: component/API tests include private creation, unavailable keys,
  provider-independent reads, ordered history, bounds, fresh consent, account and
  project changes, stale responses, revoked access, unknown outcomes, failed
  cancellation, deletion races, expiry, inert diff text and review-only plans.
- `pnpm test:browser:harness`: includes the actual history contract and receipt
  guard tests.
- `pnpm test:ui:copilot-history`: strict simulated-transport Chromium fixture,
  including mobile, drawer reopen and rejected revalidation. This is explicitly
  not real Control or MySQL acceptance.
- `pnpm test:acceptance:copilot-history`: real login and real Control with a
  disposable MySQL-backed fixture, in `create` and `resume` phases. It never seeds
  sessions or substitutes API responses. The caller supplies the bounded
  `ARCENTRA_COPILOT_HISTORY_CONTRACT` plus the existing actual-backend harness
  configuration. The create phase saves two turns, explicitly reuses the first
  pair, and records a review-only new-run plan. The resume phase compares exact
  question/answer hashes and plan bindings after Control restart, with no model
  send or product mutation. A completion receipt is written only after strict
  browser diagnostics and teardown pass.

A missing browser binary, missing real stack or absent fixture is a failed or
unrun gate, not a simulated success. Run the real fixture in its supported hosted
workflow; never weaken production transport restrictions or browser sandboxing
for tests. The backend independently proves encryption, owner/live-scope
isolation, retention, one-attempt dispatch and zero execution side effects.
