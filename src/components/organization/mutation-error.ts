import { ApiError, isApiError } from "@/lib/api-error";

export function mutationError(error: unknown): string {
  const codes = isApiError(error) ? [error.status, error.code] : [];
  if (codes.includes(401) || codes.includes(403))
    return "Access changed. Your current session cannot make this change. Refresh to check access again.";
  if (codes.includes(409))
    return "This record changed or conflicts with an existing record. Refresh and review the latest values before trying again.";
  if (codes.includes(404))
    return "The requested record or user is no longer available. Refresh and check the ID.";
  if (codes.includes(400))
    return "The server rejected this change. Check the fields and the selected role, then refresh before trying again.";
  return "The change could not be confirmed. Refresh to check the saved state before trying again.";
}

/** Keep status/request IDs useful without rendering arbitrary server payloads. */
export function scopedReadError(error: Error): Error {
  return isApiError(error)
    ? new ApiError({
        message: "The current scoped data could not be loaded.",
        status: error.status,
        code: error.code,
        requestId: error.requestId,
      })
    : new Error("The current scoped data could not be loaded.");
}
