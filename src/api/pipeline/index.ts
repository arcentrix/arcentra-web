import { get, post } from "../client";
import type {
  CreatePipelineInput,
  JobRun,
  Page,
  Pipeline,
  PipelineRun,
  PipelineSpec,
  RunLogs,
  RunStatus,
  StepRun,
  TriggerPipelineInput,
} from "./types";

type Wire = Record<string, unknown>;
const record = (value: unknown): Wire =>
  value && typeof value === "object" ? (value as Wire) : {};
const field = (value: Wire, key: string): unknown =>
  value[key] ??
  value[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
const str = (value: Wire, key: string): string =>
  String(field(value, key) ?? "");
const num = (value: Wire, key: string): number =>
  Number(field(value, key) ?? 0);
const pipelineStatuses: RunStatus[] = [
  "unknown",
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
  "paused",
];
const jobStatuses: RunStatus[] = [
  "unknown",
  "pending",
  "queued",
  "running",
  "success",
  "failed",
  "cancelled",
  "timeout",
  "skipped",
];
export function normalizeStatus(
  value: unknown,
  kind: "pipeline" | "job" = "pipeline",
): RunStatus {
  const statuses = kind === "pipeline" ? pipelineStatuses : jobStatuses;
  if (typeof value === "number" || /^\d+$/.test(String(value)))
    return statuses[Number(value)] ?? "unknown";
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/^(pipeline|job|step)_status_/, "");
  return statuses.includes(text as RunStatus) ? (text as RunStatus) : "unknown";
}
export function normalizePipeline(input: unknown): Pipeline {
  const v = record(input);
  return {
    pipelineId: str(v, "pipelineId"),
    projectId: str(v, "projectId"),
    name: str(v, "name"),
    description: str(v, "description"),
    repoUrl: str(v, "repoUrl"),
    defaultBranch: str(v, "defaultBranch"),
    pipelineFilePath: str(v, "pipelineFilePath"),
    status: normalizeStatus(v.status),
    isEnabled: num(v, "isEnabled"),
    totalRuns: num(v, "totalRuns"),
    successRuns: num(v, "successRuns"),
    failedRuns: num(v, "failedRuns"),
  };
}
export function normalizeRun(input: unknown): PipelineRun {
  const v = record(input);
  return {
    runId: str(v, "runId"),
    pipelineId: str(v, "pipelineId"),
    pipelineName: str(v, "pipelineName"),
    branch: str(v, "branch"),
    commitSha: str(v, "commitSha"),
    definitionCommitSha: str(v, "definitionCommitSha"),
    allowDeployments: field(v, "allowDeployments") === true,
    deploymentPlanHash: str(v, "deploymentPlanHash"),
    status: normalizeStatus(v.status),
    triggeredBy: str(v, "triggeredBy"),
    totalJobs: num(v, "totalJobs"),
    completedJobs: num(v, "completedJobs"),
    failedJobs: num(v, "failedJobs"),
    runningJobs: num(v, "runningJobs"),
    startTime: num(v, "startTime"),
    endTime: num(v, "endTime"),
    duration: num(v, "duration"),
  };
}
export function normalizeStep(input: unknown): StepRun {
  const v = record(input);
  return {
    stepRunId: str(v, "stepRunId"),
    deploymentReleaseId: str(v, "deploymentReleaseId"),
    uses: str(v, "uses"),
    action: str(v, "action"),
    attempt: num(v, "attempt") || 1,
    retryMode: str(v, "retryMode"),
    previousStepRunId: str(v, "previousStepRunId"),
    name: str(v, "name"),
    status: normalizeStatus(v.status, "job"),
    agentId: str(v, "agentId"),
    errorMessage: str(v, "errorMessage"),
    duration: num(v, "duration"),
    exitCode: field(v, "exitCode") == null ? null : num(v, "exitCode"),
  };
}
export function normalizeJob(input: unknown): JobRun {
  const v = record(input);
  const sourceExpectationCaptured =
    field(v, "sourceExpectationCaptured") === true;
  const sourceType = str(v, "sourceType");
  const sourceRepository = str(v, "sourceRepository");
  const sourceResolvedCommit = str(v, "sourceResolvedCommit");
  // Missing, abbreviated or unrecognized evidence remains unknown. In
  // particular, the run's legacy commitSha is never a source fallback.
  const reported =
    sourceExpectationCaptured &&
    sourceType === "git" &&
    !!sourceRepository &&
    field(v, "sourceProvenanceState") === "reported" &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceResolvedCommit);
  return {
    jobRunId: str(v, "jobRunId"),
    jobName: str(v, "jobName"),
    status: normalizeStatus(v.status, "job"),
    agentId: str(v, "agentId"),
    errorMessage: str(v, "errorMessage"),
    duration: num(v, "duration"),
    sourceExpectationCaptured,
    sourceType: sourceExpectationCaptured ? sourceType : "",
    sourceRepository: sourceExpectationCaptured ? sourceRepository : "",
    sourceRef: sourceExpectationCaptured ? str(v, "sourceRef") : "",
    sourceResolvedCommit: reported ? sourceResolvedCommit : "",
    sourceProvenanceState: reported ? "reported" : "unknown",
    steps: Array.isArray(v.steps) ? v.steps.map(normalizeStep) : [],
  };
}
function page<T>(input: unknown, normalize: (item: unknown) => T): Page<T> {
  const v = record(input);
  return {
    list: Array.isArray(v.list) ? v.list.map(normalize) : [],
    total: num(v, "total"),
    page: num(v, "page"),
    pageSize: num(v, "pageSize"),
  };
}
const id = encodeURIComponent;
export async function listPipelines(
  params: {
    projectId?: string;
    page?: number;
    pageSize?: number;
    name?: string;
  } = {},
  signal?: AbortSignal,
) {
  return page(
    await get("/pipelines/", {
      params: { page: 1, pageSize: 20, ...params },
      signal,
      silence: true,
    }),
    normalizePipeline,
  );
}
export async function getPipeline(pipelineId: string, signal?: AbortSignal) {
  return normalizePipeline(
    await get(`/pipelines/${id(pipelineId)}`, { signal, silence: true }),
  );
}
export const createPipeline = (data: CreatePipelineInput) =>
  post<{ pipelineID: string }>("/pipelines/", data, { silence: true });
