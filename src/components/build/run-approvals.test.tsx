import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { get, post } from "@/api/client";
import type { ApprovalRequest } from "@/api/approval";
import type { DeploymentRelease } from "@/api/deploy";
import { RunApprovals } from "./run-approvals";

// Keep the real approval, pipeline, and deployment adapters. These fake HTTP
// fixtures exercise the actual routes, payloads, DTOs and scope checks together.
vi.mock("@/api/client", () => ({ get: vi.fn(), post: vi.fn() }));
const scope = { projectId: "project/a", pipelineId: "pipe/a", runId: "run/a" };
const hash = (letter: string) => letter.repeat(64);
const baseApproval: ApprovalRequest = {
  approvalId: "approval/a",
  pipelineRunId: scope.runId,
  jobName: "release",
  stepName: "deploy",
  plugin: "builtin:deployment",
  status: 0,
  mode: "any",
  requiredApproverCount: 1,
  approvedCount: 0,
  rejectedCount: 0,
  requestedBy: "requester",
  candidateApprovers: '["operator-1","operator-2"]',
  expiresAt: "2099-01-01T00:00:00Z",
  deploymentReleaseId: "release/a",
  evidenceHash: hash("d"),
  version: 1,
  canApprove: true,
  canReject: true,
};
const baseRelease: DeploymentRelease = {
  origin: "pipeline_job",
  approvalId: baseApproval.approvalId,
  approvalEvidenceHash: baseApproval.evidenceHash,
  approvalTarget: {
    projectId: scope.projectId,
    environmentId: "env/a",
    targetRef: "operator-target",
    namespace: "staging",
    deployment: "web",
    container: "app",
  },
  releaseId: "release/a",
  projectId: scope.projectId,
  pipelineId: scope.pipelineId,
  pipelineRunId: scope.runId,
  requestId: "request",
  environmentId: "env/a",
  artifactId: "image-artifact",
  artifactSha256: hash("a"),
  commitSha: "b".repeat(40),
  deploymentPlanHash: hash("c"),
  image: `registry.example/web@sha256:${hash("e")}`,
  createdBy: "requester",
  status: "queued",
  producerJobRunId: "producer-job",
  producerStepRunId: "producer-step",
  executionJobRunId: "deploy-job",
  executionStepRunId: "deploy-step",
  desiredReplicas: 0,
  updatedReplicas: 0,
  availableReplicas: 0,
};
let approval: ApprovalRequest;
let release: DeploymentRelease;
let run: Record<string, unknown>;
let pipeline: Record<string, unknown>;
let list: ApprovalRequest[] | undefined;
function fixtureRead(url: string) {
  if (url === "/approvals/") return list ?? [approval];
  if (url === "/approvals/approval%2Fa") return { ...approval };
  if (url === "/projects/project%2Fa/releases/release%2Fa") return release;
  if (url === "/pipelines/pipe%2Fa") return pipeline;
  if (url === "/pipelines/pipe%2Fa/runs/run%2Fa") return run;
  throw new Error(`Unexpected fixture request: ${url}`);
}
function show() {
  return render(
    <MemoryRouter>
      <RunApprovals {...scope} />
    </MemoryRouter>,
  );
}
async function openReview() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Review approval approval/a" }),
  );
  await screen.findByText(baseRelease.image);
  await waitFor(() =>
    expect(
      screen.queryByText(
        "Verifying approval evidence and current eligibility…",
      ),
    ).not.toBeInTheDocument(),
  );
  return screen.getByRole("dialog");
}
const consent = () =>
  screen.getByRole("checkbox", { name: /I reviewed this exact release/ });
