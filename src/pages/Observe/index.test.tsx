import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Apis } from "@/api";
import { getPipeline, listPipelines, listRuns } from "@/api/pipeline";
import type { Page, Pipeline, PipelineRun } from "@/api/pipeline/types";
import type { Agent, ListAgentsResponse } from "@/api/agent/types";
import { listAgentHealth } from "@/api/observe";
import { ApiError } from "@/lib/api-error";
import Observe from "./index";

vi.mock("@/api", () => ({ Apis: { me: { getEffectiveActions: vi.fn() } } }));
vi.mock("@/api/observe", () => ({ listAgentHealth: vi.fn() }));
vi.mock("@/api/pipeline", async (original) => ({
  ...(await original<typeof import("@/api/pipeline")>()),
  getPipeline: vi.fn(),
  listPipelines: vi.fn(),
  listRuns: vi.fn(),
}));

const pipeline: Pipeline = {
  pipelineId: "p1",
  projectId: "project-1",
  name: "Production checks",
  description: "Repository-backed checks",
  repoUrl: "",
  defaultBranch: "main",
  pipelineFilePath: ".arcentra.yml",
  status: "failed",
  isEnabled: 1,
  totalRuns: 100,
  successRuns: 80,
  failedRuns: 20,
};
const run: PipelineRun = {
  runId: "run-failed",
  pipelineId: "p1",
  pipelineName: pipeline.name,
  branch: "main",
  commitSha: "abc123456",
  status: "failed",
  triggeredBy: "tester",
  totalJobs: 3,
  completedJobs: 1,
  failedJobs: 2,
  runningJobs: 0,
  startTime: 1791777600,
  endTime: 1791777660,
  duration: 60000,
};
const agent: Agent = {
  id: 1,
  agentId: "runner-1",
  agentName: "Actual runner",
  address: "",
  port: "",
  os: "linux",
  arch: "amd64",
  version: "v1.2",
  status: 4,
  labels: {},
  metrics: "",
  isEnabled: 1,
  lastHeartbeat: "2026-10-12T04:00:00Z",
};
const page = <T,>(list: T[], total = list.length, number = 1): Page<T> => ({
  list,
  total,
  page: number,
  pageSize: 20,
});
const agents = (
  list: Agent[] = [agent],
  count = list.length,
  number = 1,
): ListAgentsResponse => ({
  agents: list,
  count,
  pageNum: number,
  pageSize: 20,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function show(initial = "/observe") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Harness() {
    navigate = useNavigate();
    location = useLocation();
    return <Observe />;
  }
  return {
    ...render(
      <MemoryRouter initialEntries={[initial]}>
        <Harness />
      </MemoryRouter>,
    ),
    router: {
      get search() {
        return location.search;
      },
      navigate: (to: string | number) =>
        act(() => {
          if (typeof to === "number") navigate(to);
          else navigate(to);
        }),
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue(["agent:read"]);
  vi.mocked(listPipelines).mockResolvedValue(page([pipeline]));
  vi.mocked(getPipeline).mockImplementation(async (id) => ({
    ...pipeline,
    pipelineId: id,
    name: id === "p1" ? pipeline.name : `Pipeline ${id}`,
  }));
  vi.mocked(listRuns).mockResolvedValue(page([run]));
  vi.mocked(listAgentHealth).mockResolvedValue(agents());
});
afterEach(cleanup);

describe("Observe execution health", () => {
  it("renders real run and heartbeat snapshots with page-scoped summaries and encoded log links", async () => {
    vi.mocked(listRuns).mockResolvedValue(
      page(
        [
          run,
          {
            ...run,
            runId: "run-good",
            status: "success",
            failedJobs: 0,
            duration: 120000,
          },
          {
            ...run,
            runId: "run-active",
            status: "running",
            failedJobs: 0,
            duration: 900000,
          },
        ],
        75,
      ),
    );
    vi.mocked(listAgentHealth).mockResolvedValue(
      agents(
        [
          agent,
          {
            ...agent,
            agentId: "busy-1",
            agentName: "Busy runner",
            status: 3,
            lastHeartbeat: null,
          },
          {
            ...agent,
            agentId: "off-1",
            agentName: "Offline runner",
            status: 2,
            isEnabled: 0,
          },
        ],
        45,
      ),
    );
    show();
    expect(
      await screen.findByRole("table", { name: "Pipeline execution health" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /75 total runs · metrics below describe only the 3 runs/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Current run page summary")).getByText(
        "1m 30s",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 failed jobs")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Inspect run run-failed and logs" }),
    ).toHaveAttribute("href", "/build?pipeline=p1&run=run-failed");
    expect(
      await screen.findByText("45 registered agents · 3 loaded on this page"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 available · 1 busy · 1 offline · 1 disabled on this page",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not reported")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "Agent health" })).getAllByText(
        new Date(agent.lastHeartbeat!).toLocaleString(),
      ),
    ).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Actual runner" })).toHaveAttribute(
      "href",
      "/agents/runner-1",
    );
    expect(
      screen.queryByText(/99.94|Error budget|ml-inference|p95/),
    ).not.toBeInTheDocument();
  });

  it("does not infer agent access from pipeline or Observe menu permissions", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([
      "pipeline:view_log",
      "pipeline:read",
    ]);
    show();
    expect(
      await screen.findByText(/Agent health requires platform agent:read/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("table", { name: "Pipeline execution health" }),
    ).toBeInTheDocument();
    expect(listAgentHealth).not.toHaveBeenCalled();
    expect(Apis.me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "platform" },
      expect.any(AbortSignal),
    );
  });

  it("keeps agents usable when a deep-linked pipeline requires read permission", async () => {
    vi.mocked(getPipeline).mockRejectedValue(
      new ApiError({
        status: 403,
        message: "Permission denied",
        requestId: "trace-pipeline",
      }),
    );
    show("/observe?pipeline=private-pipeline");
    expect(
      await screen.findByText("Pipeline access restricted"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/requires pipeline:read for this pipeline/),
    ).toBeInTheDocument();
    expect(await screen.findByText("Actual runner")).toBeInTheDocument();
    expect(listRuns).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "View diagnostics" }));
    expect(screen.getByText("trace-pipeline")).toBeInTheDocument();
  });

  it("checks agent permission errors independently and retries before fetching agents", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockRejectedValueOnce(
      new Error("Permission service unavailable"),
    );
    show();
    expect(
      await screen.findByText("Agent permission check unavailable"),
    ).toBeInTheDocument();
    expect(listAgentHealth).not.toHaveBeenCalled();
    expect(await screen.findByText("run-failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Actual runner")).toBeInTheDocument();
  });

  it("shows loading and truthful empty states instead of fixtures", async () => {
    const pending = deferred<Page<Pipeline>>();
    vi.mocked(listPipelines).mockReturnValue(pending.promise);
    vi.mocked(listAgentHealth).mockResolvedValue(agents([]));
    show();
    expect(screen.getByText("Loading pipelines…")).toBeInTheDocument();
    expect(
      await screen.findByText("No registered agents yet."),
    ).toBeInTheDocument();
    await act(async () => pending.resolve(page([])));
    expect(
      await screen.findByText(/No readable pipelines found/),
    ).toBeInTheDocument();
    expect(listRuns).not.toHaveBeenCalled();
  });

  it("retries a collection failure without blocking an independently selected permitted pipeline", async () => {
    vi.mocked(listPipelines).mockRejectedValueOnce(
      new Error("Collection failed"),
    );
    show("/observe?pipeline=permitted%2Fpipeline");
    expect(
      await screen.findByText("Pipeline list unavailable"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Open in Build" }),
    ).toHaveAttribute("href", "/build?pipeline=permitted%2Fpipeline");
    expect(getPipeline).toHaveBeenCalledWith(
      "permitted/pipeline",
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("button", { name: /Production checks/ }),
    ).toBeInTheDocument();
  });

  it("pages and filters runs in URL state and restores it with browser Back", async () => {
    vi.mocked(listRuns).mockImplementation(async (_id, params) =>
      page(
        [
          {
            ...run,
            runId: params?.status
              ? "only-failed"
              : params?.page === 2
                ? "older-run"
                : "newest-run",
          },
        ],
        42,
        params?.page,
      ),
    );
    const { router } = show("/observe?pipeline=p1");
    await screen.findByText("newest-run");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Run pages" })).getByRole(
        "button",
        { name: "Next" },
      ),
    );
    expect(await screen.findByText("older-run")).toBeInTheDocument();
    expect(router.search).toContain("runPage=2");
    fireEvent.change(screen.getByLabelText("Run status"), {
      target: { value: "failed" },
    });
    expect(await screen.findByText("only-failed")).toBeInTheDocument();
    expect(router.search).not.toContain("runPage");
    expect(listRuns).toHaveBeenLastCalledWith(
      "p1",
      { page: 1, status: "failed" },
      expect.any(AbortSignal),
    );
    router.navigate(-1);
    expect(await screen.findByText("older-run")).toBeInTheDocument();
    expect(screen.getByLabelText("Run status")).toHaveValue("");
  });

  it("paginates and searches accessible pipelines without retaining another pipeline's runs", async () => {
    vi.mocked(listPipelines).mockImplementation(async (params) =>
      page(
        [
          {
            ...pipeline,
            pipelineId: params?.name
              ? "searched"
              : params?.page === 2
                ? "second"
                : "p1",
            name: params?.name
              ? "Search match"
              : params?.page === 2
                ? "Second pipeline"
                : pipeline.name,
          },
        ],
        41,
        params?.page,
      ),
    );
    const { router } = show();
    await screen.findByText("run-failed");
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Pipeline pages" }),
      ).getByRole("button", { name: "Next" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Pipeline second" }),
    ).toBeInTheDocument();
    expect(router.search).toContain("pipelinePage=2");
    fireEvent.change(screen.getByLabelText("Search pipelines"), {
      target: { value: "Search match" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      await screen.findByRole("heading", { name: "Pipeline searched" }),
    ).toBeInTheDocument();
    expect(router.search).not.toContain("pipelinePage");
    expect(listPipelines).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 20, name: "Search match" },
      expect.any(AbortSignal),
    );
  });

  it("aborts old run requests and ignores late success after switching pipelines", async () => {
    const old = deferred<Page<PipelineRun>>();
    let oldSignal!: AbortSignal;
    vi.mocked(listPipelines).mockResolvedValue(
      page([
        pipeline,
        { ...pipeline, pipelineId: "p2", name: "Second pipeline" },
      ]),
    );
    vi.mocked(listRuns).mockImplementation((id, _params, signal) => {
      if (id === "p1") {
        oldSignal = signal!;
        return old.promise;
      }
      return Promise.resolve(
        page([{ ...run, runId: "current-run", pipelineId: "p2" }]),
      );
    });
    show();
    await waitFor(() => expect(oldSignal).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: /Second pipeline/ }));
    expect(await screen.findByText("current-run")).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () =>
      old.resolve(page([{ ...run, runId: "obsolete-run" }])),
    );
    expect(screen.queryByText("obsolete-run")).not.toBeInTheDocument();
  });

  it("does not show previously loaded rows or page metrics after run access is revoked", async () => {
    show();
    await screen.findByText("run-failed");
    vi.mocked(listRuns).mockRejectedValue(
      new ApiError({ status: 403, message: "Run access revoked" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(
      await screen.findByText("Run history access restricted"),
    ).toBeInTheDocument();
    expect(screen.queryByText("run-failed")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Current run page summary"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Actual runner")).toBeInTheDocument();
  });

  it("hides agents and cancels pending reads when refreshed permission is revoked", async () => {
    const pending = deferred<ListAgentsResponse>();
    let signal!: AbortSignal;
    vi.mocked(listAgentHealth).mockImplementation((_page, nextSignal) => {
      signal = nextSignal!;
      return pending.promise;
    });
    show();
    await waitFor(() => expect(listAgentHealth).toHaveBeenCalled());
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(
      await screen.findByText(/Agent health requires platform agent:read/),
    ).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(agents()));
    expect(screen.queryByText("Actual runner")).not.toBeInTheDocument();
    expect(await screen.findByText("run-failed")).toBeInTheDocument();
  });

  it("paginates agents, cancels stale page responses, and recovers out-of-range pages", async () => {
    const pending = deferred<ListAgentsResponse>();
    let oldSignal!: AbortSignal;
    vi.mocked(listAgentHealth).mockImplementation((number, signal) => {
      if (number === 2) {
        oldSignal = signal!;
        return pending.promise;
      }
      return Promise.resolve(
        number === 9 ? agents([], 21, 9) : agents([agent], 21),
      );
    });
    const { router } = show();
    await screen.findByText("Actual runner");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Agent pages" })).getByRole(
        "button",
        { name: "Next" },
      ),
    );
    await waitFor(() => expect(oldSignal).toBeDefined());
    router.navigate("/observe?agentPage=9");
    expect(
      await screen.findByText("No agents on this page."),
    ).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () =>
      pending.resolve(
        agents([{ ...agent, agentName: "Obsolete agent" }], 21, 2),
      ),
    );
    expect(screen.queryByText("Obsolete agent")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Agent pages" })).getByRole(
        "button",
        { name: "Back to first page" },
      ),
    );
    expect(await screen.findByText("Actual runner")).toBeInTheDocument();
  });

  it("handles agent 403 independently and can retry access without losing runs", async () => {
    vi.mocked(listAgentHealth).mockRejectedValueOnce(
      new ApiError({ status: 403, message: "Fleet denied" }),
    );
    show();
    expect(
      await screen.findByText("Agent health access restricted"),
    ).toBeInTheDocument();
    expect(await screen.findByText("run-failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    expect(await screen.findByText("Actual runner")).toBeInTheDocument();
  });

  it("aborts pending collection and permission requests on unmount", async () => {
    const pendingPipelines = deferred<Page<Pipeline>>();
    const pendingPermission = deferred<string[]>();
    vi.mocked(listPipelines).mockReturnValue(pendingPipelines.promise);
    vi.mocked(Apis.me.getEffectiveActions).mockReturnValue(
      pendingPermission.promise,
    );
    const { unmount } = show();
    const pipelineSignal = vi.mocked(listPipelines).mock.calls[0][1]!;
    const permissionSignal = vi.mocked(Apis.me.getEffectiveActions).mock
      .calls[0][1]!;
    unmount();
    expect(pipelineSignal.aborted).toBe(true);
    expect(permissionSignal.aborted).toBe(true);
    await act(async () => {
      pendingPipelines.resolve(page([pipeline]));
      pendingPermission.resolve(["agent:read"]);
    });
    expect(listAgentHealth).not.toHaveBeenCalled();
    expect(getPipeline).not.toHaveBeenCalled();
  });
  it("normalizes overflowing URL pages before any API request", async () => {
    show(
      "/observe?pipelinePage=4294967297&runPage=4294967297&agentPage=4294967297&runStatus=invalid",
    );
    expect(await screen.findByText("run-failed")).toBeInTheDocument();
    expect(await screen.findByText("Actual runner")).toBeInTheDocument();
    expect(listPipelines).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 20, name: undefined },
      expect.any(AbortSignal),
    );
    expect(listRuns).toHaveBeenLastCalledWith(
      "p1",
      { page: 1, status: undefined },
      expect.any(AbortSignal),
    );
    expect(listAgentHealth).toHaveBeenLastCalledWith(
      1,
      expect.any(AbortSignal),
    );
  });

  it("recovers empty run pages and presents filtered empty history", async () => {
    vi.mocked(listRuns).mockResolvedValue(page([], 0));
    const { router } = show("/observe?pipeline=p1&runPage=9");
    expect(
      await screen.findByText("No runs on this page."),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Run pages" })).getByRole(
        "button",
        { name: "Back to first page" },
      ),
    );
    expect(
      await screen.findByText("No runs yet for this pipeline."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Run status"), {
      target: { value: "failed" },
    });
    expect(
      await screen.findByText("No runs match this status."),
    ).toBeInTheDocument();
    expect(router.search).toContain("runStatus=failed");
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});
