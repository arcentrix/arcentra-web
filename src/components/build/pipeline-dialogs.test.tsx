import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunPipelineDialog } from "./pipeline-dialogs";
import { getPipelineSpec, triggerPipeline } from "@/api/pipeline";
import type { Pipeline, PipelineSpec } from "@/api/pipeline/types";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/pipeline", () => ({
  triggerPipeline: vi.fn(),
  getPipelineSpec: vi.fn(),
}));
const pipeline: Pipeline = {
  pipelineId: "p1",
  projectId: "pr1",
  name: "Build API",
  description: "",
  repoUrl: "https://example.com/repo",
  defaultBranch: "main",
  pipelineFilePath: ".arcentra/pipeline.yaml",
  status: "unknown",
  isEnabled: 1,
  totalRuns: 0,
  successRuns: 0,
  failedRuns: 0,
};
const definition: PipelineSpec = {
  spec: { jobs: [{ name: "build" }] },
  format: "json",
  headCommitSha: "a".repeat(40),
  branch: "main",
  pipelineFilePath: ".arcentra/pipeline.yaml",
  deploymentPlan: null,
  deploymentPlanHash: "",
};
const deployment: PipelineSpec = {
  ...definition,
  deploymentPlanHash: "c".repeat(64),
  deploymentPlan: {
    jobName: "release",
    stepName: "deploy",
    environmentId: "env-staging",
    timeoutSeconds: 120,
    artifact: { job: "build", step: "publish", name: "image.json" },
    target: {
      environmentId: "env-staging",
      projectId: "pr1",
      name: "Staging",
      targetRef: "operator-staging",
      namespace: "stage",
      deployment: "web",
      container: "app",
      configured: true,
      allowPipelineDeployments: true,
    },
  },
};
function show(props: Partial<Parameters<typeof RunPipelineDialog>[0]> = {}) {
  return render(
    <RunPipelineDialog
      pipeline={pipeline}
      onClose={vi.fn()}
      onStarted={vi.fn()}
      {...props}
    />,
  );
}
async function ready() {
  await screen.findByText(/Definition revision: aaaaa/);
  await waitFor(() =>
    expect(
      screen.queryByText("Loading current definition and deployment review…"),
    ).not.toBeInTheDocument(),
  );
}
const start = () => screen.getByRole("button", { name: "Start run" });
const consent = () =>
  screen.getByRole("checkbox", { name: /Allow Kubernetes deployment/ });
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPipelineSpec).mockResolvedValue(definition);
  vi.mocked(triggerPipeline).mockResolvedValue({ runID: "run-1" });
});
describe("RunPipelineDialog", () => {
  it("fetches a fresh definition and keeps deployment opt-in false for an ordinary run", async () => {
    show();
    expect(start()).toBeDisabled();
    await ready();
    expect(getPipelineSpec).toHaveBeenCalledWith("p1", expect.any(AbortSignal));
    expect(screen.getByText(/Source commit: not verified/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Reviewed pipeline definition"),
    ).toHaveTextContent('"build"');
    fireEvent.click(start());
    await waitFor(() =>
      expect(triggerPipeline).toHaveBeenCalledWith("p1", {
        variables: {},
        requestId: expect.any(String),
        allowDeployments: false,
        expectedDefinitionCommitSha: definition.headCommitSha,
      }),
    );
  });
  it("requires string variables before executing", async () => {
    show();
    await ready();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: '{"bad": 123}' },
    });
    fireEvent.click(start());
    expect(await screen.findByRole("alert")).toHaveTextContent("string values");
    expect(triggerPipeline).not.toHaveBeenCalled();
  });
  it("requires default-off explicit consent for the exact reviewed target and producer", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(deployment);
    show();
    await ready();
    expect(consent()).not.toBeChecked();
    expect(start()).toBeDisabled();
    expect(screen.getByText("stage / web / app")).toBeInTheDocument();
    expect(
      screen.getByText("build / publish / image.json"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/image digest is not known yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/same release ID, rather than create a duplicate/),
    ).toBeInTheDocument();
    fireEvent.submit(start().closest("form")!);
    expect(triggerPipeline).not.toHaveBeenCalled();
    fireEvent.click(consent());
    fireEvent.click(start());
    await waitFor(() =>
      expect(triggerPipeline).toHaveBeenCalledWith("p1", {
        variables: {},
        requestId: expect.any(String),
        allowDeployments: true,
        expectedDefinitionCommitSha: deployment.headCommitSha,
        expectedDeploymentPlanHash: deployment.deploymentPlanHash,
      }),
    );
  });
  it("clears consent immediately on variable changes and refresh, including a changed target at the same revision", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(deployment);
    show();
    await ready();
    fireEvent.click(consent());
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: '{"ENV":"test"}' },
    });
    expect(consent()).not.toBeChecked();
    expect(start()).toBeDisabled();
    fireEvent.click(consent());
    vi.mocked(getPipelineSpec).mockResolvedValue({
      ...deployment,
      deploymentPlanHash: "d".repeat(64),
      deploymentPlan: {
        ...deployment.deploymentPlan!,
        target: {
          ...deployment.deploymentPlan!.target,
          namespace: "stage-new",
        },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh definition and review" }),
    );
    expect(consent()).not.toBeChecked();
    expect(start()).toBeDisabled();
    await screen.findByText("stage-new / web / app");
    expect(consent()).not.toBeChecked();
    fireEvent.click(consent());
    fireEvent.click(start());
    await waitFor(() =>
      expect(triggerPipeline).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          expectedDeploymentPlanHash: "d".repeat(64),
        }),
      ),
    );
  });
  it("loads a stale definition rejection again and requires new consent", async () => {
    vi.mocked(getPipelineSpec)
      .mockResolvedValueOnce(deployment)
      .mockResolvedValue({ ...deployment, headCommitSha: "b".repeat(40) });
    vi.mocked(triggerPipeline).mockRejectedValueOnce(
      new ApiError({ code: 409, message: "definition changed; review again" }),
    );
    show();
    await ready();
    fireEvent.click(consent());
    fireEvent.click(start());
    await screen.findByText(/Definition revision: bbbbb/);
    expect(consent()).not.toBeChecked();
    expect(start()).toBeDisabled();
    expect(triggerPipeline).toHaveBeenCalledTimes(1);
  });
  it("retries an uncertain deployment start with the exact same payload and idempotency key", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(deployment);
    vi.mocked(triggerPipeline)
      .mockRejectedValueOnce(new Error("Network interrupted"))
      .mockResolvedValueOnce({ runID: "run-1" });
    const onStarted = vi.fn();
    show({ onStarted });
    await ready();
    fireEvent.click(consent());
    fireEvent.click(start());
    await screen.findByText("Network interrupted");
    fireEvent.click(start());
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith("run-1"));
    expect(vi.mocked(triggerPipeline).mock.calls[0]).toEqual(
      vi.mocked(triggerPipeline).mock.calls[1],
    );
  });
  it("prevents repeated starts and cancellation while starting, including a successful form still mounted", async () => {
    let finish!: (value: { runID: string }) => void;
    vi.mocked(triggerPipeline).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn(),
      onStarted = vi.fn();
    show({ onClose, onStarted });
    await ready();
    const button = start();
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    expect(triggerPipeline).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish({ runID: "run-2" }));
    expect(onStarted).toHaveBeenCalledWith("run-2");
    fireEvent.submit(
      screen.getByRole("button", { name: "Run started" }).closest("form")!,
    );
    expect(triggerPipeline).toHaveBeenCalledTimes(1);
  });
  it("dismisses without triggering and resets consent when reopened", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(deployment);
    const onClose = vi.fn();
    const view = show({ onClose });
    await ready();
    fireEvent.click(consent());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(triggerPipeline).not.toHaveBeenCalled();
    view.unmount();
    show();
    await ready();
    expect(consent()).not.toBeChecked();
  });
  it.each([
    ["missing backend review", { ...definition, deploymentPlan: undefined }],
    ["missing revision", { ...definition, headCommitSha: "" }],
    [
      "missing target",
      {
        ...deployment,
        deploymentPlan: { ...deployment.deploymentPlan!, target: undefined },
      },
    ],
    [
      "wrong project",
      {
        ...deployment,
        deploymentPlan: {
          ...deployment.deploymentPlan!,
          target: { ...deployment.deploymentPlan!.target, projectId: "other" },
        },
      },
    ],
    [
      "unconfigured target",
      {
        ...deployment,
        deploymentPlan: {
          ...deployment.deploymentPlan!,
          target: { ...deployment.deploymentPlan!.target, configured: false },
        },
      },
    ],
    [
      "pipeline target permission disabled",
      {
        ...deployment,
        deploymentPlan: {
          ...deployment.deploymentPlan!,
          target: {
            ...deployment.deploymentPlan!.target,
            allowPipelineDeployments: false,
          },
        },
      },
    ],
  ])("fails closed for %s", async (_label, data) => {
    vi.mocked(getPipelineSpec).mockResolvedValue(data as PipelineSpec);
    show();
    await screen.findByRole("alert");
    expect(start()).toBeDisabled();
    expect(triggerPipeline).not.toHaveBeenCalled();
  });
  it("does not use retained review data after a refresh error", async () => {
    vi.mocked(getPipelineSpec)
      .mockResolvedValueOnce(deployment)
      .mockRejectedValueOnce(new Error("Review unavailable"));
    show();
    await ready();
    fireEvent.click(consent());
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh definition and review" }),
    );
    await screen.findByText(/Could not review the current definition/);
    expect(start()).toBeDisabled();
    expect(consent()).not.toBeChecked();
  });
  it("ignores a late definition after pipeline navigation and resets consent", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(deployment);
    const view = show();
    await ready();
    fireEvent.click(consent());
    let finish!: (value: PipelineSpec) => void;
    vi.mocked(getPipelineSpec).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh definition and review" }),
    );
    view.rerender(
      <RunPipelineDialog
        pipeline={{ ...pipeline, pipelineId: "p2" }}
        onClose={vi.fn()}
        onStarted={vi.fn()}
      />,
    );
    await ready();
    expect(consent()).not.toBeChecked();
    await act(async () =>
      finish({ ...deployment, headCommitSha: "old-late-revision" }),
    );
    expect(screen.queryByText(/old-late-revision/)).not.toBeInTheDocument();
  });
  it("does not navigate back after leaving a pending run form", async () => {
    let finish!: (value: { runID: string }) => void;
    vi.mocked(triggerPipeline).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onStarted = vi.fn();
    const view = show({ onStarted });
    await ready();
    fireEvent.click(start());
    view.unmount();
    await act(async () => finish({ runID: "late-run" }));
    expect(onStarted).not.toHaveBeenCalled();
  });
});

