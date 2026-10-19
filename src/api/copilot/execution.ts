import { get, post } from "../client";
import { contentAvailableBefore, historyBase } from "./history";
import { validateReviewOnlyPlan } from "./plans";
import type { CopilotPlan } from "./plans";
import type { RetryApprovalReview } from "../approval/retry-types";
import type { PipelineRun } from "../pipeline/types";
import { validateRetryApproval } from "@/components/build/retry-approval-review";

export interface CopilotExecutionIntent {
  intentId: string;
  projectId: string;
  pipelineId: string;
  runId: string;
  jobRunId: string;
  approvalId: string;
  sourcePlanId: string;
  sourcePlanVersion: number;
  sourcePlanDigest: string;
  intentDigest: string;
  version: number;
  state: "prepared" | "submitted" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
  decisionId?: string;
  approvalStatus?: number;
  approvedCount?: number;
  requiredApproverCount?: number;
  jobStatus?: number;
  currentGeneration?: number;
  runtimeAdmissionObserved?: boolean;
  retryReview?: RetryApprovalReview;
}
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const digest = (v: unknown): v is string =>
  typeof v === "string" && /^(?:v1:)?[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, min = 0): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min;
const date = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
export function validateExecutionIntent(
  value: CopilotExecutionIntent,
  projectId: string,
  intentId?: string,
): CopilotExecutionIntent {
  const bad = () => {
    throw new Error("Bound retry action is unavailable or invalid.");
  };
  if (
    !value ||
    value.projectId !== projectId ||
    (intentId && value.intentId !== intentId) ||
    ![
      value.intentId,
      value.projectId,
      value.pipelineId,
      value.runId,
      value.jobRunId,
      value.approvalId,
      value.sourcePlanId,
    ].every(id) ||
    !integer(value.version, 1) ||
    !integer(value.sourcePlanVersion, 1) ||
    !digest(value.sourcePlanDigest) ||
    !digest(value.intentDigest) ||
    !["prepared", "submitted", "cancelled", "expired"].includes(value.state) ||
    !date(value.createdAt) ||
    !date(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.createdAt) ||
    (value.submittedAt !== undefined && !date(value.submittedAt)) ||
    (value.decisionId !== undefined && !id(value.decisionId)) ||
    [
      value.approvalStatus,
      value.approvedCount,
      value.requiredApproverCount,
      value.jobStatus,
      value.currentGeneration,
    ].some((v) => v !== undefined && !integer(v)) ||
    (value.runtimeAdmissionObserved !== undefined &&
      typeof value.runtimeAdmissionObserved !== "boolean")
  )
    return bad();
  if (
    value.state === "submitted" &&
    (!id(value.decisionId) ||
      !date(value.submittedAt) ||
      value.version < 2 ||
      Date.parse(value.submittedAt) < Date.parse(value.createdAt) ||
      Date.parse(value.submittedAt) > Date.parse(value.expiresAt))
  )
    return bad();
  if (value.retryReview) {
    const r = value.retryReview,
      e = r.evidence;
    if (
      !e ||
      r.approvalId !== value.approvalId ||
      r.retryJobRunId !== value.jobRunId ||
      ![0, 1, 2, 3, 4].includes(r.status)
    )
      return bad();
    // Validate the entire frozen evidence with the same contract as the existing
    // approval review. This does not fetch or grant current decision permission.
    validateRetryApproval(
      { projectId, pipelineId: value.pipelineId, runId: value.runId },
      {
        approvalId: value.approvalId,
        pipelineRunId: value.runId,
        jobName: e.jobName,
        stepName: "",
        plugin: "builtin:retry-approval",
        status: r.status as 0 | 1 | 2 | 3 | 4,
        mode: e.context?.policy?.mode,
        requiredApproverCount: e.context?.policy?.requiredApproverCount,
        approvedCount: 0,
        rejectedCount: 0,
        requestedBy: e.context?.actorId,
        candidateApprovers: JSON.stringify(e.context?.policy?.candidates),
        expiresAt: new Date(e.expiresAtUnixMilli).toISOString(),
        retryJobRunId: value.jobRunId,
        bindingKind: e.kind,
        evidenceHash: r.evidenceHash,
        version: 1,
        retryReview: r,
      },
      {
        runId: value.runId,
        pipelineId: value.pipelineId,
        definitionCommitSha: e.context?.definitionCommitSha,
      } as PipelineRun,
    );
    if (Date.parse(value.expiresAt) > e.expiresAtUnixMilli) return bad();
  }
  return value;
}
const root = (project: string) =>
  `/projects/${encodeURIComponent(project)}/copilot/execution-intents`;
