import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizePipeline,
  normalizeRun,
  normalizeJob,
  normalizeStatus,
  listPipelines,
  getRun,
  triggerPipeline,
  stopRun,
  getRunJobs,
} from "./index";
import { get, post } from "../client";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
describe("pipeline API contracts", () => {
  beforeEach(() => vi.clearAllMocks());
  it("normalizes legacy snake case, numeric enums and millisecond durations", () => {
    expect(
      normalizePipeline({
        pipeline_id: "p1",
        project_id: "pr1",
        is_enabled: 1,
      }),
    ).toMatchObject({ pipelineId: "p1", projectId: "pr1", isEnabled: 1 });
    expect(
      normalizeRun({
        run_id: "r1",
        status: 3,
        start_time: "1712345678",
        duration: "1234",
      }),
    ).toMatchObject({
      runId: "r1",
      status: "success",
      startTime: 1712345678,
      duration: 1234,
    });
  });
  it("normalizes protojson without confusing pipeline and job status numbers", () => {
    expect(
      normalizeRun({ runId: "r1", status: "PIPELINE_STATUS_RUNNING" }).status,
    ).toBe("running");
    expect(normalizeStatus(3)).toBe("success");
    expect(
      normalizeJob({
        jobRunId: "j1",
        status: 3,
        steps: [{ stepRunId: "s1", status: 5, exitCode: 2 }],
      }),
    ).toMatchObject({
      jobRunId: "j1",
      status: "running",
      steps: [{ stepRunId: "s1", status: "failed", exitCode: 2 }],
    });
    expect(normalizeStatus(99)).toBe("unknown");
  });
  it("handles null lists from an empty backend", async () => {
    vi.mocked(get).mockResolvedValue({ list: null, total: 0 });
    expect((await listPipelines()).list).toEqual([]);
    expect(await getRunJobs("p1", "r1")).toEqual([]);
  });
  it("uses scoped encoded run paths and carries idempotency through trigger retries", async () => {
    vi.mocked(get).mockResolvedValue({ runId: "run/a" });
    await getRun("pipeline/a", "run/a");
    expect(get).toHaveBeenCalledWith(
      "/pipelines/pipeline%2Fa/runs/run%2Fa",
      expect.any(Object),
    );
    await triggerPipeline("p1", { ENV: "test" }, "request-1");
    expect(post).toHaveBeenCalledWith(
      "/pipelines/p1/trigger",
      { variables: { ENV: "test" }, requestId: "request-1" },
      { silence: true },
    );
    await stopRun("p1", "r1");
    expect(post).toHaveBeenCalledWith(
      "/pipelines/p1/runs/r1/stop",
      expect.any(Object),
      { silence: true },
    );
  });
});
