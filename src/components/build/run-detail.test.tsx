import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RunDetail } from "./run-detail";
import {
  getRun,
  getRunJobs,
  getRunLogs,
  normalizeJob,
  stopRun,
} from "@/api/pipeline";
import type { PipelineRun } from "@/api/pipeline/types";
vi.mock("./run-approvals", () => ({
  RunApprovals: () => <div>Run approval panel</div>,
}));
vi.mock("@/hooks/use-scoped-permission", () => ({
  useScopedPermission: () => ({ has: () => true }),
}));
vi.mock("@/api/pipeline", async (original) => ({
  ...(await original<typeof import("@/api/pipeline")>()),
  getRun: vi.fn(),
  getRunJobs: vi.fn(),
  getRunLogs: vi.fn(),
  stopRun: vi.fn(),
}));
const run: PipelineRun = {
  runId: "r1",
  pipelineId: "p1",
  pipelineName: "CI",
  branch: "main",
  commitSha: "legacy-source-unverified",
  definitionCommitSha: "definition-only-sha",
  status: "running",
  triggeredBy: "tester",
  totalJobs: 1,
  completedJobs: 0,
  failedJobs: 0,
  runningJobs: 1,
  startTime: 100,
  endTime: 0,
  duration: 1234,
};
function show() {
  return render(
    <MemoryRouter>
      <RunDetail
        pipelineId="p1"
        runId="r1"
        projectId="pr1"
        onChanged={vi.fn()}
      />
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRun).mockResolvedValue(run);
  vi.mocked(getRunJobs).mockResolvedValue([
    normalizeJob({
      jobRunId: "j1",
      jobName: "Compile",
      status: "running",
      agentId: "agent-1",
      duration: 1000,
      errorMessage: "",
      steps: [
        {
          stepRunId: "s1",
          name: "Build binary",
          status: "success",
          agentId: "agent-1",
          errorMessage: "",
          duration: 800,
          exitCode: 0,
        },
      ],
    }),
  ]);
  vi.mocked(getRunLogs).mockResolvedValue({
    entries: [
      {
        timestamp: "",
        level: "info",
        message: "Actual fixture output",
        lineNumber: 999,
      },
    ],
    truncated: true,
  });
});
describe("RunDetail", () => {
  it("renders API execution, assigned agent, steps and logs", async () => {
    show();
    expect(await screen.findByText("Build binary")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "agent-1" })).toHaveAttribute(
      "href",
      "/agents/agent-1",
    );
    expect(await screen.findByLabelText("Execution logs")).toHaveTextContent(
      "Actual fixture output",
    );
    expect(screen.getByText("Exit code 0")).toBeInTheDocument();
    expect(screen.getByText("definition-only-sha")).toBeInTheDocument();
    expect(screen.getByText("Recorded trigger revision")).toBeInTheDocument();
    expect(screen.getByText("legacy-source-unverified")).toBeInTheDocument();
    expect(screen.getByText(/Ambiguous legacy value/)).toBeInTheDocument();
    const checkout = within(
      screen.getByRole("region", { name: "Compile initial checkout" }),
    );
    expect(checkout.getAllByText("Unknown")).toHaveLength(4);
    expect(checkout.getByText(/Older runs remain unknown/)).toBeInTheDocument();
    expect(checkout.queryByText("definition-only-sha")).not.toBeInTheDocument();
    expect(
      checkout.queryByText("legacy-source-unverified"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Select a step to browse/)).toBeInTheDocument();
  });
  it("requires confirmation to cancel and refreshes the terminal state", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel run" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep running" }));
    expect(stopRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));
    vi.mocked(stopRun).mockImplementation(async () => {
      vi.mocked(getRun).mockResolvedValue({ ...run, status: "cancelled" });
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    );
    await waitFor(() => expect(stopRun).toHaveBeenCalledWith("p1", "r1"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Cancel run" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
  it("surfaces log errors without inventing output", async () => {
    vi.mocked(getRunLogs).mockRejectedValue(new Error("Log store offline"));
    show();
    expect(await screen.findByText("Logs unavailable")).toBeInTheDocument();
    expect(screen.getByText("Log store offline")).toBeInTheDocument();
    expect(screen.queryByText("Actual fixture output")).not.toBeInTheDocument();
  });
  it("pages logs only within the selected step", async () => {
    show();
    await screen.findByText("Build binary");
    fireEvent.change(screen.getByLabelText("Output"), {
      target: { value: "s1" },
    });
    await waitFor(() =>
      expect(getRunLogs).toHaveBeenLastCalledWith(
        "p1",
        "r1",
        expect.any(AbortSignal),
        { stepRunId: "s1", fromLine: 0 },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next output" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next output" }));
    await waitFor(() =>
      expect(getRunLogs).toHaveBeenLastCalledWith(
        "p1",
        "r1",
        expect.any(AbortSignal),
        { stepRunId: "s1", fromLine: 1000 },
      ),
    );
  });
});