const config = (signal?: AbortSignal) => ({
  signal,
  silence: true,
  redactErrors: true,
  timeout: 20000,
});
export async function prepareCopilotExecution(
  project: string,
  conversation: string,
  plan: CopilotPlan,
  requestId: string,
  signal?: AbortSignal,
) {
  validateReviewOnlyPlan(plan);
  if (
    contentAvailableBefore(plan) <= Date.now() ||
    plan.kind !== "retry_approval_review" ||
    plan.state !== "reviewed" ||
    !plan.eligible ||
    !plan.payload?.retryApproval
  )
    throw new Error("An eligible reviewed retry proposal is required.");
  const value = validateExecutionIntent(
    await post<CopilotExecutionIntent>(
      `${historyBase(project, conversation)}/plans/${encodeURIComponent(plan.planId)}/execution-intents`,
      {
        requestId,
        expectedVersion: plan.version,
        planDigest: plan.planDigest,
        acknowledgeDetachedIntent: true,
      },
      config(signal),
    ),
    project,
  );
  if (
    value.sourcePlanId !== plan.planId ||
    value.sourcePlanVersion !== plan.version ||
    value.sourcePlanDigest !== plan.planDigest ||
    value.approvalId !== plan.payload.retryApproval.approvalId ||
    value.jobRunId !== plan.payload.retryApproval.jobRunId ||
    value.retryReview?.evidenceHash !==
      plan.payload.retryApproval.evidenceDigest
  )
    throw new Error("Prepared action does not match the reviewed proposal.");
  return value;
}
export async function listCopilotExecutions(
  project: string,
  after = 0,
  signal?: AbortSignal,
): Promise<{ intents: CopilotExecutionIntent[]; nextAfter?: number }> {
  const value = await get<{
    intents: CopilotExecutionIntent[];
    nextAfter?: number;
  }>(root(project), { ...config(signal), params: { after, limit: 20 } });
  if (
    !value ||
    !Array.isArray(value.intents) ||
    value.intents.length > 20 ||
    (value.nextAfter !== undefined && !integer(value.nextAfter))
  )
    throw new Error("Bound retry list is unavailable.");
  return {
    intents: value.intents.map((v) => validateExecutionIntent(v, project)),
    nextAfter: value.nextAfter,
  };
}
export async function getCopilotExecution(
  project: string,
  intentId: string,
  signal?: AbortSignal,
) {
  return validateExecutionIntent(
    await get<CopilotExecutionIntent>(
      `${root(project)}/${encodeURIComponent(intentId)}`,
      config(signal),
    ),
    project,
    intentId,
  );
}
export async function changeCopilotExecution(
  project: string,
  intent: CopilotExecutionIntent,
  action: "confirm" | "cancel",
  signal?: AbortSignal,
) {
  validateExecutionIntent(intent, project, intent.intentId);
  if (
    intent.state !== "prepared" ||
    Date.parse(intent.expiresAt) <= Date.now() ||
    (action === "confirm" && !intent.retryReview)
  )
    throw new Error("The prepared action is no longer available.");
  const result = validateExecutionIntent(
    await post<CopilotExecutionIntent>(
      `${root(project)}/${encodeURIComponent(intent.intentId)}/${action}`,
      {
        expectedVersion: intent.version,
        intentDigest: intent.intentDigest,
        ...(action === "confirm" ? { acknowledgePermanentApproval: true } : {}),
      },
      config(signal),
    ),
    project,
    intent.intentId,
  );
  for (const key of [
    "pipelineId",
    "runId",
    "jobRunId",
    "approvalId",
    "sourcePlanId",
    "sourcePlanVersion",
    "sourcePlanDigest",
    "intentDigest",
    "createdAt",
    "expiresAt",
  ] as const) {
    if (result[key] !== intent[key])
      throw new Error(
        "The action response changed its frozen binding. Inspect the record.",
      );
  }
  if (
    result.version !== intent.version + 1 ||
    result.state !== (action === "confirm" ? "submitted" : "cancelled")
  )
    throw new Error(
      "The action outcome was not confirmed. Inspect the record.",
    );
  return result;
}
