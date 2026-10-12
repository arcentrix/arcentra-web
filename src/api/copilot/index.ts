import { get, post } from "../client";

export interface CopilotModel {
  providerId: string;
  kind: "openai-compatible" | "anthropic";
  model: string;
}
export interface CopilotStatus {
  configured: boolean;
  models: CopilotModel[];
  codeContext: "registered-text-artifacts-only";
  maxContextBytes: number;
  maxQuestionBytes: number;
}
export interface CopilotSources {
  steps: { stepRunId: string; name: string; status: number }[];
  artifacts: {
    artifactId: string;
    name: string;
    size: number;
    expiresAt?: string;
  }[];
  warnings: string[];
}
export interface CopilotRequest {
  contextDigest?: string;
  requestId: string;
  runId: string;
  providerId: string;
  model: string;
  question: string;
  context: { stepRunIds: string[]; artifactIds: string[]; fromLine: number };
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
  }[];
  warnings: string[];
  truncated: boolean;
}
const base = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/copilot`;
export const getCopilotStatus = (projectId: string, signal?: AbortSignal) =>
  get<CopilotStatus>(`${base(projectId)}/status`, { signal, silence: true });
export const getCopilotSources = (
  projectId: string,
  runId: string,
  signal?: AbortSignal,
) =>
  get<CopilotSources>(
    `${base(projectId)}/runs/${encodeURIComponent(runId)}/context`,
    { signal, silence: true },
  );
export const analyzeCopilot = (
  projectId: string,
  input: CopilotRequest,
  signal?: AbortSignal,
) =>
  post<CopilotResult>(`${base(projectId)}/analysis`, input, {
    signal,
    silence: true,
    timeout: 55000,
  });
export const cancelCopilot = (projectId: string, requestId: string) =>
  post<{ cancelRequested: boolean }>(
    `${base(projectId)}/analysis/${encodeURIComponent(requestId)}/cancel`,
    {},
    { silence: true, timeout: 10000 },
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
    timeout: 20000,
  });
