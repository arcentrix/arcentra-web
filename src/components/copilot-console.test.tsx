import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotConsole } from "./copilot-console";
import {
  analyzeCopilot,
  cancelCopilot,
  getCopilotSources,
  getCopilotStatus,
  previewCopilot,
} from "@/api/copilot";
import type { CopilotResult, CopilotStatus } from "@/api/copilot";
vi.mock("@/api/copilot", () => ({
  analyzeCopilot: vi.fn(),
  cancelCopilot: vi.fn(),
  getCopilotSources: vi.fn(),
  getCopilotStatus: vi.fn(),
  previewCopilot: vi.fn(),
}));
const configured: CopilotStatus = {
  configured: true,
  models: [
    { providerId: "approved", kind: "anthropic", model: "configured-model" },
  ],
  codeContext: "registered-text-artifacts-only",
  maxContextBytes: 24576,
  maxQuestionBytes: 4096,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCopilotStatus).mockResolvedValue(configured);
  vi.mocked(getCopilotSources).mockResolvedValue({
    steps: [{ stepRunId: "step", name: "Compile", status: 5 }],
    artifacts: [{ artifactId: "artifact", name: "main.go", size: 20 }],
    warnings: [],
  });
  vi.mocked(previewCopilot).mockResolvedValue({
    text: "Question: Why?\n[step] failure [REDACTED]",
    digest: "digest",
    evidence: [{ kind: "step-log", id: "step", bytes: 20, truncated: false }],
    warnings: [],
  });
  vi.mocked(cancelCopilot).mockResolvedValue({ cancelRequested: true });
  vi.mocked(analyzeCopilot).mockImplementation(async (_project, input) => ({
    requestId: input.requestId,
    text: "Check the build dependency. <img src=x onerror=alert(1)>",
    evidence: [{ kind: "step-log", id: "step", bytes: 20, truncated: false }],
    warnings: [],
    truncated: false,
  }));
});
afterEach(cleanup);
async function load() {
  fireEvent.change(screen.getByLabelText("Project ID"), {
    target: { value: "project" },
  });
  fireEvent.change(screen.getByLabelText("Run ID"), {
    target: { value: "run" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load context choices" }));
  await screen.findByLabelText("Compile", { exact: false });
}
async function prepare() {
  await load();
  fireEvent.click(screen.getByLabelText("Compile", { exact: false }));
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Why?" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Preview redacted context" }),
  );
  await screen.findByRole("region", { name: "Redacted context preview" });
  fireEvent.click(screen.getByLabelText(/Send this question/));
}
describe("Copilot explicit read-only analysis", () => {
  it("does not invent models or call a provider on initial render", () => {
    render(<CopilotConsole />);
    expect(getCopilotStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("fails closed when no project provider is configured", async () => {
    vi.mocked(getCopilotStatus).mockResolvedValue({
      ...configured,
      configured: false,
      models: [],
    });
    render(<CopilotConsole />);
    fireEvent.change(screen.getByLabelText("Project ID"), {
      target: { value: "project" },
    });
    fireEvent.change(screen.getByLabelText("Run ID"), {
      target: { value: "run" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load context choices" }),
    );
    expect(
      await screen.findByText(/No approved provider is configured/),
    ).toBeInTheDocument();
    expect(getCopilotSources).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
  });
  it("requires preview and explicit consent, sends only selected IDs, and escapes model output", async () => {
    render(<CopilotConsole />);
    await load();
    expect(
      screen.getByRole("button", { name: "Analyze selected context" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Compile", { exact: false }));
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Why?" },
    });
    expect(screen.getByLabelText(/Send this question/)).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByRole("region", { name: "Redacted context preview" });
    expect(analyzeCopilot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("region", { name: "Analysis result" });
    expect(analyzeCopilot).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeCopilot).mock.calls[0][1]).toMatchObject({
      contextDigest: "digest",
      providerId: "approved",
      model: "configured-model",
      context: { stepRunIds: ["step"], artifactIds: [], fromLine: 0 },
      shareSelectedContext: true,
    });
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
  it("invalidates preview and consent when selection changes", async () => {
    render(<CopilotConsole />);
    await prepare();
    fireEvent.click(screen.getByLabelText("main.go (20 bytes)"));
    expect(
      screen.queryByRole("region", { name: "Redacted context preview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analyze selected context" }),
    ).toBeDisabled();
  });
  it("cancels once, suppresses stale results, and reports server cancellation", async () => {
    let complete!: (result: CopilotResult) => void;
    vi.mocked(analyzeCopilot).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<CopilotConsole />);
    await prepare();
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(
      await screen.findByText(/Cancellation requested/),
    ).toBeInTheDocument();
    expect(cancelCopilot).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeCopilot).mock.calls[0][2]?.aborted).toBe(true);
    await act(async () =>
      complete({
        requestId: vi.mocked(analyzeCopilot).mock.calls[0][1].requestId,
        text: "stale",
        evidence: [],
        warnings: [],
        truncated: false,
      }),
    );
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });
  it("cancels pending analysis on unmount", async () => {
    vi.mocked(analyzeCopilot).mockImplementation(() => new Promise(() => {}));
    const rendered = render(<CopilotConsole />);
    await prepare();
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    rendered.unmount();
    expect(cancelCopilot).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeCopilot).mock.calls[0][2]?.aborted).toBe(true);
  });
  it("does not apply stale project capability results after scope changes", async () => {
    let complete!: (status: CopilotStatus) => void;
    vi.mocked(getCopilotStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<CopilotConsole />);
    fireEvent.change(screen.getByLabelText("Project ID"), {
      target: { value: "project" },
    });
    fireEvent.change(screen.getByLabelText("Run ID"), {
      target: { value: "run" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load context choices" }),
    );
    fireEvent.change(screen.getByLabelText("Project ID"), {
      target: { value: "other" },
    });
    await act(async () => complete(configured));
    expect(getCopilotSources).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("shows provider errors without fabricating an answer or automatically retrying", async () => {
    vi.mocked(analyzeCopilot).mockRejectedValue(
      new Error("model provider rate limit reached"),
    );
    render(<CopilotConsole />);
    await prepare();
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("rate limit");
    await waitFor(() => expect(analyzeCopilot).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("region", { name: "Analysis result" }),
    ).not.toBeInTheDocument();
  });
});
