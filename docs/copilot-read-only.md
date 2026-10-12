# Copilot read-only analysis

The full page and drawer now call the authenticated, project-scoped Copilot backend. They list configured models only after a project/run is entered. No provider credentials are collected by the browser, no model is contacted by opening the page, and an unconfigured backend disables analysis with a clear explanation.

1. Enter a project ID and run ID and load authorized context choices.
2. Explicitly select up to four persisted step logs and/or three registered text-code artifact snapshots (8 KiB each). Whole repository browsing is not available.
3. Ask a question and preview the bounded redacted content locally.
4. Review the actual preview and approve sharing this question and selected context with the configured provider.
5. Submit one read-only analysis. The backend rechecks authorization and the preview digest before sending; changed evidence requires a new preview.

Requests contain only explicit source IDs, question, configured provider/model IDs and a content digest. No arbitrary file paths, endpoints, keys or tool definitions can be specified. Results are rendered as escaped plain text. Warnings identify truncated context/output; failures do not fabricate a response or automatically retry.

Changing project/run, source/model/question, or starting a new preview invalidates consent. Cancel, Close/Escape, navigation and unmount suppress stale results and abort pending requests. Active analysis additionally sends an authenticated cancellation request; it cannot recall data already transmitted or guarantee provider billing stops. If cancellation cannot be confirmed, the UI says so and explains the 45-second backend deadline. The backend's explicit cancel route requires the same instance as the analysis when multiple control-plane replicas are used.

No durable conversation/history service, model-driven retry/job replay, deployment or other tool action is implemented. Legacy `historyId`/`title` URLs stay intact but are not treated as real conversations.

UI tests use synthetic backend fixtures and do not establish live OpenAI/Anthropic connectivity. Operator setup, protocol references, bounds, redaction limitations and backend regression coverage are documented in the backend's `docs/copilot-read-only.md`.
