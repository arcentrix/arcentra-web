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
  getPipelineSpec,
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
    await triggerPipeline("p1", {
      variables: { ENV: "test" },
      requestId: "request-1",
      allowDeployments: false,
      expectedDefinitionCommitSha: "definition-1",
    });
    expect(post).toHaveBeenCalledWith(
      "/pipelines/p1/trigger",
      {
        variables: { ENV: "test" },
        requestId: "request-1",
        allowDeployments: false,
        expectedDefinitionCommitSha: "definition-1",
      },
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

it("carries the exact reviewed deployment definition and target hash to the real trigger route", async () => {
  const input = {
    variables: {},
    requestId: "request-k8s",
    allowDeployments: true,
    expectedDefinitionCommitSha: "reviewed-definition",
    expectedDeploymentPlanHash: "reviewed-target-hash",
  };
  await triggerPipeline("pipe/a", input);
  expect(post).toHaveBeenCalledWith("/pipelines/pipe%2Fa/trigger", input, {
    silence: true,
  });
  const controller = new AbortController();
  const review = {
    headCommitSha: "reviewed-definition",
    deploymentPlanHash: "reviewed-target-hash",
    deploymentPlan: { environmentId: "env" },
  };
  vi.mocked(get).mockResolvedValue(review);
  expect(await getPipelineSpec("pipe/a", controller.signal)).toEqual(review);
  expect(get).toHaveBeenCalledWith("/pipelines/pipe%2Fa/spec", {
    signal: controller.signal,
    silence: true,
    redactErrors: true,
  });
});
it("keeps definition provenance and release IDs from protojson or snake case", () => {
  expect(
    normalizeRun({
      definition_commit_sha: "definition",
      commit_sha: "legacy",
      allow_deployments: true,
      deployment_plan_hash: "hash",
    }),
  ).toMatchObject({
    definitionCommitSha: "definition",
    commitSha: "legacy",
    allowDeployments: true,
    deploymentPlanHash: "hash",
  });
  expect(
    normalizeJob({
      steps: [
        {
          deployment_release_id: "release-1",
          uses: "builtin:kubernetes",
          action: "deploy",
        },
      ],
    }).steps[0].deploymentReleaseId,
  ).toBe("release-1");
});

it.each([40, 64])(
  "normalizes per-job initial checkout evidence with a full %i-character SHA",
  (length) => {
    expect(
      normalizeJob({
        source_expectation_captured: true,
        source_type: "git",
        source_repository: "https://git.example/Case/Repo.git",
        source_ref: "refs/heads/release",
        source_resolved_commit: "a".repeat(length),
        source_provenance_state: "reported",
      }),
    ).toMatchObject({
      sourceExpectationCaptured: true,
      sourceType: "git",
      sourceRepository: "https://git.example/Case/Repo.git",
      sourceRef: "refs/heads/release",
      sourceResolvedCommit: "a".repeat(length),
      sourceProvenanceState: "reported",
    });
  },
);

it("keeps legacy and absent-source jobs unknown without inventing checkout from other SHA fields", () => {
  expect(
    normalizeJob({
      commitSha: "a".repeat(40),
      definitionCommitSha: "b".repeat(40),
    }),
  ).toMatchObject({
    sourceExpectationCaptured: false,
    sourceType: "",
    sourceRepository: "",
    sourceRef: "",
    sourceResolvedCommit: "",
    sourceProvenanceState: "unknown",
  });
  expect(normalizeJob({ sourceExpectationCaptured: true })).toMatchObject({
    sourceExpectationCaptured: true,
    sourceRepository: "",
    sourceResolvedCommit: "",
    sourceProvenanceState: "unknown",
  });
});

it.each([
  { sourceExpectationCaptured: false },
  { sourceProvenanceState: "verified" },
  { sourceProvenanceState: "unknown" },
  { sourceResolvedCommit: "abcdef1" },
  { sourceResolvedCommit: "A".repeat(40) },
  { sourceResolvedCommit: "z".repeat(40) },
  { sourceResolvedCommit: "a".repeat(41) },
  { sourceResolvedCommit: "" },
  { sourceRepository: "" },
  { sourceType: "" },
  { sourceType: "svn" },
])(
  "fails closed for unrecognized or malformed checkout evidence %j",
  (override) => {
    expect(
      normalizeJob({
        sourceExpectationCaptured: true,
        sourceType: "git",
        sourceRepository: "https://git.example/Repo.git",
        sourceRef: "main",
        sourceResolvedCommit: "a".repeat(40),
        sourceProvenanceState: "reported",
        ...override,
      }),
    ).toMatchObject({
      sourceResolvedCommit: "",
      sourceProvenanceState: "unknown",
    });
  },
);

it("saves retained DSL with explicit source format, CAS head and stable request ID", async () => {
  const { savePipelineSpec, validatePipelineSpec } = await import("./index");
  const spec = { namespace: "visual", jobs: [], meta: { preserve: true } };
  await validatePipelineSpec("pipe/a", spec);
  expect(post).toHaveBeenLastCalledWith(
    "/pipelines/pipe%2Fa/spec/validate",
    { spec, format: "json" },
    { silence: true, redactErrors: true },
  );
  await savePipelineSpec(
    "pipe/a",
    spec,
    "a".repeat(40),
    "same-request",
    "yaml",
  );
  expect(post).toHaveBeenLastCalledWith(
    "/pipelines/pipe%2Fa/spec/save",
    {
      spec,
      format: "yaml",
      expectedHeadCommitSha: "a".repeat(40),
      requestId: "same-request",
      commitMessage: "Update pipeline from Arcentra",
    },
    { silence: true, redactErrors: true },
  );
});
