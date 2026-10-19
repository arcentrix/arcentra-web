import { get, post } from "../client";
import type {
  BaselinePollingInput,
  DisablePollingInput,
  EnablePollingInput,
  PollingCandidates,
  PollingPipeline,
  PollingStatus,
} from "./types";

const invalid = () => new Error("Polling information is unavailable.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalid();
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw invalid();
  return value;
}
function optional<T>(
  value: unknown,
  parse: (value: unknown) => T,
): T | undefined {
  return value === undefined ? undefined : parse(value);
}
function timestamp(value: unknown): string {
  const parsed = string(value);
  if (!Number.isFinite(Date.parse(parsed))) throw invalid();
  return parsed;
}
function pipeline(value: unknown): PollingPipeline {
  const row = object(value);
  const pipelineId = string(row.pipelineId);
  const name = string(row.name);
  if (!pipelineId || !name.trim()) throw invalid();
  return { pipelineId, name };
}
/** Project only the documented DTO; accidental internal fields are never retained. */
export function parsePollingStatus(value: unknown): PollingStatus {
  const row = object(value);
  const state = row.state;
  if (
    !(["disabled", "baselined", "enabled", "paused"] as unknown[]).includes(
      state,
    )
  )
    throw invalid();
  const capabilities = object(row.capabilities);
  if (!Array.isArray(row.selectedPipelines)) throw invalid();
  let scope: PollingStatus["scope"];
  if (row.scope !== undefined) {
    const raw = object(row.scope);
    const repository = string(raw.repository);
    const url = new URL(repository);
    const { provider, stream } = raw;
    // The server preserves an explicit default HTTPS port for configured
    // GitLab/Gitea origins. WHATWG URL omits it; permit only that exact form,
    // never broader URL normalization or explicit ports for GitHub.com.
    const preservedDefaultPort =
      (provider === "gitlab" || provider === "gitea") &&
      repository === `https://${url.hostname}:443${url.pathname}`;
    if (
      url.protocol !== "https:" ||
      (url.href !== repository && !preservedDefaultPort) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /[?#]/.test(repository) ||
      !/^\/(?:[^/]+\/)+[^/]+$/.test(url.pathname) ||
      /[\\%\s]/.test(repository) ||
      (provider === "github" &&
        (url.origin !== "https://github.com" ||
          !/^\/[^/]+\/[^/]+$/.test(url.pathname)))
    )
      throw invalid();
    if (provider === "gitlab" && stream === "merge_requests")
      scope = { provider, repository, stream };
    else if (
      (provider === "github" || provider === "gitea") &&
      stream === "pull_requests"
    )
      scope = { provider, repository, stream };
    else throw invalid();
  }
  return {
    supported: boolean(row.supported),
    state: state as PollingStatus["state"],
    revision: integer(row.revision),
    baselineId: optional(row.baselineId, string),
    baselineCompletedAt: optional(row.baselineCompletedAt, timestamp),
    baselineObservationCount: optional(row.baselineObservationCount, integer),
    authorizerId: optional(row.authorizerId, string),
    scope,
    selectedPipelines: row.selectedPipelines.map(pipeline),
    blocker: string(row.blocker),
    capabilities: {
      canBaseline: boolean(capabilities.canBaseline),
      canEnable: boolean(capabilities.canEnable),
      canDisable: boolean(capabilities.canDisable),
    },
    nextRetryAt: optional(row.nextRetryAt, timestamp),
    lastPollError: optional(row.lastPollError, string),
    lastCompletedAt: optional(row.lastCompletedAt, timestamp),
    lastObservationCount: optional(row.lastObservationCount, integer),
    lastTargetCount: optional(row.lastTargetCount, integer),
  };
}
export function parsePollingCandidates(value: unknown): PollingCandidates {
  const row = object(value);
  if (!Array.isArray(row.items)) throw invalid();
  const total = integer(row.total),
    pageNum = integer(row.pageNum),
    pageSize = integer(row.pageSize);
  if (
    !pageNum ||
    !pageSize ||
    pageSize > 100 ||
    row.items.length > pageSize ||
    row.items.length > total
  )
    throw invalid();
  const items = row.items.map((value) => {
    const item = object(value);
    return {
      ...pipeline(item),
      defaultBranch: string(item.defaultBranch),
      definitionPath: string(item.definitionPath),
      canEnable: boolean(item.canEnable),
      eligible: boolean(item.eligible),
      blocker: string(item.blocker),
    };
  });
  if (new Set(items.map((item) => item.pipelineId)).size !== items.length)
    throw invalid();
  return { items, total, pageNum, pageSize };
}
const path = (projectId: string) =>
  `/project/${encodeURIComponent(projectId)}/polling`;
export async function getPollingStatus(
  projectId: string,
  signal?: AbortSignal,
) {
  return parsePollingStatus(
    await get<unknown>(path(projectId), { signal, silence: true }),
  );
}
export async function getPollingCandidates(
  projectId: string,
  pageNum = 1,
  signal?: AbortSignal,
) {
  const result = parsePollingCandidates(
    await get<unknown>(`${path(projectId)}/candidates`, {
      params: { pageNum, pageSize: 25 },
      signal,
      silence: true,
    }),
  );
  if (result.pageNum !== pageNum || result.pageSize !== 25) throw invalid();
  return result;
}
export async function baselinePolling(
  projectId: string,
  input: BaselinePollingInput,
  signal?: AbortSignal,
) {
  return parsePollingStatus(
    await post<unknown>(
      `${path(projectId)}/baseline`,
      {
        expectedRevision: input.expectedRevision,
        acknowledgeDiscard: input.acknowledgeDiscard,
      },
      { signal, silence: true },
    ),
  );
}
export async function enablePolling(
  projectId: string,
  input: EnablePollingInput,
  signal?: AbortSignal,
) {
  return parsePollingStatus(
    await post<unknown>(
      `${path(projectId)}/enable`,
      {
        expectedRevision: input.expectedRevision,
        baselineId: input.baselineId,
        pipelineIds: input.pipelineIds,
      },
      { signal, silence: true },
    ),
  );
}
export async function disablePolling(
  projectId: string,
  input: DisablePollingInput,
  signal?: AbortSignal,
) {
  return parsePollingStatus(
    await post<unknown>(
      `${path(projectId)}/disable`,
      {
        expectedRevision: input.expectedRevision,
      },
      { signal, silence: true },
    ),
  );
}
