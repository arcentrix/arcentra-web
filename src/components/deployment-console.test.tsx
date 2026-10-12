import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as deploy from "@/api/deploy";
import { getRun } from "@/api/pipeline";
import type { PipelineRun } from "@/api/pipeline/types";
import type { DeploymentEnvironment, DeploymentRelease } from "@/api/deploy";
import Deployments from "@/pages/Project/Deployments";
import Environments from "@/pages/Project/Environments";
import Deploy from "@/pages/Deploy";

vi.mock("@/api/deploy", () => ({
  listEnvironments: vi.fn(),
  listReleases: vi.fn(),
  getRelease: vi.fn(),
  inspectRelease: vi.fn(),
  recoverRelease: vi.fn(),
  createEnvironment: vi.fn(),
  createRelease: vi.fn(),
  advanceRelease: vi.fn(),
  cancelRelease: vi.fn(),
}));
vi.mock("@/api/pipeline", () => ({ getRun: vi.fn() }));
vi.mock("@/api/project", () => ({
  listProjects: vi.fn().mockResolvedValue({
    list: [{ projectId: "one", name: "Project one" }],
    total: 1,
  }),
}));
const environment: DeploymentEnvironment = {
  environmentId: "env-one",
  projectId: "one",
  name: "Staging",
  targetRef: "staging-web",
  namespace: "staging",
  deployment: "web",
  container: "app",
  configured: true,
};
const release: DeploymentRelease = {
  releaseId: "release-one",
  projectId: "one",
  requestId: "request",
  environmentId: "env-one",
  pipelineId: "pipe-one",
  pipelineRunId: "run-one",
  artifactId: "artifact-one",
  artifactSha256: "a".repeat(64),
  commitSha: "b".repeat(40),
  image: `registry.example/app@sha256:${"c".repeat(64)}`,
  createdBy: "user",
  status: "queued",
  desiredReplicas: 0,
  updatedReplicas: 0,
  availableReplicas: 0,
};
const page = <T,>(list: T[]) => ({
  list,
  page: 1,
  pageSize: 20,
  total: list.length,
});
function renderPage(path = "/projects/one/deployments") {
  let navigate!: ReturnType<typeof useNavigate>;
  function Wrapper() {
    navigate = useNavigate();
    return (
      <Routes>
        <Route
          path="/projects/:projectId/deployments"
          element={<Deployments />}
        />
        <Route
          path="/projects/:projectId/environments"
          element={<Environments />}
        />
        <Route path="/deploy" element={<Deploy />} />
      </Routes>
    );
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <Wrapper />
    </MemoryRouter>,
  );
  return {
    navigate: (path: string | number) =>
      typeof path === "number" ? navigate(path) : navigate(path),
  };
}
beforeEach(() => {
  vi.mocked(deploy.listEnvironments).mockResolvedValue(page([environment]));
  vi.mocked(deploy.listReleases).mockResolvedValue(page([release]));
  vi.mocked(deploy.getRelease).mockResolvedValue(release);
  vi.mocked(deploy.inspectRelease).mockResolvedValue({
    releaseId: release.releaseId,
    persistedStatus: "applying",
    status: "observing",
    reason: "Release marker already applied",
    observedGeneration: 3,
    desiredReplicas: 2,
    updatedReplicas: 2,
    availableReplicas: 1,
  });
  vi.mocked(deploy.recoverRelease).mockResolvedValue({
    ...release,
    status: "observing",
  });
  vi.mocked(getRun).mockResolvedValue({
    pipelineId: "pipe-one",
    runId: "run-one",
    status: "cancelled",
  } as PipelineRun);
  vi.mocked(deploy.createRelease).mockResolvedValue(release);
  vi.mocked(deploy.cancelRelease).mockResolvedValue({
    ...release,
    status: "cancelled",
  });
  vi.mocked(deploy.advanceRelease).mockResolvedValue({
    ...release,
    status: "observing",
  });
  vi.mocked(deploy.createEnvironment).mockResolvedValue(environment);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Kubernetes deployment console", () => {
  it("shows empty records without inventing a release", async () => {
    vi.mocked(deploy.listEnvironments).mockResolvedValue(page([]));
    vi.mocked(deploy.listReleases).mockResolvedValue(page([]));
    renderPage();
    expect(
      await screen.findByText("No releases in this project."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Prepare release" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Review execution" }),
    ).not.toBeInTheDocument();
    expect(deploy.advanceRelease).not.toHaveBeenCalled();
  });

  it("loads scoped records and never infers rollout health from a queued record", async () => {
    renderPage();
    expect(await screen.findByText(release.image)).toBeInTheDocument();
    expect(screen.getByText("No rollout observation yet")).toBeInTheDocument();
    expect(
      screen.queryByText(/available replicas|Healthy/),
    ).not.toBeInTheDocument();
    expect(deploy.listReleases).toHaveBeenCalledWith(
      "one",
      1,
      expect.any(AbortSignal),
    );
    expect(deploy.advanceRelease).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "View project pipelines" }),
    ).toHaveAttribute("href", "/projects/one/pipelines");
  });
  it("keeps unconfigured targets visible and disables execution", async () => {
    vi.mocked(deploy.listEnvironments).mockResolvedValue(
      page([{ ...environment, configured: false }]),
    );
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Review execution" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Execution requires a configured target/),
    ).toBeInTheDocument();
    expect(deploy.advanceRelease).not.toHaveBeenCalled();
  });
  it("displays real fetch failures and reloads without fabricated records", async () => {
    vi.mocked(deploy.listReleases).mockRejectedValueOnce(
      new Error("Permission denied"),
    );
    renderPage();
    expect(
      await screen.findByText(
        /Releases could not be loaded: Permission denied/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(release.image)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
    expect(await screen.findByText(release.image)).toBeInTheDocument();
  });
  it("requires review, supports Back, and sends one explicit execution under repeated clicks", async () => {
    let finish!: (value: DeploymentRelease) => void;
    vi.mocked(deploy.advanceRelease).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Review execution" }),
    );
    let dialog = screen.getByRole("dialog", {
      name: "Execute Kubernetes release",
    });
    expect(
      within(dialog).getByText(/staging-web · staging\/web · app/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(release.image)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deploy.advanceRelease).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review execution" }));
    dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", {
      name: "Apply selected image",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(deploy.advanceRelease).toHaveBeenCalledTimes(1);
    expect(deploy.advanceRelease).toHaveBeenCalledWith("one", "release-one");
    await act(async () => finish({ ...release, status: "observing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps a stable idempotency key for an uncertain prepare retry", async () => {
    vi.mocked(deploy.createRelease)
      .mockRejectedValueOnce(new Error("Request interrupted"))
      .mockResolvedValueOnce(release);
    renderPage();
    await screen.findByText(release.image);
    fireEvent.change(screen.getByLabelText("Environment"), {
      target: { value: "env-one" },
    });
    fireEvent.change(screen.getByLabelText("Pipeline ID"), {
      target: { value: "pipe-one" },
    });
    fireEvent.change(screen.getByLabelText("Successful run ID"), {
      target: { value: "run-one" },
    });
    fireEvent.change(screen.getByLabelText("Image manifest artifact ID"), {
      target: { value: "artifact-one" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare release" }));
    await screen.findByText("Request interrupted");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Prepare release" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Prepare release" }));
    await waitFor(() => expect(deploy.createRelease).toHaveBeenCalledTimes(2));
    expect(vi.mocked(deploy.createRelease).mock.calls[0][1].requestId).toBe(
      vi.mocked(deploy.createRelease).mock.calls[1][1].requestId,
    );
  });
  it("only offers cancellation for unapplied releases and checks observing rollouts explicitly", async () => {
    vi.mocked(deploy.listReleases).mockResolvedValue(
      page([{ ...release, status: "observing" }]),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Inspect Kubernetes state" }),
    );
    await waitFor(() =>
      expect(deploy.inspectRelease).toHaveBeenCalledWith("one", "release-one"),
    );
    expect(
      screen.queryByRole("button", { name: "Cancel queued release" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Rollback/ }),
    ).not.toBeInTheDocument();
  });
  it("clears review and source inputs when navigating to another project", async () => {
    const router = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Review execution" }),
    );
    await act(async () => router.navigate("/projects/two/deployments"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Pipeline ID")).toHaveValue("");
    expect(
      screen.getByRole("link", { name: "View project artifacts" }),
    ).toHaveAttribute("href", "/projects/two/artifacts");
    await waitFor(() =>
      expect(deploy.listReleases).toHaveBeenCalledWith(
        "two",
        1,
        expect.any(AbortSignal),
      ),
    );
    expect(deploy.advanceRelease).not.toHaveBeenCalled();
  });
  it("loads environments independently, with no credentials or endpoint fields", async () => {
    renderPage("/projects/one/environments");
    expect(await screen.findByText("Target configured")).toBeInTheDocument();
    expect(deploy.listReleases).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText(/token|kubeconfig|server url/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Configuration status only/)).toBeInTheDocument();
  });
  it("keeps global project selection in navigation history", async () => {
    const router = renderPage("/deploy");
    const selection = await screen.findByRole("combobox", { name: "Project" });
    await waitFor(() => expect(selection).toBeEnabled());
    fireEvent.change(selection, { target: { value: "one" } });
    expect(await screen.findByText(release.image)).toBeInTheDocument();
    await act(async () => router.navigate(-1));
    expect(screen.queryByText(release.image)).not.toBeInTheDocument();
    await act(async () => router.navigate(1));
    expect(await screen.findByText(release.image)).toBeInTheDocument();
  });
});

it("loads an exact selected release outside the current page and links back to its actual run", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(page([]));
  renderPage("/projects/one/deployments?release=release-one");
  const selected = await screen.findByLabelText("Selected release details");
  expect(within(selected).getByText(release.image)).toBeInTheDocument();
  expect(deploy.getRelease).toHaveBeenCalledWith(
    "one",
    "release-one",
    expect.any(AbortSignal),
  );
  expect(
    within(selected).getByRole("link", { name: "Return to pipeline run" }),
  ).toHaveAttribute("href", "/projects/one/pipelines/pipe-one?run=run-one");
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
});
it("does not fall back to a stale history record when the selected scoped release fails", async () => {
  vi.mocked(deploy.getRelease).mockRejectedValue(
    new Error("Release access denied"),
  );
  renderPage("/projects/one/deployments?release=release-one");
  await screen.findByText(
    /Selected release unavailable: Release access denied/,
  );
  expect(screen.queryByText(release.image)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review execution" }),
  ).not.toBeInTheDocument();
});
it("discards a selected release and its pending response when navigation changes project", async () => {
  let finish!: (value: DeploymentRelease) => void;
  vi.mocked(deploy.getRelease).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = renderPage("/projects/one/deployments?release=release-one");
  await waitFor(() => expect(deploy.getRelease).toHaveBeenCalledTimes(1));
  vi.mocked(deploy.listReleases).mockResolvedValue(page([]));
  await act(async () => view.navigate("/projects/two/deployments"));
  await act(async () => finish(release));
  expect(screen.queryByText(release.image)).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Selected release details"),
  ).not.toBeInTheDocument();
});

it("inspects an unresolved pipeline release without advancing or recovering it", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job", status: "applying" }]),
  );
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Inspect Kubernetes state" }),
  );
  const snapshot = await screen.findByLabelText(
    "Read-only Kubernetes inspection",
  );
  expect(snapshot).toHaveTextContent("Observed Kubernetes state: observing");
  expect(snapshot).toHaveTextContent(
    "Persisted release status remains applying",
  );
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Read-only Kubernetes inspection"),
    ).not.toBeInTheDocument(),
  );
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
});
it("requires fresh unchecked consent for same-ID recovery after pipeline cancellation, guards repeated clicks, and preserves terminal run state", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job", status: "applying" }]),
  );
  let finish!: (value: DeploymentRelease) => void;
  vi.mocked(deploy.recoverRelease).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Review same-release recovery" }),
  );
  const dialog = screen.getByRole("dialog");
  expect(
    await within(dialog).findByText("Original pipeline status: cancelled"),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText(/may already have applied/),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText(
      /even if the original pipeline was cancelled or timed out/,
    ),
  ).toBeInTheDocument();
  const checkbox = within(dialog).getByRole("checkbox");
  const recover = within(dialog).getByRole("button", {
    name: "Recover same release",
  });
  expect(checkbox).not.toBeChecked();
  expect(recover).toBeDisabled();
  fireEvent.click(checkbox);
  fireEvent.click(recover);
  fireEvent.click(recover);
  expect(deploy.recoverRelease).toHaveBeenCalledOnce();
  expect(deploy.recoverRelease).toHaveBeenCalledWith("one", "release-one");
  expect(within(dialog).getByRole("button", { name: "Back" })).toBeDisabled();
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
  expect(deploy.createRelease).not.toHaveBeenCalled();
  await act(async () => finish({ ...release, status: "observing" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    await screen.findByText(/original pipeline status is unchanged/),
  ).toBeInTheDocument();
});
it("cancels and reopens same-release recovery without carrying consent", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job", status: "applying" }]),
  );
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Review same-release recovery" }),
  );
  await screen.findByText("Original pipeline status: cancelled");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Review same-release recovery" }),
  );
  await screen.findByText("Original pipeline status: cancelled");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("cannot recover when the original pipeline cannot be verified and surfaces read-only inspection errors", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job", status: "applying" }]),
  );
  vi.mocked(deploy.inspectRelease).mockRejectedValue(
    new Error("Read-only inspection denied"),
  );
  vi.mocked(getRun).mockRejectedValue(new Error("Pipeline read denied"));
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Inspect Kubernetes state" }),
  );
  await screen.findByText("Read-only inspection denied");
  fireEvent.click(
    screen.getByRole("button", { name: "Review same-release recovery" }),
  );
  await screen.findByText(
    /Cannot verify original pipeline: Pipeline read denied/,
  );
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Recover same release" }),
  ).toBeDisabled();
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
});
it("does not manually launch a queued controller-managed pipeline release", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job" }]),
  );
  renderPage();
  await screen.findByText(release.image);
  expect(
    screen.queryByRole("button", { name: "Review execution" }),
  ).not.toBeInTheDocument();
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
});

