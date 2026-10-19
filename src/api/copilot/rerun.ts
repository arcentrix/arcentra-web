import { get, post } from "../client";

// This is a separate NEW-execution API. Never reuse the existing vote receipt.
export interface CopilotRerunReview {
  projectId: string;
  pipelineId: string;
  originalRunId: string;
  originalJobRunId: string;
  originalRunStatus: number;
  originalJobStatus: number;
  jobName: string;
  retryMode: "whole_job";
  snapshotDigest: string;
  snapshotExpiresAt: string;
  definition: {
    repository: string;
    path: string;
    revision: string;
    resolvedSpecDigest: string;
  };
  source: { repository: string; ref: string; expectedCommit: string };
  policy: {
    id: string;
    fingerprint: string;
    mode: "any" | "all";
    requiredApproverCount: number;
    candidates: string[];
    timeoutSeconds: number;
  };
  retryBudget: {
    maxAttempts: number;
    delay: string;
    allowedExitCodes: number[];
  };
}
export interface CopilotRerunEligibility {
  available: true;
  eligible: boolean;
  reasonCode: "eligible" | "unsupported" | "review_unavailable";
  serverTime: string;
  review?: CopilotRerunReview;
}
export interface CopilotRerunIntent {
  intentId: string;
  requestId: string;
  projectId: string;
  pipelineId: string;
  originalRunId: string;
  originalJobRunId: string;
  newRunId: string;
  newJobRunId: string;
  snapshotDigest: string;
  intentDigest: string;
  reviewedRunContextDigest: string;
  version: number;
  state: "prepared" | "confirmed" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  serverTime: string;
  review?: CopilotRerunReview;
  reviewStatus: "current" | "changed" | "unavailable" | "expired";
  canConfirm: boolean;
  canCancelPrepared: boolean;
  cancelNewExecutionAvailable: false;
}
export interface CopilotRerunScope {
  projectId: string;
  originalRunId: string;
  ownerId: string;
}
export const rerunId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const digest = (v: unknown): v is string =>
  typeof v === "string" && /^(?:v1:)?[a-f0-9]{64}$/.test(v);
const sha = (v: unknown): v is string =>
  typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const date = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
