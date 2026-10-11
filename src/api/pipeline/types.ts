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
  commitSha: string;
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
export interface StepRun {
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
export interface PipelineSpec {
  spec: Record<string, unknown>;
  format: string;
  headCommitSha: string;
  branch: string;
  pipelineFilePath: string;
}
export interface RunLog {
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
