/** Exact persisted evidence encoding. Nested source and protobuf policy retain backend wire casing. */
export interface RetryArtifactReference {
  storageId: string;
  fingerprint: string;
  expiresAt?: number;
  sha256: string;
  size: number;
}
export interface RetryApprovalEvidence {
  version: 1;
  kind: "retry_whole_job_v1";
  approvalId: string;
  context: {
    version: 1;
    projectId: string;
    pipelineId: string;
    pipelineRunId: string;
    actorId: string;
    definitionCommitSha: string;
    definitionPath: string;
    resolvedDefinitionDigest: string;
    gatedJobs: string[];
    policy: {
      id: string;
      fingerprint: string;
      candidates: string[];
      mode: string;
      requiredApproverCount: number;
      timeoutSeconds: number;
    };
  };
  identity: {
    pipelineId: string;
    pipelineRunId: string;
    jobRunId: string;
    agentId: string;
    claimId: string;
    runtimeBindingDigest: string;
    sourceBindingDigest: string;
  };
  jobName: string;
  retryPlan: {
    version: 1;
    retryApprovalRequired: true;
    retryApprovalTimeoutSeconds: number;
    policy: {
      mode: "whole_job";
      max_attempts: number;
      idempotent: true;
      allowed_exit_codes: number[];
      delay?: string;
    };
    definitionDigest: string;
    steps: {
      name: string;
      stepIndex: number;
      uses: string;
      action: string;
      continueOnError: boolean;
      attemptRunIds: string[];
      definitionDigest: string;
    }[];
  };
  retryPlanDigest: string;
  runtime: {
    type: "containerd-offline-v1";
    image: string;
    resources: { cpu: string; memory: string };
    bindingDigest: string;
  };
  source: {
    PipelineID: string;
    PipelineRunID: string;
    JobRunID: string;
    Type: string;
    Repository: string;
    Ref: string;
    Digest: string;
  } | null;
  inputs: {
    version: 1;
    sourceCommit: string;
    artifacts: {
      name: string;
      key: string;
      reference: RetryArtifactReference;
    }[];
  };
  inputManifestDigest: string;
  artifacts: {
    name: string;
    producerJobRunId: string;
    producerStepRunId: string;
    storageKey: string;
    reference: RetryArtifactReference;
  }[];
  createdAtUnixMilli: number;
  expiresAtUnixMilli: number;
}
export interface RetryApprovalReview {
  approvalId: string;
  retryJobRunId: string;
  evidenceHash: string;
  status: number;
  evidence: RetryApprovalEvidence;
}
