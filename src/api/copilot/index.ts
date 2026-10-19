import { get, post } from "../client";

export interface CopilotModel {
  providerId: string;
  kind: "openai-compatible" | "anthropic";
  model: string;
}
export interface CopilotStatus {
  configured: boolean;
  models: CopilotModel[];
  codeContext:
    | "registered-text-artifacts-only"
    | "registered-text-artifacts-and-selected-github-files";
  // Older servers omit these fields; repository source selection fails closed.
  sourceContextEnabled?: boolean;
  maxSourceFiles?: number;
  maxSourceFileBytes?: number;
  historyEnabled?: boolean;
  historyAvailable?: boolean;
  historyRetentionDays?: number;
  historyMaxSelectedTurns?: number;
  historyMaxBytes?: number;
  maxContextBytes: number;
  maxQuestionBytes: number;
}
export interface CopilotSourceJob {
  jobRunId: string;
  name: string;
  status: number;
  available: boolean;
  reason: string;
  repository?: string;
  requestedRef?: string;
  resolvedCommit?: string;
  provenanceState: "unknown" | "reported";
}
export interface CopilotSourceFile {
  jobRunId: string;
  path: string;
}
export interface CopilotSources {
  steps: { stepRunId: string; name: string; status: number }[];
  artifacts: {
    artifactId: string;
    name: string;
    size: number;
    expiresAt?: string;
  }[];
  sourceJobs?: CopilotSourceJob[];
  warnings: string[];
}
export interface CopilotRequest {
  contextDigest?: string;
  requestId: string;
  runId: string;
  providerId: string;
  model: string;
  question: string;
  context: {
    stepRunIds: string[];
    artifactIds: string[];
    fromLine: number;
    sourceFiles?: CopilotSourceFile[];
  };
  shareSelectedContext: boolean;
}
export interface CopilotResult {
  requestId: string;
  text: string;
  evidence: {
    kind: string;
    id: string;
    name?: string;
    bytes: number;
    truncated: boolean;
    jobRunId?: string;
    repository?: string;
    requestedRef?: string;
    resolvedCommit?: string;
    path?: string;
    blobSHA?: string;
    provenanceState?: "unknown" | "reported";
  }[];
  warnings: string[];
  truncated: boolean;
}
const base = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/copilot`;
export const getCopilotStatus = (projectId: string, signal?: AbortSignal) =>
  get<CopilotStatus>(`${base(projectId)}/status`, {
    signal,
    silence: true,
    redactErrors: true,
  });
export const getCopilotSources = (
  projectId: string,
  runId: string,
  signal?: AbortSignal,
) =>
  get<CopilotSources>(
    `${base(projectId)}/runs/${encodeURIComponent(runId)}/context`,
    { signal, silence: true, redactErrors: true },
  );
export const analyzeCopilot = (
  projectId: string,
  input: CopilotRequest,
  signal?: AbortSignal,
) =>
  post<CopilotResult>(`${base(projectId)}/analysis`, input, {
    signal,
    silence: true,
    redactErrors: true,
    timeout: 55000,
  });
export const cancelCopilot = (projectId: string, requestId: string) =>
  post<{ cancelRequested: boolean }>(
    `${base(projectId)}/analysis/${encodeURIComponent(requestId)}/cancel`,
    {},
    { silence: true, redactErrors: true, timeout: 10000 },
  );

export interface CopilotPreview {
  text: string;
  digest: string;
  evidence: CopilotResult["evidence"];
  warnings: string[];
}
export const previewCopilot = (
  projectId: string,
  input: CopilotRequest,
  signal?: AbortSignal,
) =>
  post<CopilotPreview>(`${base(projectId)}/preview`, input, {
    signal,
    silence: true,
    redactErrors: true,
    timeout: 20000,
  });
