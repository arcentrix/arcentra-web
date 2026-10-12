# Copilot read-only analysis

The full page and drawer now call the authenticated, project-scoped Copilot backend. They list configured models only after a project/run is entered. No provider credentials are collected by the browser, no model is contacted by opening the page, and an unconfigured backend disables analysis with a clear explanation.

1. Enter a project ID and run ID and load authorized context choices.
2. Explicitly select up to four persisted step logs, three registered text-code artifact snapshots (8 KiB each), and/or three repository source files when the project has that capability enabled. Source files alone are sufficient; selecting logs or artifacts is not required.
3. Ask a question and request the bounded, redacted preview. The server can fetch explicitly selected source files at this step, but does not send the preview to a model.
4. Review the actual preview and approve sharing this question and selected context with the configured provider.
5. Submit one read-only analysis. The backend rechecks authorization and the preview digest before sending; changed evidence requires a new preview.

## Selected repository files

Repository source context is default-off and project-scoped. When an operator enables it, choose an available job from the bounded run context list, type an exact repository-relative path, and explicitly add it to the selection. There is no file browser, repository enumeration, workspace reader, or arbitrary URL input. Loading choices or typing a path does not fetch file contents or contact a model.

The server resolves the repository and full initial-checkout commit from that job's authenticated provenance and approved project configuration. Only supported GitHub.com HTTPS repositories with public or configured token access are eligible. Older jobs without usable reported checkout provenance, unsupported repositories/authentication, and mismatched project sources remain unavailable with an explanation. The interface does not invent a connection, source identity, or commit.

This is the Agent-reported initial checkout. It is not a current workspace snapshot or a build attestation: steps may have modified the workspace after checkout. Both the preview and analysis evidence show the job, repository, requested ref, reported initial commit, exact path, and Git blob identity returned by the server.

Source selections contain only `context.sourceFiles: [{jobRunId, path}]`. The browser never supplies repository URLs, commits, credentials, endpoints, or tool definitions. Empty source selections omit this new field so legacy servers can still handle logs and artifacts. Missing source-capability fields disable source selection.

Each selected file is limited to 8 KiB of eligible UTF-8 text. Paths are bounded to 512 UTF-8 bytes and eight components, with a supported source/text extension or Dockerfile/Makefile name. The UI rejects traversal, hidden paths, control characters, credential-related names, URLs, escapes, query strings, and fragments. These are convenience checks; the server remains authoritative for authorization, ownership, provenance, path safety, regular-file type, content bounds, and immutable identity. Symlinks, submodules, binaries and Git LFS pointers are not source-file context.

## Review, consent and cancellation

Requests contain explicit context selections, the question, configured provider/model IDs, and the preview digest. Review both the actual redacted text and its evidence before approving sharing with the named provider. Known-secret redaction is bounded and is not a guarantee that all private information was removed. Results and metadata are rendered as escaped plain text. Warnings identify truncated context/output; failures do not fabricate a response or automatically retry.

Changing project/run, provider/model, question, log range, any selected context, source job, or typed path invalidates the preview and consent. Cancel, drawer Close/Escape, route navigation and unmount suppress stale responses and abort pending requests. Active analysis additionally sends an authenticated cancellation request; it cannot recall data already transmitted or guarantee provider billing stops. If explicit cancellation cannot be confirmed, the UI says so and explains the 45-second backend deadline. Reopening the drawer does not restore source selections, prepared context, consent, or results.

Source preview digests include a random per-instance keyed binding, and request cancellation uses process-local server state. Route preview, analysis and cancellation for a user to the same control-plane instance when using multiple replicas. A restart, a different instance, or changed evidence requires a fresh preview and renewed consent; it must not silently send stale context to a provider. There is no persisted preview registry or time-based preview expiry. Analysis rechecks current authorization, repository configuration, credentials, provenance, secrets and file content before comparing the exact digest. Source previews have a 15-second operation timeout and concurrency limits of 16 globally and two per user.

No durable conversation/history service, model-driven retry/job replay, deployment or other tool action is implemented. Legacy `historyId`/`title` URLs stay intact but are not treated as real conversations.

UI tests use synthetic backend fixtures and cover source-only and mixed selection, limits, unavailable jobs, unsafe paths, provenance display, explicit consent, legacy request shape, stale async responses, scope changes, Close/Escape and Back/Forward/app navigation. They do not establish live GitHub or OpenAI/Anthropic connectivity, real SCM credentials, or a browser acceptance test. Operator setup, protocol references, bounds, preview binding, redaction limitations and backend regression coverage are documented in the backend's `docs/copilot-read-only.md`.
