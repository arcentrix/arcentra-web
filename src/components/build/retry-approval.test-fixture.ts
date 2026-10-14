import type { ApprovalRequest } from "@/api/approval";
import type { RetryApprovalEvidence } from "@/api/approval/retry-types";
import type { PipelineRun } from "@/api/pipeline/types";
export const retryScope = {
  projectId: "project",
  pipelineId: "pipeline",
  runId: "run",
};
export const hash = (letter = "a") => `v1:${letter.repeat(64)}`;
export function retryFixture() {
  const reference = {
    storageId: "storage",
    fingerprint: "b".repeat(64),
    sha256: "c".repeat(64),
    size: 7,
  };
  const evidence: RetryApprovalEvidence = {
    version: 1,
    kind: "retry_whole_job_v1",
    approvalId: "approval",
    context: {
      version: 1,
      projectId: "project",
      pipelineId: "pipeline",
      pipelineRunId: "run",
      actorId: "requester",
      definitionCommitSha: "d".repeat(40),
      definitionPath: ".arcentra/pipeline.yaml",
      resolvedDefinitionDigest: hash("d"),
      gatedJobs: ["build"],
      policy: {
        id: "operator-policy",
        fingerprint: hash("e"),
        candidates: ["operator"],
        mode: "any",
        requiredApproverCount: 1,
        timeoutSeconds: 3600,
      },
    },
    identity: {
      pipelineId: "pipeline",
      pipelineRunId: "run",
      jobRunId: "job",
      agentId: "agent",
      claimId: "claim",
      runtimeBindingDigest: hash(),
      sourceBindingDigest: hash("b"),
    },
    jobName: "build",
    retryPlan: {
      version: 1,
      retryApprovalRequired: true,
      retryApprovalTimeoutSeconds: 3600,
      definitionDigest: hash("c"),
      policy: {
        mode: "whole_job",
        max_attempts: 2,
        idempotent: true,
        allowed_exit_codes: [23],
        delay: "1s",
      },
      steps: [
        {
          name: "compile",
          stepIndex: 0,
          uses: "builtin:shell",
          action: "run",
          continueOnError: false,
          attemptRunIds: ["attempt-1", "attempt-2"],
          definitionDigest: hash("d"),
        },
      ],
    },
    retryPlanDigest: hash("e"),
    runtime: {
      type: "containerd-offline-v1",
      image: `docker.io/library/alpine@sha256:${"f".repeat(64)}`,
      resources: { cpu: "500m", memory: "128Mi" },
      bindingDigest: hash(),
    },
    source: {
      PipelineID: "pipeline",
      PipelineRunID: "run",
      JobRunID: "job",
      Type: "git",
      Repository: "https://github.com/example/source.git",
      Ref: "main",
      Digest: hash("b"),
    },
    inputs: {
      version: 1,
      sourceCommit: "e".repeat(40),
      artifacts: [
        { name: "input", key: "project/run/producer/input", reference },
      ],
    },
    inputManifestDigest: hash("f"),
    artifacts: [
      {
        name: "input",
        producerJobRunId: "producer",
        producerStepRunId: "producer-step",
        storageKey: "project/run/producer/input",
        reference: { ...reference },
      },
    ],
    createdAtUnixMilli: Date.parse("2099-01-01T00:00:00Z"),
    expiresAtUnixMilli: Date.parse("2099-01-01T01:00:00Z"),
  };
  const approval: ApprovalRequest = {
    approvalId: "approval",
    pipelineRunId: "run",
    jobName: "build",
    stepName: "",
    plugin: "builtin:retry-approval",
    bindingKind: "retry_whole_job_v1",
    status: 0,
    mode: "any",
    requiredApproverCount: 1,
    approvedCount: 0,
    rejectedCount: 0,
    requestedBy: "requester",
    candidateApprovers: '["operator"]',
    expiresAt: "2099-01-01T01:00:00Z",
    retryJobRunId: "job",
    evidenceHash: hash(),
    version: 1,
    canApprove: true,
    canReject: true,
    retryReview: {
      approvalId: "approval",
      retryJobRunId: "job",
      evidenceHash: hash(),
      status: 0,
      evidence,
    },
  };
  const run = {
    runId: "run",
    pipelineId: "pipeline",
    status: "running",
    definitionCommitSha: "d".repeat(40),
  } as PipelineRun;
  return { approval, evidence, run };
}
