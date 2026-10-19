import type {
  CopilotRerunEligibility,
  CopilotRerunIntent,
  CopilotRerunReview,
} from "@/api/copilot/rerun";
export const rerunScope = {
  projectId: "project",
  originalRunId: "old-run",
  ownerId: "requester",
};
export const rerunHash = (c = "a") => `v1:${c.repeat(64)}`;
export function rerunReviewFixture(): CopilotRerunReview {
  return {
    projectId: "project",
    pipelineId: "pipeline",
    originalRunId: "old-run",
    originalJobRunId: "old-job",
    originalRunStatus: 4,
    originalJobStatus: 5,
    jobName: "build",
    retryMode: "whole_job",
    snapshotDigest: rerunHash(),
    snapshotExpiresAt: "2099-01-01T01:00:00Z",
    definition: {
      repository: "https://example.test/definition.git",
      path: ".arcentra/pipeline.yaml",
      revision: "d".repeat(40),
      resolvedSpecDigest: rerunHash("b"),
    },
    source: {
      repository: "https://example.test/source.git",
      ref: "main",
      expectedCommit: "e".repeat(40),
    },
    policy: {
      id: "policy",
      fingerprint: rerunHash("c"),
      mode: "any",
      requiredApproverCount: 1,
      candidates: ["independent-approver"],
      timeoutSeconds: 300,
    },
    retryBudget: { maxAttempts: 2, delay: "1s", allowedExitCodes: [1] },
  };
}
export function rerunEligibilityFixture(): CopilotRerunEligibility {
  return {
    available: true,
    eligible: true,
    reasonCode: "eligible",
    serverTime: "2099-01-01T00:00:00Z",
    review: rerunReviewFixture(),
  };
}
export function rerunIntentFixture(): CopilotRerunIntent {
  return {
    intentId: "intent",
    requestId: "request",
    projectId: "project",
    pipelineId: "pipeline",
    originalRunId: "old-run",
    originalJobRunId: "old-job",
    newRunId: "new-run",
    newJobRunId: "new-job",
    snapshotDigest: rerunHash(),
    intentDigest: rerunHash("f"),
    reviewedRunContextDigest: rerunHash("b"),
    version: 1,
    state: "prepared",
    createdAt: "2099-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:10:00Z",
    serverTime: "2099-01-01T00:00:00Z",
    review: rerunReviewFixture(),
    reviewStatus: "current",
    canConfirm: true,
    canCancelPrepared: true,
    cancelNewExecutionAvailable: false,
  };
}
export function confirmedRerunFixture(): CopilotRerunIntent {
  return {
    ...rerunIntentFixture(),
    state: "confirmed",
    version: 2,
    confirmedAt: "2099-01-01T00:01:00Z",
    canConfirm: false,
    canCancelPrepared: false,
  };
}