const approve = () => screen.getByRole("button", { name: "Approve release" });
beforeEach(() => {
  vi.resetAllMocks();
  approval = { ...baseApproval };
  release = { ...baseRelease };
  list = undefined;
  run = {
    runId: scope.runId,
    pipelineId: scope.pipelineId,
    status: "running",
    definitionCommitSha: release.commitSha,
    deploymentPlanHash: release.deploymentPlanHash,
    allowDeployments: true,
  };
  pipeline = { projectId: scope.projectId, pipelineId: scope.pipelineId };
  vi.mocked(get).mockImplementation(async (url) => fixtureRead(url));
  vi.mocked(post).mockImplementation(async (url) => {
    const rejected = url.endsWith("/reject");
    approval = {
      ...approval,
      status: rejected ? 2 : 1,
      approvedCount: rejected ? 0 : 1,
      rejectedCount: rejected ? 1 : 0,
      version: 2,
      canApprove: false,
      canReject: false,
      viewerDecision: rejected ? "rejected" : "approved",
    };
    return approval;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("reads actual scoped waiting records and immutable evidence, with no deployment or vote from refresh", async () => {
  show();
  const dialog = await openReview();
  expect(
    within(dialog).getByText("operator-target / env/a"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("staging / web / app")).toBeInTheDocument();
  expect(
    within(dialog).getByText(`image-artifact / ${hash("a")}`),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText(`${"b".repeat(40)} / ${hash("c")}`),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText("operator-1, operator-2"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: /actor|approver/i }),
  ).not.toBeInTheDocument();
  expect(consent()).not.toBeChecked();
  expect(approve()).toBeDisabled();
  fireEvent.click(consent());
  expect(approve()).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh approval evidence" }),
  );
  await waitFor(() => expect(consent()).not.toBeChecked());
  expect(post).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledWith(
    "/approvals/",
    expect.objectContaining({ params: { pipeline_run_id: scope.runId } }),
  );
});

it("records one reason-only vote despite duplicate clicks and accurately displays a partial quorum", async () => {
  approval = { ...approval, requiredApproverCount: 2 };
  let finish!: () => void;
  vi.mocked(post).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => {
          approval = {
            ...approval,
            approvedCount: 1,
            version: 2,
            viewerDecision: "approved",
            canApprove: false,
            canReject: false,
          };
          resolve(approval);
        };
      }),
  );
  show();
  await openReview();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Decision reason (optional)" }),
    { target: { value: "Digest and target reviewed" } },
  );
  fireEvent.click(consent());
  fireEvent.click(approve());
  fireEvent.click(screen.getByRole("button", { name: /Recording decision/ }));
  await waitFor(() => expect(post).toHaveBeenCalledOnce());
  expect(post).toHaveBeenCalledWith(
    "/approvals/approval%2Fa/approve",
    { reason: "Digest and target reviewed" },
    { silence: true },
  );
  await act(async () => finish());
  expect(
    await screen.findByText(/required approval quorum has not been reached/),
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Your recorded decision: approved"),
  ).toBeInTheDocument();
  expect(approve()).toBeDisabled();
  expect(post).toHaveBeenCalledOnce();
});

it("rejects the exact release and reports the persisted terminal status", async () => {
  show();
  await openReview();
  fireEvent.click(consent());
  fireEvent.click(screen.getByRole("button", { name: "Reject release" }));
  expect(
    await screen.findByText("Decision recorded. Approval status: Rejected."),
  ).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith(
    "/approvals/approval%2Fa/reject",
    { reason: "" },
    { silence: true },
  );
  expect(approve()).toBeDisabled();
});

it.each([
  "vote revision",
  "revoked eligibility",
  "cancelled release",
  "changed target",
])(
  "invalidates consent during preflight for %s without sending a decision",
  async (change) => {
    show();
    await openReview();
    fireEvent.click(consent());
    if (change === "vote revision")
      approval = { ...approval, version: 2, approvedCount: 1 };
    if (change === "revoked eligibility")
      approval = {
        ...approval,
        canApprove: false,
        canReject: false,
        decisionBlockReason: "Deployment permission revoked",
      };
    if (change === "cancelled release")
      release = { ...release, status: "cancelled" };
    if (change === "changed target")
      release = {
        ...release,
        approvalTarget: { ...release.approvalTarget!, namespace: "other" },
      };
    fireEvent.click(approve());
    expect(await screen.findByRole("alert")).toHaveTextContent("changed");
    await waitFor(() => expect(approve()).toBeDisabled());
    expect(post).not.toHaveBeenCalled();
  },
);

it("treats an uncertain decision response as read-only verification, never an automatic retry", async () => {
  vi.mocked(post).mockImplementation(async () => {
    approval = {
      ...approval,
      status: 1,
      canApprove: false,
      canReject: false,
      viewerDecision: "approved",
      version: 2,
    };
    throw new Error("Connection ended before response");
  });
  show();
  await openReview();
  fireEvent.click(consent());
  fireEvent.click(approve());
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "no automatic decision retry",
  );
  expect(
    await screen.findByText("Your recorded decision: approved"),
  ).toBeInTheDocument();
  expect(post).toHaveBeenCalledOnce();
  expect(approve()).toBeDisabled();
});

