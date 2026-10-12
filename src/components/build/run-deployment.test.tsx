import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRelease } from "@/api/deploy";
import type { DeploymentRelease } from "@/api/deploy";
import { RunDeployment } from "./run-deployment";
vi.mock("@/api/deploy", () => ({ getRelease: vi.fn() }));
const release: DeploymentRelease = {
  releaseId: "rel/1",
  projectId: "project/1",
  requestId: "request",
  environmentId: "env",
  pipelineId: "pipe",
  pipelineRunId: "run",
  artifactId: "artifact",
  artifactSha256: "a".repeat(64),
  commitSha: "b".repeat(40),
  image: `registry.example/app@sha256:${"c".repeat(64)}`,
  createdBy: "actor",
  status: "applying",
  reason: "Pipeline cancelled; apply outcome unresolved",
  desiredReplicas: 0,
  updatedReplicas: 0,
  availableReplicas: 0,
};
function show() {
  return render(
    <MemoryRouter>
      <RunDeployment
        projectId="project/1"
        pipelineId="pipe"
        runId="run"
        releaseId="rel/1"
      />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRelease).mockResolvedValue(release);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("shows authoritative release state, uncertainty, and an encoded inspection link without implying rollback", async () => {
  show();
  expect(
    await screen.findByText("Release status: applying"),
  ).toBeInTheDocument();
  expect(screen.getByText(release.reason!)).toBeInTheDocument();
  expect(
    screen.getByText(/explicitly recover this same release ID/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Pipeline cancellation or timeout does not roll back/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Inspect release in Deployments" }),
  ).toHaveAttribute(
    "href",
    "/projects/project%2F1/deployments?release=rel%2F1",
  );
  expect(getRelease).toHaveBeenCalledWith(
    "project/1",
    "rel/1",
    expect.any(AbortSignal),
  );
});
it("fails closed for a release from a different pipeline run", async () => {
  vi.mocked(getRelease).mockResolvedValue({
    ...release,
    pipelineRunId: "another-run",
  });
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "does not belong to this pipeline run",
  );
  expect(screen.queryByText(release.image)).not.toBeInTheDocument();
});
it("hides retained status on a denied refresh and keeps a read-only retry", async () => {
  show();
  await screen.findByText("Release status: applying");
  vi.mocked(getRelease).mockRejectedValue(new Error("Access denied"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh release" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  expect(
    screen.queryByText("Release status: applying"),
  ).not.toBeInTheDocument();
  vi.mocked(getRelease).mockResolvedValue({ ...release, status: "observing" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh release" }));
  await screen.findByText("Release status: observing");
});
it("keeps reading unresolved release state after the run has ended, and stops polling only on a terminal release", async () => {
  vi.useFakeTimers();
  show();
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(getRelease).toHaveBeenCalledTimes(4);
  vi.mocked(getRelease).mockResolvedValue({ ...release, status: "succeeded" });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  const calls = vi.mocked(getRelease).mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(getRelease).toHaveBeenCalledTimes(calls);
  expect(screen.getByText("Release status: succeeded")).toBeInTheDocument();
});
it("does not show a late response after unmount", async () => {
  let finish!: (value: DeploymentRelease) => void;
  vi.mocked(getRelease).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = show();
  await waitFor(() => expect(getRelease).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => finish(release));
  expect(screen.queryByText(release.image)).not.toBeInTheDocument();
});
