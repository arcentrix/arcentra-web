import { beforeEach, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  baselinePolling,
  disablePolling,
  enablePolling,
  getPollingCandidates,
  getPollingStatus,
  parsePollingCandidates,
  parsePollingStatus,
} from ".";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
const status = {
  supported: true,
  state: "disabled",
  revision: 0,
  selectedPipelines: [],
  blocker: "",
  capabilities: { canBaseline: true, canEnable: false, canDisable: false },
};
const candidate = {
  pipelineId: "build",
  name: "Build API",
  defaultBranch: "main",
  definitionPath: "pipeline.yaml",
  canEnable: true,
  eligible: true,
  blocker: "",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(status);
});
it("uses the safe project endpoints with cancellation and explicit bounded pagination", async () => {
  const signal = new AbortController().signal;
  vi.mocked(get)
    .mockResolvedValueOnce(status)
    .mockResolvedValueOnce({
      items: [candidate],
      total: 101,
      pageNum: 5,
      pageSize: 25,
    });
  expect(await getPollingStatus("project/one", signal)).toMatchObject(status);
  expect(await getPollingCandidates("project/one", 5, signal)).toMatchObject({
    total: 101,
    pageNum: 5,
  });
  expect(get).toHaveBeenNthCalledWith(1, "/project/project%2Fone/polling", {
    signal,
    silence: true,
  });
  expect(get).toHaveBeenNthCalledWith(
    2,
    "/project/project%2Fone/polling/candidates",
    { params: { pageNum: 5, pageSize: 25 }, signal, silence: true },
  );
  expect(post).not.toHaveBeenCalled();
});
it("sends only the explicit mutation DTO without caller authority, credentials or cursor", async () => {
  const signal = new AbortController().signal;
  await baselinePolling(
    "p",
    {
      expectedRevision: 0,
      acknowledgeDiscard: false,
      secret: "dropped",
    } as never,
    signal,
  );
  await enablePolling(
    "p",
    {
      expectedRevision: 1,
      baselineId: "base",
      pipelineIds: ["build"],
      actor: "dropped",
    } as never,
    signal,
  );
  await disablePolling(
    "p",
    { expectedRevision: 2, cursor: "dropped" } as never,
    signal,
  );
  expect(post).toHaveBeenNthCalledWith(
    1,
    "/project/p/polling/baseline",
    { expectedRevision: 0, acknowledgeDiscard: false },
    { signal, silence: true },
  );
  expect(post).toHaveBeenNthCalledWith(
    2,
    "/project/p/polling/enable",
    { expectedRevision: 1, baselineId: "base", pipelineIds: ["build"] },
    { signal, silence: true },
  );
  expect(post).toHaveBeenNthCalledWith(
    3,
    "/project/p/polling/disable",
    { expectedRevision: 2 },
    { signal, silence: true },
  );
});
it("projects safe status and candidate fields, preserving absence of restricted summaries", () => {
  const parsed = parsePollingStatus({
    ...status,
    cursorJson: "secret",
    token: "secret",
    selectedPipelines: [
      { pipelineId: "build", name: "Build API", hidden: "secret" },
    ],
    capabilities: { ...status.capabilities, role: "secret" },
    scope: {
      provider: "gitlab",
      stream: "merge_requests",
      repository: "https://gitlab.example/team/repo",
      token: "secret",
    },
  });
  expect(JSON.stringify(parsed)).not.toContain("secret");
  expect(parsed.lastObservationCount).toBeUndefined();
  expect(parsed.baselineObservationCount).toBeUndefined();
  expect(
    JSON.stringify(
      parsePollingCandidates({
        items: [{ ...candidate, secret: "secret" }],
        total: 1,
        pageNum: 1,
        pageSize: 25,
        hiddenPipelines: "secret",
      }),
    ),
  ).not.toContain("secret");
});
it("preserves authorized zero counts and retry/completion timestamps", () => {
  expect(
    parsePollingStatus({
      ...status,
      lastObservationCount: 0,
      lastTargetCount: 0,
      baselineObservationCount: 0,
      lastCompletedAt: "2026-10-16T01:00:00Z",
      nextRetryAt: "2026-10-16T01:01:00Z",
    }),
  ).toMatchObject({
    lastObservationCount: 0,
    lastTargetCount: 0,
    baselineObservationCount: 0,
  });
});
it.each([
  null,
  { ...status, state: "active" },
  { ...status, supported: "true" },
  { ...status, revision: Number.MAX_SAFE_INTEGER + 1 },
  { ...status, revision: -1 },
  { ...status, capabilities: {} },
  { ...status, selectedPipelines: null },
  { ...status, lastCompletedAt: "not-time" },
  { ...status, lastTargetCount: null },
  {
    ...status,
    scope: {
      provider: "gitlab",
      stream: "merge_requests",
      repository: "https://token:secret@gitlab.example/repo",
    },
  },
])("fails closed for malformed status %j", (value) =>
  expect(() => parsePollingStatus(value)).toThrow(),
);
it.each([
  null,
  { items: [], total: 0, pageNum: 0, pageSize: 25 },
  { items: [candidate], total: 0, pageNum: 1, pageSize: 25 },
  {
    items: [{ ...candidate, canEnable: "yes" }],
    total: 1,
    pageNum: 1,
    pageSize: 25,
  },
  { items: [candidate, candidate], total: 2, pageNum: 1, pageSize: 25 },
])("fails closed for malformed candidates %j", (value) =>
  expect(() => parsePollingCandidates(value)).toThrow(),
);
it("does not retry failed writes or swallow transport errors", async () => {
  const error = new Error("unknown outcome");
  vi.mocked(post).mockRejectedValue(error);
  await expect(disablePolling("p", { expectedRevision: 2 })).rejects.toBe(
    error,
  );
  expect(post).toHaveBeenCalledOnce();
});

it("rejects a mismatched page rather than silently presenting the wrong candidate set", async () => {
  vi.mocked(get).mockResolvedValue({
    items: [candidate],
    total: 101,
    pageNum: 1,
    pageSize: 25,
  });
  await expect(getPollingCandidates("p", 5)).rejects.toThrow(
    "Polling information is unavailable.",
  );
});
