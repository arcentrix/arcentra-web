# Notification settings integration boundary

The standalone `/settings/notifications` page and the Notifications section at `/settings?section=notifications` show an explicit **Not integrated** state. They do not represent an empty result from the backend or claim that existing notifications are disabled.

## Backend audit

The backend has notification data models in `internal/control/model/model_notification.go`, channel/template repositories in `internal/control/repo/repo_notification_{channel,template}.go`, and notification delivery helpers in `internal/control/service/service_notification_service.go` and `internal/shared/notify/`.

However, `internal/control/router/router.go` does not register a notification-management router, and no current router exposes channel, notification-template, or routing-rule management. The frontend API registry also has no notification-management client. The generic `/api/v1/settings` routes persist generic settings; saving notification-shaped values there would not connect this page to the notification repositories or runtime. Pipeline-template routes manage pipeline definitions, not notification templates.

## UI behavior

- No hardcoded channels, provider endpoints, saved templates, or routing-rule counts are displayed.
- Create/edit/delete/enable actions and their credential forms are absent. No local state or timer can manufacture a successful save.
- The page does not fetch speculative endpoints, write local storage, send notifications, or configure providers.
- The existing Settings section navigation and direct page route remain available. `headless` mode avoids a duplicate page header and outer padding. A link returns to general settings.

Before enabling these controls, integrate authenticated backend management contracts with appropriate permissions and secret handling. Load real data, distinguish empty results from unavailable/error states, and report mutations only after the backend confirms persistence. Provider credentials must not be exposed as ordinary list data.

## Legacy log viewer cleanup

The unused `src/components/pipeline-log-viewer.tsx` was removed after checking repository references and dynamic imports. It had no consumers, and the only dynamic component registry discovers pages, not arbitrary components. The file generated timed demo logs and a simulated connected state; it was not an SSE implementation. Active build log components and API clients are unchanged.

## Regression coverage

`src/pages/Settings/Notifications/index.test.tsx` covers the unavailable state, absence of records/forms/mutations/network/storage writes/timed success, standalone Back/Forward navigation, headless rendering, and repeated navigation through the actual Settings shell. Type checking and production compilation validate that removing the unused log viewer leaves no broken imports. No browser or live provider test is claimed by these unit tests.
