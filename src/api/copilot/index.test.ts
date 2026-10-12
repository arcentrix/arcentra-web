import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeCopilot,
  cancelCopilot,
  getCopilotSources,
  getCopilotStatus,
  previewCopilot,
} from "./index";
import { get, post } from "../client";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe("Copilot authenticated API contracts", () => {
  it("encodes project/run IDs and forwards cancellation without bypassing the shared client", () => {
    const signal = new AbortController().signal;
    getCopilotStatus("project/a", signal);
    getCopilotSources("project/a", "run/b", signal);
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/projects/project%2Fa/copilot/status",
      { signal, silence: true },
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/projects/project%2Fa/copilot/runs/run%2Fb/context",
      { signal, silence: true },
    );
  });
  it("sends exact explicit selections and preview digest; cancellation has an independent request", () => {
    const signal = new AbortController().signal;
    const input = {
      requestId: "request",
      runId: "run",
      providerId: "approved",
      model: "model",
      question: "why?",
      context: { stepRunIds: ["step"], artifactIds: [], fromLine: 10 },
      contextDigest: "digest",
      shareSelectedContext: true,
    };
    previewCopilot("p", { ...input, shareSelectedContext: false }, signal);
    analyzeCopilot("p", input, signal);
    cancelCopilot("p", "request");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/projects/p/copilot/preview",
      { ...input, shareSelectedContext: false },
      { signal, silence: true, timeout: 20000 },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/projects/p/copilot/analysis",
      input,
      { signal, silence: true, timeout: 55000 },
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/projects/p/copilot/analysis/request/cancel",
      {},
      { silence: true, timeout: 10000 },
    );
  });
  it("supports source-only context using job identity and path through the authenticated client", () => {
    const input = {
      requestId: "source-request",
      runId: "run",
      providerId: "approved",
      model: "model",
      question: "Why did this fail?",
      context: {
        stepRunIds: [],
        artifactIds: [],
        fromLine: 0,
        sourceFiles: [{ jobRunId: "job", path: "src/main.go" }],
      },
      shareSelectedContext: false,
    };
    previewCopilot("project/a", input);
    expect(post).toHaveBeenCalledWith(
      "/projects/project%2Fa/copilot/preview",
      input,
      {
        signal: undefined,
        silence: true,
        timeout: 20000,
      },
    );
  });
});
