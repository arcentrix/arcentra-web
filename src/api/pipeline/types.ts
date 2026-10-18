export type RunStatus =
  | "unknown"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "paused"
  | "queued"
  | "timeout"
  | "skipped";
export interface Pipeline {
  pipelineId: string;
  projectId: string;
  name: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  pipelineFilePath: string;
  status: RunStatus;
  isEnabled: number;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
}
export interface PipelineRun {
  runId: string;
  pipelineId: string;
  pipelineName: string;
  branch: string;
  /** Ambiguous legacy trigger value; never per-job checkout evidence. */
  commitSha: string;
  definitionCommitSha?: string;
  allowDeployments?: boolean;
  deploymentPlanHash?: string;
  status: RunStatus;
  triggeredBy: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  startTime: number;
  endTime: number;
  duration: number;
}
export interface RetryPolicy {
  mode: "failed_step" | "whole_job";
  maxAttempts: number;
  delay?: string;
  allowedExitCodes: number[];
  idempotent: boolean;
}
export interface StepRun {
  uses?: string;
  action?: string;
  deploymentReleaseId?: string;
  attempt?: number;
  retryMode?: string;
  previousStepRunId?: string;
  stepRunId: string;
  name: string;
  status: RunStatus;
  agentId: string;
  errorMessage: string;
  duration: number;
  exitCode: number | null;
}
export interface JobRun {
  jobRunId: string;
  jobName: string;
  status: RunStatus;
  agentId: string;
  errorMessage: string;
  duration: number;
  sourceExpectationCaptured: boolean;
  sourceType: string;
  sourceRepository: string;
  sourceRef: string;
  /** Agent-reported initial checkout only, not a current-workspace attestation. */
  sourceResolvedCommit: string;
  sourceProvenanceState: "unknown" | "reported";
  steps: StepRun[];
}
export interface Page<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CreatePipelineInput {
  projectId: string;
  name: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  pipelineFilePath: string;
  saveMode: "direct" | "pr";
}
export interface PipelineDeploymentPlan {
  approvalRequired?: boolean;
  jobName: string;
  stepName: string;
  environmentId: string;
  artifact: { job: string; step: string; name: string };
  timeoutSeconds: number;
  target: {
    environmentId: string;
    projectId: string;
    name: string;
    targetRef: string;
    namespace: string;
    deployment: string;
    container: string;
    configured: boolean;
    allowPipelineDeployments: boolean;
    pipelineApproval?: {
      approvers: string[];
      minApprovals: number;
      timeoutSeconds: number;
    };
  };
}
export interface TriggerPipelineInput {
  variables: Record<string, string>;
  requestId: string;
  allowDeployments: boolean;
  expectedDefinitionCommitSha: string;
  expectedDeploymentPlanHash?: string;
}
export interface PipelineSpec {
  spec: Record<string, unknown>;
  deploymentPlan?: PipelineDeploymentPlan | null;
  deploymentReviewError?: string;
  deploymentPlanHash?: string;
  format: string;
  headCommitSha: string;
  branch: string;
  pipelineFilePath: string;
}
export interface RunLog {
  /** Step-wide Write-chunk position across streams, not a text line. Legacy rows may omit it. */
  lineNumber?: number;
  stream?: string;
  timestamp: string | number;
  level: string;
  message: string;
  jobId?: string;
  stepId?: string;
}
export interface RunLogs {
  entries: RunLog[];
  truncated?: boolean;
}
