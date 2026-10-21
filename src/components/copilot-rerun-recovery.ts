import { rerunId } from "@/api/copilot/rerun";
import type { CopilotRerunScope } from "@/api/copilot/rerun";

export interface RerunRecovery {
  requestId: string;
  intentId?: string;
}
const key = (scope: CopilotRerunScope) =>
  `copilot-rerun-recovery:v1:${scope.ownerId}:${scope.projectId}:${scope.originalRunId}`;
export function readRerunRecovery(
  scope: CopilotRerunScope,
): RerunRecovery | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(scope)) || "null");
    if (
      !value ||
      !rerunId(value.requestId) ||
      (value.intentId !== undefined && !rerunId(value.intentId))
    )
      return undefined;
    return {
      requestId: value.requestId,
      ...(value.intentId ? { intentId: value.intentId } : {}),
    };
  } catch {
    return undefined;
  }
}
// Only opaque recovery IDs are persisted. No consent, auth token, review or payload.
export function saveRerunRecovery(
  scope: CopilotRerunScope,
  value: RerunRecovery,
): boolean {
  try {
    sessionStorage.setItem(
      key(scope),
      JSON.stringify({
        requestId: value.requestId,
        ...(value.intentId ? { intentId: value.intentId } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearRerunRecovery(scope: CopilotRerunScope) {
  try {
    sessionStorage.removeItem(key(scope));
  } catch {
    /* In-memory scope remains fenced. */
  }
}