it("collects delayed logs for 15 seconds after completion, then supports manual refresh", async () => {
  vi.useFakeTimers();
  vi.mocked(getRun).mockResolvedValue({ ...run, status: "success" });
  const view = show();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText("Collecting final output…")).toBeInTheDocument();
  vi.mocked(getRunLogs).mockResolvedValue({
    entries: [
      {
        timestamp: 0,
        level: "info",
        message: "Final output arrived after completion",
      },
    ],
    truncated: false,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(screen.getByLabelText("Execution logs")).toHaveTextContent(
    "Final output arrived after completion",
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
  expect(
    screen.queryByText("Collecting final output…"),
  ).not.toBeInTheDocument();
  const calls = vi.mocked(getRunLogs).mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(getRunLogs).toHaveBeenCalledTimes(calls);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Refresh execution" }));
  });
  expect(getRunLogs).toHaveBeenCalledTimes(calls + 1);
  view.unmount();
});

it.each([
  ["builtin:kubernetes", "deploy", "Controller-managed deployment"],
  ["builtin:kubernetes", "other", "Agent: Not assigned"],
  ["custom:kubernetes", "deploy", "Agent: Not assigned"],
])(
  "labels an unassigned %s / %s step without inventing an agent or release",
  async (uses, action, label) => {
    vi.mocked(getRunJobs).mockResolvedValue([
      normalizeJob({
        jobRunId: "pending-job",
        jobName: "Pending job",
        status: "pending",
        agentId: "",
        errorMessage: "",
        duration: 0,
        steps: [
          {
            stepRunId: "pending-step",
            name: "Pending deployment",
            status: "pending",
            agentId: "",
            errorMessage: "",
            duration: 0,
            exitCode: null,
            uses,
            action,
          },
        ],
      }),
    ]);
    show();
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/Kubernetes release:/)).not.toBeInTheDocument();
  },
);

