# Observe execution health

Observe reads existing authorized execution APIs. It does not display simulated application-service telemetry or infer deployment health.

- Pipeline collection/search and selected pipeline detail are server-authorized. A project/pipeline-specific grant is sufficient; no broad platform pipeline grant is required by the page.
- Run lists support status filtering and pagination. Failure/activity counts and mean completed duration describe only the loaded page, not every run. Duration is the backend's millisecond value; run timestamps are Unix seconds.
- Run links open Build with encoded pipeline/run IDs for the actual persisted details and logs.
- Agent health independently checks platform agent:read (or the effective superuser wildcard) before fetching the agent collection. Pipeline access does not imply Agent access. Counts are page-scoped and use actual enabled/status values, including busy and idle; heartbeat timestamps are nullable RFC3339 server records.
- Refresh, loading, empty, unavailable and restricted-access states are explicit. Both HTTP403 and existing HTTP200 business4030/4031 envelopes are recognized. Stale/failed snapshots are not presented as a successful latest response.
- Key changes cancel requests and discard late results. URL search/page/filter state supports Back/Forward; invalid or excessive page values normalize safely before requests. No automatic mutations, acknowledgments, retries of builds or external telemetry calls occur.

This is execution-health visibility, not an application-observability platform. Service inventory, time-series telemetry queries, alert lifecycle, SLO definitions and error budgets still need real backend/provider contracts. Arcentra's own Prometheus exporter does not supply those application-fleet features.

Tests cover API envelopes, grants/denial/retry, page-scoped metrics, search/pagination/navigation, stale-response cancellation and encoded run links. Live browser and real infrastructure acceptance remain separate requirements.
