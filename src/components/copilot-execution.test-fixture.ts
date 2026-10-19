import type { CopilotExecutionIntent } from "@/api/copilot/execution";
import type { CopilotPlan } from "@/api/copilot/plans";
import { hash, retryFixture } from "./build/retry-approval.test-fixture";
export function intentFixture(): CopilotExecutionIntent {
  return {
    intentId: "intent",
    projectId: "project",
    pipelineId: "pipeline",
    runId: "run",
    jobRunId: "job",
    approvalId: "approval",
    sourcePlanId: "plan",
    sourcePlanVersion: 2,
    sourcePlanDigest: hash(),
    intentDigest: hash("b"),
    version: 1,
    state: "prepared",
    createdAt: "2099-01-01T00:00:00Z",
    expiresAt: "2099-01-01T01:00:00Z",
    retryReview: retryFixture().approval.retryReview,
  };
}
export const planFixture = (): CopilotPlan => ({
  planId: "plan",
  requestId: "request",
  turnId: "turn",
  kind: "retry_approval_review",
  state: "reviewed",
  version: 2,
  planDigest: hash(),
  executionEnabled: false,
  executionStatus: "Not executed",
  eligible: true,
  createdAt: "2099-01-01T00:00:00Z",
  expiresAt: "2099-01-01T01:00:00Z",
  payload: {
    schemaVersion: 1,
    kind: "retry_approval_review",
    label: "Review",
    retryApproval: {
      approvalId: "approval",
      jobRunId: "job",
      bindingKind: "retry_whole_job_v1",
      evidenceDigest: hash(),
      policyId: "operator-policy",
      deadline: "2099-01-01T01:00:00Z",
    },
  },
});