it.each([1, 2, 3, 4] as const)(
  "keeps historical status %s read-only after cancellation and never resumes or recovers a queued release",
  async (status) => {
    approval = { ...approval, status, canApprove: false, canReject: false };
    run = { ...run, status: "cancelled" };
    show();
    const dialog = await openReview();
    expect(
      within(dialog).getByText("Original pipeline status: cancelled"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/approval never restarts the pipeline/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "Inspect this release in Deployments",
      }),
    ).toHaveAttribute(
      "href",
      "/projects/project%2Fa/deployments?release=release%2Fa",
    );
    expect(approve()).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /recover|resume|apply/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh approval evidence" }),
    );
    expect(post).not.toHaveBeenCalled();
  },
);

it("fails closed for expired approvals and absent eligibility fields", async () => {
  approval = {
    ...approval,
    expiresAt: "2000-01-01T00:00:00Z",
    canApprove: undefined,
    canReject: undefined,
  };
  show();
  await openReview();
  expect(screen.getByText(/expiry reached/)).toBeInTheDocument();
  expect(approve()).toBeDisabled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it.each([
  "release run",
  "evidence hash",
  "target scope",
  "definition revision",
  "missing snapshot",
])(
  "hides mismatched %s evidence and all decision controls",
  async (mismatch) => {
    if (mismatch === "release run")
      release = { ...release, pipelineRunId: "other" };
    if (mismatch === "evidence hash")
      release = { ...release, approvalEvidenceHash: hash("f") };
    if (mismatch === "target scope")
      release = {
        ...release,
        approvalTarget: { ...release.approvalTarget!, projectId: "other" },
      };
    if (mismatch === "definition revision")
      run = { ...run, definitionCommitSha: "f".repeat(40) };
    if (mismatch === "missing snapshot")
      release = { ...release, approvalTarget: undefined };
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Review approval approval/a" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval evidence is incomplete",
    );
    expect(screen.queryByText(baseRelease.image)).not.toBeInTheDocument();
    expect(approve()).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  },
);

it("rejects a cross-project listing and makes unsupported gates visibly non-actionable", async () => {
  pipeline = { ...pipeline, projectId: "other" };
  const view = show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "scope does not match",
  );
  expect(
    screen.queryByRole("button", { name: /Review approval/ }),
  ).not.toBeInTheDocument();
  view.unmount();
  pipeline = { ...pipeline, projectId: scope.projectId };
  approval = {
    ...approval,
    plugin: "external:legacy",
    deploymentReleaseId: undefined,
  };
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unsupported gate: external:legacy",
  );
  expect(
    screen.queryByRole("button", { name: /Review approval/ }),
  ).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

it("dismissal clears consent and late preflight responses cannot submit after scope navigation", async () => {
  const view = show();
  await openReview();
  fireEvent.click(consent());
  fireEvent.click(screen.getByRole("button", { name: "Close review" }));
  await openReview();
  expect(consent()).not.toBeChecked();
  fireEvent.click(consent());
  let finish!: () => void;
  vi.mocked(get).mockImplementation((url) =>
    url === "/approvals/approval%2Fa"
      ? new Promise((resolve) => {
          finish = () => resolve(approval);
        })
      : Promise.resolve(fixtureRead(url)),
  );
  fireEvent.click(approve());
  await waitFor(() => expect(finish).toBeDefined());
  view.rerender(
    <MemoryRouter>
      <RunApprovals {...scope} runId="new-run" />
    </MemoryRouter>,
  );
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText(baseRelease.image)).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

it("hides retained evidence on a denied refresh and keeps the action disabled", async () => {
  show();
  await openReview();
  fireEvent.click(consent());
  vi.mocked(get).mockRejectedValue(new Error("Access denied"));
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh approval evidence" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  expect(screen.queryByText(baseRelease.image)).not.toBeInTheDocument();
  expect(approve()).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});

it("labels an expired historical approval without implying it is still usable", async () => {
  approval = {
    ...approval,
    status: 1,
    canApprove: false,
    canReject: false,
    expiresAt: "2000-01-01T00:00:00Z",
  };
  show();
  await openReview();
  expect(
    screen.getByText(/Approved is a historical decision/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /expiry reached; historical decisions cannot authorize a new apply/,
    ),
  ).toBeInTheDocument();
  expect(approve()).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});

it("expiry disables previously reviewed consent before the next polling response", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2098-01-01T00:00:00Z"));
  approval = { ...approval, expiresAt: "2098-01-01T00:00:02Z" };
  show();
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Review approval approval/a" }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(consent());
  expect(approve()).toBeEnabled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(approve()).toBeDisabled();
  expect(screen.getByText(/expiry reached/)).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
