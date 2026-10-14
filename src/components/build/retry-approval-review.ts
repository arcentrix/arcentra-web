import { approvalCandidates, getApproval } from "@/api/approval";
import type { ApprovalRequest } from "@/api/approval";
import type {
  RetryApprovalEvidence,
  RetryArtifactReference,
} from "@/api/approval/retry-types";
import type { PipelineRun } from "@/api/pipeline/types";
import { verifyApprovalScope } from "./approval-review";
import type { ApprovalScope } from "./approval-review";

const digest = /^v1:[a-f0-9]{64}$/;
const sha = /^[a-f0-9]{64}$/;
const commit = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const text = (value: unknown, max = 1024): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  value.trim() === value &&
  !/[\x00\r\n]/.test(value);
const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
function validReference(ref: RetryArtifactReference) {
  return (
    !!ref &&
    text(ref.storageId, 64) &&
    sha.test(ref.fingerprint) &&
    sha.test(ref.sha256) &&
    integer(ref.size) &&
    (ref.expiresAt === undefined ||
      integer(ref.expiresAt, 0, 8_640_000_000_000))
  );
}
function sameReference(a: RetryArtifactReference, b: RetryArtifactReference) {
  return (
    validReference(a) &&
    validReference(b) &&
    a.storageId === b.storageId &&
    a.fingerprint === b.fingerprint &&
    a.sha256 === b.sha256 &&
    a.size === b.size &&
    (a.expiresAt ?? 0) === (b.expiresAt ?? 0)
  );
}
export interface VerifiedRetryApproval {
  approval: ApprovalRequest;
  evidence: RetryApprovalEvidence;
  run: PipelineRun;
}
export function validateRetryApproval(
  scope: ApprovalScope,
  approval: ApprovalRequest,
  run: PipelineRun,
): VerifiedRetryApproval {
  const view = approval.retryReview;
  const e = view?.evidence;
  const c = e?.context;
  const identity = e?.identity;
  const plan = e?.retryPlan;
  const policy = plan?.policy;
  const candidates = approvalCandidates(approval);
  const bad = () => {
    throw new Error(
      "Retry approval evidence is incomplete, changed, or belongs to another execution. Decisions are disabled.",
    );
  };
  if (
    !view ||
    !e ||
    !c ||
    !identity ||
    !plan ||
    !policy ||
    approval.plugin !== "builtin:retry-approval" ||
    approval.bindingKind !== "retry_whole_job_v1" ||
    approval.deploymentReleaseId ||
    !text(approval.retryJobRunId, 64) ||
    view.retryJobRunId !== approval.retryJobRunId ||
    identity.jobRunId !== view.retryJobRunId ||
    view.approvalId !== approval.approvalId ||
    e.approvalId !== approval.approvalId ||
    view.evidenceHash !== approval.evidenceHash ||
    !digest.test(view.evidenceHash) ||
    view.status !== approval.status ||
    e.version !== 1 ||
    e.kind !== "retry_whole_job_v1" ||
    c.version !== 1 ||
    c.projectId !== scope.projectId ||
    c.pipelineId !== scope.pipelineId ||
    c.pipelineRunId !== scope.runId ||
    identity.pipelineId !== scope.pipelineId ||
    identity.pipelineRunId !== scope.runId ||
    approval.pipelineRunId !== scope.runId ||
    run.runId !== scope.runId ||
    run.pipelineId !== scope.pipelineId ||
    c.actorId !== approval.requestedBy ||
    !text(c.actorId, 64) ||
    !commit.test(c.definitionCommitSha) ||
    c.definitionCommitSha !== run.definitionCommitSha ||
    !text(c.definitionPath) ||
    !digest.test(c.resolvedDefinitionDigest) ||
    !Array.isArray(c.gatedJobs) ||
    !c.gatedJobs.includes(e.jobName) ||
    e.jobName !== approval.jobName ||
    !text(identity.agentId, 64) ||
    !text(identity.claimId, 64) ||
    !digest.test(identity.runtimeBindingDigest) ||
    !digest.test(e.retryPlanDigest) ||
    !digest.test(e.inputManifestDigest) ||
    !integer(approval.version, 1) ||
    candidates.length === 0 ||
    !integer(approval.approvedCount) ||
    !integer(approval.rejectedCount) ||
    approval.approvedCount + approval.rejectedCount > candidates.length ||
    !integer(approval.requiredApproverCount, 1, candidates.length)
  )
    return bad();
  if (
    !c.policy ||
    !text(c.policy.id, 64) ||
    !digest.test(c.policy.fingerprint) ||
    JSON.stringify(c.policy.candidates) !== JSON.stringify(candidates) ||
    c.policy.requiredApproverCount !== approval.requiredApproverCount ||
    c.policy.mode !== approval.mode ||
    !["any", "all"].includes(c.policy.mode) ||
    (c.policy.mode === "all" &&
      c.policy.requiredApproverCount !== candidates.length) ||
    !integer(c.policy.timeoutSeconds, 1, 3600) ||
    !integer(e.createdAtUnixMilli, 1) ||
    !integer(
      e.expiresAtUnixMilli,
      e.createdAtUnixMilli + 1,
      e.createdAtUnixMilli + c.policy.timeoutSeconds * 1000,
    ) ||
    Date.parse(approval.expiresAt ?? "") !== e.expiresAtUnixMilli
  )
    return bad();
  if (
    plan.version !== 1 ||
    plan.retryApprovalRequired !== true ||
    plan.retryApprovalTimeoutSeconds !== c.policy.timeoutSeconds ||
    !digest.test(plan.definitionDigest) ||
    policy.mode !== "whole_job" ||
    policy.idempotent !== true ||
    !integer(policy.max_attempts, 2, 5) ||
    !Array.isArray(policy.allowed_exit_codes) ||
    !policy.allowed_exit_codes.length ||
    policy.allowed_exit_codes.some((code) => !integer(code, 1, 125)) ||
    new Set(policy.allowed_exit_codes).size !==
      policy.allowed_exit_codes.length ||
    (policy.delay !== undefined &&
      (typeof policy.delay !== "string" || policy.delay.length > 128)) ||
    !Array.isArray(plan.steps) ||
    !plan.steps.length ||
    plan.steps.length > 1000
  )
    return bad();
  const ids = new Set<string>();
  for (const step of plan.steps) {
    if (
      !step ||
      !text(step.name, 128) ||
      !text(step.uses, 128) ||
      typeof step.action !== "string" ||
      !integer(step.stepIndex) ||
      typeof step.continueOnError !== "boolean" ||
      !digest.test(step.definitionDigest) ||
      !Array.isArray(step.attemptRunIds) ||
      step.attemptRunIds.length !== policy.max_attempts
    )
      return bad();
    for (const id of step.attemptRunIds) {
      if (!text(id, 64) || ids.has(id)) return bad();
      ids.add(id);
    }
  }
  if (
    !e.runtime ||
    e.runtime.type !== "containerd-offline-v1" ||
    !/@sha256:[a-f0-9]{64}$/.test(e.runtime.image) ||
    e.runtime.bindingDigest !== identity.runtimeBindingDigest ||
    !e.runtime.resources ||
    !text(e.runtime.resources.cpu, 32) ||
    !text(e.runtime.resources.memory, 32) ||
    !e.inputs ||
    e.inputs.version !== 1 ||
    !Array.isArray(e.inputs.artifacts) ||
    !Array.isArray(e.artifacts) ||
    e.artifacts.length > 1000 ||
    e.artifacts.length !== e.inputs.artifacts.length
  )
    return bad();
  if (e.source === null) {
    if (identity.sourceBindingDigest !== "" || e.inputs.sourceCommit !== "")
      return bad();
  } else if (
    !e.source ||
    e.source.PipelineID !== scope.pipelineId ||
    e.source.PipelineRunID !== scope.runId ||
    e.source.JobRunID !== identity.jobRunId ||
    e.source.Digest !== identity.sourceBindingDigest ||
    !digest.test(e.source.Digest) ||
    !text(e.source.Repository, 2048) ||
    !text(e.source.Type, 64) ||
    typeof e.source.Ref !== "string" ||
    e.source.Ref.length > 512 ||
    /[\x00\r\n]/.test(e.source.Ref) ||
    !commit.test(e.inputs.sourceCommit)
  )
    return bad();
  let previous = "";
  for (let i = 0; i < e.artifacts.length; i++) {
    const a = e.artifacts[i],
      input = e.inputs.artifacts[i];
    if (
      !a ||
      !input ||
      !text(a.name) ||
      a.name <= previous ||
      a.name !== input.name ||
      !text(a.storageKey, 4096) ||
      a.storageKey !== input.key ||
      !text(a.producerJobRunId, 64) ||
      a.producerJobRunId === identity.jobRunId ||
      !text(a.producerStepRunId, 64) ||
      !sameReference(a.reference, input.reference)
    )
      return bad();
    previous = a.name;
  }
  return { approval, evidence: e, run };
}
export async function loadRetryApprovalReview(
  scope: ApprovalScope,
  id: string,
  signal?: AbortSignal,
) {
  const [approval, run] = await Promise.all([
    getApproval(scope.runId, id, signal),
    verifyApprovalScope(scope, signal),
  ]);
  return validateRetryApproval(scope, approval, run);
}
export function retryApprovalReviewKey(review: VerifiedRetryApproval) {
  return JSON.stringify({
    approval: review.approval,
    evidence: review.evidence,
    run: {
      runId: review.run.runId,
      pipelineId: review.run.pipelineId,
      status: review.run.status,
      definitionCommitSha: review.run.definitionCommitSha,
    },
  });
}
