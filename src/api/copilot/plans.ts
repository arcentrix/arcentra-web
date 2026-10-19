import { get, post } from "../client";
import type { CopilotSourceFile } from "./index";
import { historyBase } from "./history";
export type CopilotPlanKind =
  | "code_patch"
  | "new_run_review"
  | "retry_approval_review"
  | "deployment_review";
export type CopilotPlanRequest = { requestId: string; turnId: string } & (
  | {
      kind: "code_patch";
      codePatch: { patch: string } & (
        | { artifactId: string; sourceFile?: never }
        | { sourceFile: CopilotSourceFile; artifactId?: never }
      );
    }
  | { kind: "new_run_review" }
  | { kind: "retry_approval_review"; retryApproval: { approvalId: string } }
  | {
      kind: "deployment_review";
      deployment: {
        environmentId: string;
        artifactId: string;
        releaseId?: string;
      };
    }
);
export interface CopilotCodePatchPlan {
  artifactId?: string;
  jobRunId?: string;
  repository?: string;
  commit?: string;
  path: string;
  blobSHA?: string;
  baseDigest: string;
  patchDigest: string;
  resultDigest: string;
  patch: string;
  snapshotOnly: boolean;
}
export interface CopilotPlanPayload {
  schemaVersion: number;
  kind: CopilotPlanKind;
  label: string;
  codePatch?: CopilotCodePatchPlan;
  newRun?: {
    pipelineId: string;
    diagnosticRunId: string;
    definitionRevision?: string;
    definitionDigest?: string;
    definitionSource?: "last_saved_revision";
    definitionVerified?: false;
  };
  retryApproval?: {
    approvalId: string;
    jobRunId: string;
    bindingKind: string;
    evidenceDigest: string;
    policyId: string;
    deadline: string | null;
  };
  deployment?: {
    environmentId: string;
    artifactId: string;
    artifactDigest: string;
    releaseId?: string;
    releaseVersion?: number;
    targetFingerprint: string;
    namespace: string;
    workload: string;
    container: string;
    imageDigest: string;
    approvalRequired: boolean;
  };
}
export interface CopilotPlan {
  planId: string;
  requestId: string;
  turnId: string;
  kind: CopilotPlanKind;
  state: "proposed" | "reviewed" | "invalidated" | "cancelled" | "expired";
  version: number;
  planDigest: string;
  executionEnabled: false;
  executionStatus: "Not executed";
  eligible: boolean;
  contentAvailableUntil?: string;
  unavailableReason?: string;
  payload?: CopilotPlanPayload;
  createdAt: string;
  expiresAt: string;
}
const root = (projectId: string, conversationId: string) =>
  `${historyBase(projectId, conversationId)}/plans`;
const config = (signal?: AbortSignal) => ({
  signal,
  silence: true,
  redactErrors: true,
});
export const createCopilotPlan = (
  projectId: string,
  conversationId: string,
  input: CopilotPlanRequest,
  signal?: AbortSignal,
) => post<CopilotPlan>(root(projectId, conversationId), input, config(signal));
export const listCopilotPlans = (
  projectId: string,
  conversationId: string,
  after = 0,
  signal?: AbortSignal,
) =>
  get<{ plans: CopilotPlan[]; nextAfter?: number }>(
    root(projectId, conversationId),
    { ...config(signal), params: { after, limit: 20 } },
  );
export const getCopilotPlan = (
  projectId: string,
  conversationId: string,
  planId: string,
  signal?: AbortSignal,
) =>
  get<CopilotPlan>(
    `${root(projectId, conversationId)}/${encodeURIComponent(planId)}`,
    config(signal),
  );
export const reviewCopilotPlan = (
  projectId: string,
  conversationId: string,
  plan: Pick<CopilotPlan, "planId" | "version" | "planDigest">,
  signal?: AbortSignal,
) =>
  post<CopilotPlan>(
    `${root(projectId, conversationId)}/${encodeURIComponent(plan.planId)}/review`,
    {
      expectedVersion: plan.version,
      planDigest: plan.planDigest,
      acknowledgeNotExecuted: true,
    },
    config(signal),
  );
export const cancelCopilotPlan = (
  projectId: string,
  conversationId: string,
  plan: Pick<CopilotPlan, "planId" | "version">,
  signal?: AbortSignal,
) =>
  post<CopilotPlan>(
    `${root(projectId, conversationId)}/${encodeURIComponent(plan.planId)}/cancel`,
    { expectedVersion: plan.version },
    config(signal),
  );

export function validateReviewOnlyPlan(plan: CopilotPlan): CopilotPlan {
  if (
    !plan ||
    !plan.planId ||
    !Number.isSafeInteger(plan.version) ||
    plan.version < 1 ||
    typeof plan.planDigest !== "string" ||
    !plan.planDigest ||
    !Number.isFinite(Date.parse(plan.expiresAt)) ||
    plan.executionEnabled !== false ||
    plan.executionStatus !== "Not executed" ||
    ![
      "code_patch",
      "new_run_review",
      "retry_approval_review",
      "deployment_review",
    ].includes(plan.kind) ||
    !["proposed", "reviewed", "invalidated", "cancelled", "expired"].includes(
      plan.state,
    ) ||
    (plan.payload &&
      (plan.payload.kind !== plan.kind || plan.payload.schemaVersion !== 1))
  )
    throw new Error("Review-only plan unavailable");
  if (plan.payload) {
    const payload = plan.payload;
    const field = {
      code_patch: "codePatch",
      new_run_review: "newRun",
      retry_approval_review: "retryApproval",
      deployment_review: "deployment",
    }[plan.kind] as "codePatch" | "newRun" | "retryApproval" | "deployment";
    if (
      !payload[field] ||
      ["codePatch", "newRun", "retryApproval", "deployment"].some(
        (key) => key !== field && payload[key as typeof field] !== undefined,
      )
    )
      throw new Error("Ambiguous typed proposal");
    if (
      payload.codePatch &&
      (typeof payload.codePatch.patch !== "string" ||
        new TextEncoder().encode(payload.codePatch.patch).length > 16384)
    )
      throw new Error("Unbounded patch");
  }
  return plan;
}
