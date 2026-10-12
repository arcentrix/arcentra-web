import { getApproval, approvalCandidates } from "@/api/approval";
import type { ApprovalRequest } from "@/api/approval";
import { getRelease } from "@/api/deploy";
import type { DeploymentRelease } from "@/api/deploy";
import { getPipeline, getRun } from "@/api/pipeline";
import type { PipelineRun } from "@/api/pipeline/types";

export interface ApprovalScope {
  projectId: string;
  pipelineId: string;
  runId: string;
}
export interface ApprovalReview {
  approval: ApprovalRequest;
  release: DeploymentRelease;
  run: PipelineRun;
}
const sha256 = /^[a-fA-F0-9]{64}$/;
export async function verifyApprovalScope(
  scope: ApprovalScope,
  signal?: AbortSignal,
) {
  const [pipeline, run] = await Promise.all([
    getPipeline(scope.pipelineId, signal),
    getRun(scope.pipelineId, scope.runId, signal),
  ]);
  if (
    pipeline.projectId !== scope.projectId ||
    pipeline.pipelineId !== scope.pipelineId ||
    run.pipelineId !== scope.pipelineId ||
    run.runId !== scope.runId
  )
    throw new Error(
      "Approval scope does not match this project, pipeline, and run.",
    );
  return run;
}
export async function loadApprovalReview(
  scope: ApprovalScope,
  approvalId: string,
  signal?: AbortSignal,
): Promise<ApprovalReview> {
  const [approval, run] = await Promise.all([
    getApproval(scope.runId, approvalId, signal),
    verifyApprovalScope(scope, signal),
  ]);
  if (approval.plugin !== "builtin:deployment" || !approval.deploymentReleaseId)
    throw new Error(
      "Unsupported approval gate. Only the final controller-managed Kubernetes deployment has a verified decision flow.",
    );
  const release = await getRelease(
    scope.projectId,
    approval.deploymentReleaseId,
    signal,
  );
  const target = release.approvalTarget;
  if (
    release.origin !== "pipeline_job" ||
    release.pipelineId !== scope.pipelineId ||
    release.pipelineRunId !== scope.runId ||
    release.approvalId !== approvalId ||
    !sha256.test(approval.evidenceHash ?? "") ||
    release.approvalEvidenceHash !== approval.evidenceHash ||
    !sha256.test(release.artifactSha256) ||
    !/@sha256:[a-fA-F0-9]{64}$/.test(release.image) ||
    !/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(release.commitSha) ||
    release.commitSha !== run.definitionCommitSha ||
    !run.allowDeployments ||
    !sha256.test(release.deploymentPlanHash ?? "") ||
    release.deploymentPlanHash !== run.deploymentPlanHash ||
    !release.executionJobRunId ||
    !release.executionStepRunId ||
    !release.artifactId ||
    !release.producerJobRunId ||
    !release.producerStepRunId ||
    !target ||
    target.projectId !== scope.projectId ||
    target.environmentId !== release.environmentId ||
    !target.targetRef ||
    !target.namespace ||
    !target.deployment ||
    !target.container ||
    !Number.isSafeInteger(approval.version) ||
    (approval.version ?? 0) < 1 ||
    !approval.requestedBy ||
    !Number.isInteger(approval.approvedCount) ||
    approval.approvedCount < 0 ||
    !Number.isInteger(approval.rejectedCount) ||
    approval.rejectedCount < 0 ||
    approval.approvedCount + approval.rejectedCount >
      approvalCandidates(approval).length ||
    !Number.isInteger(approval.requiredApproverCount) ||
    approval.requiredApproverCount < 1 ||
    approvalCandidates(approval).length < approval.requiredApproverCount ||
    !approval.expiresAt ||
    !Number.isFinite(Date.parse(approval.expiresAt))
  )
    throw new Error(
      "Approval evidence is incomplete, changed, or belongs to a different release. Decisions are disabled; refresh to verify the original release.",
    );
  return { approval, release, run };
}

/** UI consent is bound to reviewed identity, evidence, vote revision and current eligibility. */
export function approvalReviewKey({ approval, release, run }: ApprovalReview) {
  return JSON.stringify({
    approval,
    release,
    run: {
      runId: run.runId,
      pipelineId: run.pipelineId,
      status: run.status,
      definitionCommitSha: run.definitionCommitSha,
      deploymentPlanHash: run.deploymentPlanHash,
      allowDeployments: run.allowDeployments,
    },
  });
}