it("shows each job's full Agent-reported initial SHA without conflating definitions, trigger revisions or repositories", async () => {
  vi.mocked(getRunJobs).mockResolvedValue([
    normalizeJob({
      jobRunId: "frontend",
      jobName: "Frontend",
      status: 4,
      agentId: "agent-1",
      sourceExpectationCaptured: true,
      sourceType: "git",
      sourceRepository: "https://git.example/Team/Web.git",
      sourceRef: "main",
      sourceResolvedCommit: "a".repeat(40),
      sourceProvenanceState: "reported",
    }),
    normalizeJob({
      jobRunId: "backend",
      jobName: "Backend",
      status: 5,
      agentId: "agent-2",
      sourceExpectationCaptured: true,
      sourceType: "git",
      sourceRepository: "git@git.example:Team/API.git",
      sourceRef: "release/v2",
      sourceResolvedCommit: "b".repeat(64),
      sourceProvenanceState: "reported",
    }),
  ]);
  show();
  const frontend = within(
    await screen.findByRole("region", { name: "Frontend initial checkout" }),
  );
  const backend = within(
    screen.getByRole("region", { name: "Backend initial checkout" }),
  );
  expect(frontend.getByText("a".repeat(40))).toBeInTheDocument();
  expect(
    frontend.getByText("https://git.example/Team/Web.git"),
  ).toBeInTheDocument();
  expect(frontend.getByText("main")).toBeInTheDocument();
  expect(frontend.queryByText("b".repeat(64))).not.toBeInTheDocument();
  expect(backend.getByText("b".repeat(64))).toBeInTheDocument();
  expect(backend.getByText("git@git.example:Team/API.git")).toBeInTheDocument();
  expect(backend.getByText("release/v2")).toBeInTheDocument();
  expect(frontend.queryByRole("link")).not.toBeInTheDocument();
  expect(backend.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getAllByText("Agent-reported initial checkout")).toHaveLength(
    2,
  );
  expect(
    screen.getByText(
      /not a build attestation or proof of the current workspace/,
    ),
  ).toHaveTextContent("artifacts, or image contents");
});

it.each([
  ["old Agent", "success", "", "No Agent checkout report is recorded"],
  [
    "clone failure",
    "failed",
    "unknown",
    "No Agent checkout report is recorded",
  ],
  [
    "pending checkout",
    "pending",
    "unknown",
    "No Agent checkout report is recorded",
  ],
])(
  "keeps %s evidence explicitly unknown despite a run-level revision",
  async (_name, status, state, message) => {
    vi.mocked(getRunJobs).mockResolvedValue([
      normalizeJob({
        jobRunId: "j1",
        jobName: "Source job",
        status,
        sourceExpectationCaptured: true,
        sourceType: "git",
        sourceRepository: "https://git.example/Team/Repo.git",
        sourceRef: "main",
        sourceProvenanceState: state,
      }),
    ]);
    show();
    const checkout = within(
      await screen.findByRole("region", {
        name: "Source job initial checkout",
      }),
    );
    expect(checkout.getAllByText("Unknown")).toHaveLength(2);
    expect(checkout.getByText(new RegExp(message))).toBeInTheDocument();
    expect(
      checkout.queryByText("Agent-reported initial checkout"),
    ).not.toBeInTheDocument();
    expect(
      checkout.queryByText("legacy-source-unverified"),
    ).not.toBeInTheDocument();
  },
);

it("keeps jobs without source explicitly unknown and displays untrusted repository/ref text without links", async () => {
  vi.mocked(getRunJobs).mockResolvedValue([
    normalizeJob({
      jobRunId: "no-source",
      jobName: "No source",
      sourceExpectationCaptured: true,
    }),
    normalizeJob({
      jobRunId: "untrusted",
      jobName: "Untrusted",
      sourceExpectationCaptured: true,
      sourceType: "git",
      sourceRepository: "<script>untrusted</script>",
      sourceRef: "<img src=x onerror=alert(1)>",
    }),
  ]);
  const { container } = show();
  const noSource = within(
    await screen.findByRole("region", { name: "No source initial checkout" }),
  );
  expect(
    noSource.getByText("No source checkout was configured for this job."),
  ).toBeInTheDocument();
  expect(noSource.getByText("Not configured")).toBeInTheDocument();
  expect(noSource.getAllByText("Unknown")).toHaveLength(3);
  const untrusted = within(
    screen.getByRole("region", { name: "Untrusted initial checkout" }),
  );
  expect(untrusted.getByText("<script>untrusted</script>")).toBeInTheDocument();
  expect(
    untrusted.getByText("<img src=x onerror=alert(1)>"),
  ).toBeInTheDocument();
  expect(untrusted.queryByRole("link")).not.toBeInTheDocument();
  expect(container.querySelector("script, img")).toBeNull();
});