it("discloses the operator-defined durable approval policy without prechecking deployment opt-in", async () => {
  vi.mocked(getPipelineSpec).mockResolvedValue({
    ...deployment,
    deploymentPlan: {
      ...deployment.deploymentPlan!,
      approvalRequired: true,
      target: {
        ...deployment.deploymentPlan!.target,
        pipelineApproval: {
          approvers: ["operator-1", "operator-2"],
          minApprovals: 2,
          timeoutSeconds: 90,
        },
      },
    },
  });
  show();
  await ready();
  expect(
    screen.getByText("Final deployment requires durable manual approval"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Operator-defined approvers: operator-1, operator-2"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Run opt-in does not grant approval/),
  ).toBeInTheDocument();
  expect(consent()).not.toBeChecked();
  expect(start()).toBeDisabled();
  fireEvent.click(consent());
  fireEvent.click(start());
  await waitFor(() => expect(triggerPipeline).toHaveBeenCalledOnce());
  const input = vi.mocked(triggerPipeline).mock.calls[0][1];
  expect(input).toMatchObject({
    allowDeployments: true,
    expectedDeploymentPlanHash: deployment.deploymentPlanHash,
  });
  expect(input).not.toHaveProperty("approvers");
  expect(input).not.toHaveProperty("approval");
});

it.each(["missing policy", "omitted requirement", "invalid quorum"])(
  "fails closed when the approval review has %s",
  async (problem) => {
    const plan = {
      ...deployment.deploymentPlan!,
      approvalRequired: true,
      target: {
        ...deployment.deploymentPlan!.target,
        pipelineApproval: {
          approvers: ["operator"],
          minApprovals: 1,
          timeoutSeconds: 90,
        },
      },
    };
    if (problem === "missing policy") plan.target.pipelineApproval = undefined!;
    if (problem === "omitted requirement") plan.approvalRequired = false;
    if (problem === "invalid quorum")
      plan.target.pipelineApproval.minApprovals = 2;
    vi.mocked(getPipelineSpec).mockResolvedValue({
      ...deployment,
      deploymentPlan: plan,
    });
    show();
    await ready();
    expect(screen.getByRole("alert")).toHaveTextContent(/approval/);
    expect(start()).toBeDisabled();
    expect(triggerPipeline).not.toHaveBeenCalled();
  },
);

it("keeps an unsupported gate diagnosis visible and blocks trigger instead of silently skipping approval", async () => {
  vi.mocked(getPipelineSpec).mockResolvedValue({
    ...deployment,
    deploymentReviewError:
      "Unsupported gate: stage approvals are not supported for this deployment.",
  });
  show();
  await ready();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unsupported gate: stage approvals",
  );
  expect(
    screen.queryByRole("checkbox", { name: /Allow Kubernetes deployment/ }),
  ).not.toBeInTheDocument();
  expect(start()).toBeDisabled();
  expect(triggerPipeline).not.toHaveBeenCalled();
});