it("records an observing rollout explicitly so the server can finalize and release its reservation", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, status: "observing" }]),
  );
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Inspect Kubernetes state" }),
  );
  await screen.findByLabelText("Read-only Kubernetes inspection");
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
  vi.mocked(deploy.advanceRelease).mockImplementation(async () => {
    const terminal = { ...release, status: "succeeded" as const };
    vi.mocked(deploy.listReleases).mockResolvedValue(page([terminal]));
    return terminal;
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Record rollout observation" }),
  );
  await waitFor(() =>
    expect(deploy.advanceRelease).toHaveBeenCalledWith("one", "release-one"),
  );
  await screen.findByText("succeeded");
  expect(
    screen.queryByRole("button", { name: "Record rollout observation" }),
  ).not.toBeInTheDocument();
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
});

it("can cancel an unapplied pipeline approval release without exposing execution or recovery", async () => {
  vi.mocked(deploy.listReleases).mockResolvedValue(
    page([{ ...release, origin: "pipeline_job", approvalId: "approval-1" }]),
  );
  renderPage();
  expect(
    await screen.findByText(/interrupted or stopped run cannot be resumed/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review execution" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review same-release recovery" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Cancel queued release" }),
  );
  await waitFor(() =>
    expect(deploy.cancelRelease).toHaveBeenCalledWith("one", "release-one"),
  );
  expect(
    await screen.findByText(/historical decisions remain in the audit record/),
  ).toBeInTheDocument();
  expect(deploy.advanceRelease).not.toHaveBeenCalled();
  expect(deploy.recoverRelease).not.toHaveBeenCalled();
});
