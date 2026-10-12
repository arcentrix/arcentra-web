# Deploy and Copilot integration status

The earlier unavailable-only placeholders have been replaced by bounded backend integrations in this change set.

- Copilot now supports server-configured OpenAI-compatible and Anthropic adapters, authorized run-log and registered text-code artifact selection, a redacted local preview, per-request data-sharing approval, one read-only analysis and cancellation. It remains unavailable until an operator explicitly configures provider credentials, models and project scope. See [Copilot flow and limitations](copilot-read-only.md).
- Deploy now lists real project environments and release history through the deployment backend. Live Kubernetes access still requires an explicitly configured operator target. Creation, execution and observation are separate product actions; no live cluster or rollout is fabricated.
- Neither integration was configured with production credentials by this implementation. Unit/browser fixtures do not constitute a live provider or cluster acceptance test.

Conversation history, arbitrary repository browsing and model-driven mutation tools are not implemented. Existing Build and Agents navigation remains available.