export async function listRuns(
  pipelineId: string,
  params: { page?: number; status?: string } = {},
  signal?: AbortSignal,
) {
  return page(
    await get(`/pipelines/${id(pipelineId)}/runs`, {
      params: { page: 1, pageSize: 20, ...params },
      signal,
      silence: true,
    }),
    normalizeRun,
  );
}
export async function getRun(
  pipelineId: string,
  runId: string,
  signal?: AbortSignal,
) {
  return normalizeRun(
    await get(`/pipelines/${id(pipelineId)}/runs/${id(runId)}`, {
      signal,
      silence: true,
    }),
  );
}
export const triggerPipeline = (
  pipelineId: string,
  input: TriggerPipelineInput,
) =>
  post<{ runID: string }>(`/pipelines/${id(pipelineId)}/trigger`, input, {
    silence: true,
  });
export const stopRun = (pipelineId: string, runId: string) =>
  post(
    `/pipelines/${id(pipelineId)}/runs/${id(runId)}/stop`,
    { reason: "Cancelled from Build workspace" },
    { silence: true },
  );
export async function getRunJobs(
  pipelineId: string,
  runId: string,
  signal?: AbortSignal,
) {
  const data = record(
    await get(`/pipelines/${id(pipelineId)}/runs/${id(runId)}/jobs`, {
      signal,
      silence: true,
    }),
  );
  return (Array.isArray(data.list) ? data.list : []).map(normalizeJob);
}
export const getRunLogs = (
  pipelineId: string,
  runId: string,
  signal?: AbortSignal,
  params: { stepRunId?: string; fromLine?: number; limit?: number } = {},
) =>
  get<RunLogs>(`/pipelines/${id(pipelineId)}/runs/${id(runId)}/logs`, {
    params: { limit: 1000, ...params },
    signal,
    silence: true,
  });
export const getPipelineSpec = (pipelineId: string, signal?: AbortSignal) =>
  get<PipelineSpec>(`/pipelines/${id(pipelineId)}/spec`, {
    signal,
    silence: true,
  });
export const validatePipelineSpec = (
  pipelineId: string,
  spec: Record<string, unknown>,
) =>
  post<{ jobsCount: number; warnings: string[] }>(
    `/pipelines/${id(pipelineId)}/spec/validate`,
    { spec, format: "json" },
    { silence: true },
  );
export const savePipelineSpec = (
  pipelineId: string,
  spec: Record<string, unknown>,
  head: string,
  requestId: string,
) =>
  post<{ commitSha: string; prUrl: string }>(
    `/pipelines/${id(pipelineId)}/spec/save`,
    {
      spec,
      format: "json",
      expectedHeadCommitSha: head,
      requestId,
      commitMessage: "Update pipeline from Arcentra",
    },
    { silence: true },
  );
export const isActiveRun = (status: RunStatus) =>
  ["pending", "queued", "running", "paused"].includes(status);

export const isTerminalRun = (status: RunStatus) =>
  ["success", "failed", "cancelled", "timeout", "skipped"].includes(status);
