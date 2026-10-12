import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunPipelineDialog } from "./pipeline-dialogs";
import { triggerPipeline } from "@/api/pipeline";
import type { Pipeline } from "@/api/pipeline/types";
vi.mock("@/api/pipeline", () => ({ triggerPipeline: vi.fn() }));
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
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe("RunPipelineDialog", () => {
  it("requires string variables before executing", async () => {
    render(
      <RunPipelineDialog
        pipeline={pipeline}
        onClose={vi.fn()}
        onStarted={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: '{"bad": 123}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("string values");
    expect(triggerPipeline).not.toHaveBeenCalled();
  });
  it("retries an uncertain start with the same idempotency key", async () => {
    vi.mocked(triggerPipeline)
      .mockRejectedValueOnce(new Error("Network interrupted"))
      .mockResolvedValueOnce({ runID: "run-1" });
    const started = vi.fn();
    render(
      <RunPipelineDialog
        pipeline={pipeline}
        onClose={vi.fn()}
        onStarted={started}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    await screen.findByText("Network interrupted");
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    await waitFor(() => expect(started).toHaveBeenCalledWith("run-1"));
    expect(vi.mocked(triggerPipeline).mock.calls[0][2]).toBe(
      vi.mocked(triggerPipeline).mock.calls[1][2],
    );
  });
  it("prevents duplicate submissions and cancellation while starting", async () => {
    let finish!: (value: { runID: string }) => void;
    vi.mocked(triggerPipeline).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    const onStarted = vi.fn();
    render(
      <RunPipelineDialog
        pipeline={pipeline}
        onClose={onClose}
        onStarted={onStarted}
      />,
    );
    const start = screen.getByRole("button", { name: "Start run" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(triggerPipeline).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish({ runID: "run-2" });
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith("run-2"));
    expect(onClose).not.toHaveBeenCalled();
  });
  it("dismisses without triggering when cancelled", () => {
    const onClose = vi.fn();
    render(
      <RunPipelineDialog
        pipeline={pipeline}
        onClose={onClose}
        onStarted={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(triggerPipeline).not.toHaveBeenCalled();
  });
});

it("does not navigate back after the user has left a pending run form", async () => {
  let finish!: (value: { runID: string }) => void;
  vi.mocked(triggerPipeline).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onStarted = vi.fn();
  const view = render(
    <RunPipelineDialog
      pipeline={pipeline}
      onClose={vi.fn()}
      onStarted={onStarted}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start run" }));
  view.unmount();
  finish({ runID: "late-run" });
  await waitFor(() => expect(triggerPipeline).toHaveBeenCalledTimes(1));
  expect(onStarted).not.toHaveBeenCalled();
});