const text = (v: unknown, max = 2048): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  v.trim() === v &&
  !/[\x00-\x1f\x7f]/.test(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const bad = (): never => {
  throw new Error(
    "Whole-job new-execution evidence is unavailable or invalid.",
  );
};
const root = (project: string) => {
  if (!rerunId(project)) return bad();
  return `/projects/${encodeURIComponent(project)}/copilot/rerun-intents`;
};
const config = (signal?: AbortSignal) => ({
  signal,
  silence: true,
  redactErrors: true,
  timeout: 20000,
});

export function validateRerunReview(
  value: CopilotRerunReview,
  scope: CopilotRerunScope,
  jobId?: string,
) {
  const p = value?.policy,
    b = value?.retryBudget;
  if (
    !value ||
    value.projectId !== scope.projectId ||
    value.originalRunId !== scope.originalRunId ||
    (jobId !== undefined && value.originalJobRunId !== jobId) ||
    ![
      value.projectId,
      value.pipelineId,
      value.originalRunId,
      value.originalJobRunId,
    ].every(rerunId) ||
    value.originalRunStatus !== 4 ||
    value.originalJobStatus !== 5 ||
    value.retryMode !== "whole_job" ||
    !text(value.jobName, 256) ||
    !digest(value.snapshotDigest) ||
    !date(value.snapshotExpiresAt) ||
    !value.definition ||
    !text(value.definition.repository) ||
    !text(value.definition.path, 1024) ||
    !sha(value.definition.revision) ||
    !digest(value.definition.resolvedSpecDigest) ||
    !value.source ||
    !text(value.source.repository) ||
    !(value.source.ref === "" || text(value.source.ref, 512)) ||
    !sha(value.source.expectedCommit) ||
    !p ||
    !rerunId(p.id) ||
    !digest(p.fingerprint) ||
    !["any", "all"].includes(p.mode) ||
    !Array.isArray(p.candidates) ||
    !integer(p.candidates.length, 1, 100) ||
    !p.candidates.every(rerunId) ||
    new Set(p.candidates).size !== p.candidates.length ||
    p.candidates.includes(scope.ownerId) ||
    !integer(p.requiredApproverCount, 1, p.candidates.length) ||
    (p.mode === "all" && p.requiredApproverCount !== p.candidates.length) ||
    !integer(p.timeoutSeconds, 1, 3600) ||
    !b ||
    !integer(b.maxAttempts, 2, 5) ||
    typeof b.delay !== "string" ||
    b.delay.length > 64 ||
    !Array.isArray(b.allowedExitCodes) ||
    !integer(b.allowedExitCodes.length, 1, 125) ||
    !b.allowedExitCodes.every((c) => integer(c, 1, 125)) ||
    new Set(b.allowedExitCodes).size !== b.allowedExitCodes.length
  )
    return bad();
  return value;
}
export function validateRerunEligibility(
  value: CopilotRerunEligibility,
  scope: CopilotRerunScope,
  jobId: string,
) {
  if (
    !value ||
    value.available !== true ||
    typeof value.eligible !== "boolean" ||
    !date(value.serverTime) ||
    !["eligible", "unsupported", "review_unavailable"].includes(
      value.reasonCode,
    ) ||
    value.eligible !== (value.reasonCode === "eligible") ||
    (value.eligible && !value.review)
  )
    return bad();
  if (value.review) {
    validateRerunReview(value.review, scope, jobId);
    if (
      value.eligible &&
      Date.parse(value.review.snapshotExpiresAt) <= Date.parse(value.serverTime)
    )
      return bad();
  }
  return value;
}
export function validateRerunIntent(
  value: CopilotRerunIntent,
  scope: CopilotRerunScope,
  identity?: { intentId?: string; requestId?: string },
) {
  if (
    !value ||
    value.projectId !== scope.projectId ||
    value.originalRunId !== scope.originalRunId ||
    (identity?.intentId !== undefined &&
      identity.intentId !== value.intentId) ||
    (identity?.requestId !== undefined &&
      identity.requestId !== value.requestId) ||
    ![
      value.intentId,
      value.requestId,
      value.projectId,
      value.pipelineId,
      value.originalRunId,
      value.originalJobRunId,
      value.newRunId,
      value.newJobRunId,
    ].every(rerunId) ||
    value.originalRunId === value.newRunId ||
    value.originalJobRunId === value.newJobRunId ||
    ![
      value.snapshotDigest,
      value.intentDigest,
      value.reviewedRunContextDigest,
    ].every(digest) ||
    !integer(value.version, 1, Number.MAX_SAFE_INTEGER) ||
    !["prepared", "confirmed", "cancelled", "expired"].includes(value.state) ||
    ![value.createdAt, value.expiresAt, value.serverTime].every(date) ||
    Date.parse(value.expiresAt) <= Date.parse(value.createdAt) ||
    !["current", "changed", "unavailable", "expired"].includes(
      value.reviewStatus,
    ) ||
    typeof value.canConfirm !== "boolean" ||
    typeof value.canCancelPrepared !== "boolean" ||
    value.cancelNewExecutionAvailable !== false ||
    (value.confirmedAt !== undefined && !date(value.confirmedAt)) ||
    (value.cancelledAt !== undefined && !date(value.cancelledAt))
  )
    return bad();
  // Prepared expiry is a read-only server projection; it never adds a lifecycle
  // timestamp. Mixed confirmation/cancellation evidence cannot be a receipt.
  if (
    (value.state !== "confirmed" && value.confirmedAt !== undefined) ||
    (value.state !== "cancelled" && value.cancelledAt !== undefined)
  )
    return bad();
  if (
    value.state === "confirmed" &&
    (!date(value.confirmedAt) ||
      value.version < 2 ||
      Date.parse(value.confirmedAt) < Date.parse(value.createdAt) ||
      Date.parse(value.confirmedAt) >= Date.parse(value.expiresAt))
  )
    return bad();
  if (
    value.state === "cancelled" &&
    (!date(value.cancelledAt) ||
      value.version < 2 ||
      Date.parse(value.cancelledAt) < Date.parse(value.createdAt))
  )
    return bad();
  if (value.review) {
    validateRerunReview(value.review, scope, value.originalJobRunId);
    if (
      value.review.pipelineId !== value.pipelineId ||
      value.review.snapshotDigest !== value.snapshotDigest
    )
      return bad();
  }
  if (
    (value.canConfirm &&
      (value.state !== "prepared" ||
        value.reviewStatus !== "current" ||
        !value.review ||
        Date.parse(value.expiresAt) <= Date.parse(value.serverTime))) ||
    (value.canCancelPrepared && value.state !== "prepared")
  )
    return bad();
  return value;
}
export async function getCopilotRerunAvailability(
  project: string,
  signal?: AbortSignal,
) {
  const value = await get<{
    available: boolean;
    cancelNewExecutionAvailable: boolean;
  }>(`${root(project)}/availability`, config(signal));
  if (
    !value ||
    value.available !== true ||
    value.cancelNewExecutionAvailable !== false
  )
    return bad();
  return value;
}
export async function getCopilotRerunEligibility(
  scope: CopilotRerunScope,
  jobId: string,
  signal?: AbortSignal,
) {
  if (!rerunId(jobId)) return bad();
  return validateRerunEligibility(
    await get<CopilotRerunEligibility>(`${root(scope.projectId)}/eligibility`, {
      ...config(signal),
      params: { originalJobRunId: jobId },
    }),
    scope,
    jobId,
  );
}
export async function getCopilotRerun(
  scope: CopilotRerunScope,
  identity: { requestId: string; intentId?: string },
  signal?: AbortSignal,
) {
  if (
    !rerunId(identity.requestId) ||
    (identity.intentId !== undefined && !rerunId(identity.intentId))
  )
    return bad();
  const path = identity.intentId
    ? encodeURIComponent(identity.intentId)
    : `by-request/${encodeURIComponent(identity.requestId)}`;
  return validateRerunIntent(
    await get<CopilotRerunIntent>(
      `${root(scope.projectId)}/${path}`,
      config(signal),
    ),
    scope,
    identity,
  );
}
export async function prepareCopilotRerun(
  scope: CopilotRerunScope,
  eligibility: CopilotRerunEligibility,
  requestId: string,
  signal?: AbortSignal,
) {
  if (!rerunId(requestId) || !eligibility.review) return bad();
  validateRerunEligibility(
    eligibility,
    scope,
    eligibility.review.originalJobRunId,
  );
  if (!eligibility.eligible) return bad();
  const r = eligibility.review;
  const value = validateRerunIntent(
    await post<CopilotRerunIntent>(
      root(scope.projectId),
      {
        requestId,
        originalJobRunId: r.originalJobRunId,
        snapshotDigest: r.snapshotDigest,
      },
      config(signal),
    ),
    scope,
    { requestId },
  );
  if (
    value.originalJobRunId !== r.originalJobRunId ||
    value.pipelineId !== r.pipelineId ||
    value.snapshotDigest !== r.snapshotDigest
  )
    return bad();
  return value;
}
export async function changeCopilotRerun(
  scope: CopilotRerunScope,
  intent: CopilotRerunIntent,
  action: "confirm" | "cancel-prepared",
  signal?: AbortSignal,
) {
  validateRerunIntent(intent, scope);
  if (
    intent.state !== "prepared" ||
    (action === "confirm" ? !intent.canConfirm : !intent.canCancelPrepared)
  )
    return bad();
  const value = validateRerunIntent(
    await post<CopilotRerunIntent>(
      `${root(scope.projectId)}/${encodeURIComponent(intent.intentId)}/${action}`,
      {
        expectedVersion: intent.version,
        intentDigest: intent.intentDigest,
        reviewedRunContextDigest: intent.reviewedRunContextDigest,
        ...(action === "confirm" ? { acknowledgeNewExecution: true } : {}),
      },
      config(signal),
    ),
    scope,
    { requestId: intent.requestId, intentId: intent.intentId },
  );
  for (const field of [
    "pipelineId",
    "originalRunId",
    "originalJobRunId",
    "newRunId",
    "newJobRunId",
    "snapshotDigest",
    "intentDigest",
    "reviewedRunContextDigest",
    "createdAt",
    "expiresAt",
  ] as const) {
    if (intent[field] !== value[field]) return bad();
  }
  if (
    value.state !== (action === "confirm" ? "confirmed" : "cancelled") ||
    value.version !== intent.version + 1
  )
    return bad();
  return value;
}
