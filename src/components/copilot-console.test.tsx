import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotConsole } from "./copilot-console";
import {
  analyzeCopilot,
  cancelCopilot,
  getCopilotSources,
  getCopilotStatus,
  previewCopilot,
} from "@/api/copilot";
import type {
  CopilotPreview,
  CopilotResult,
  CopilotSources,
  CopilotStatus,
} from "@/api/copilot";
import { CopilotPanel } from "./copilot-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { uiShellStore } from "@/store/ui-shell";
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
  uiShellStore.closeCopilot();
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
afterEach(() => {
  cleanup();
  uiShellStore.closeCopilot();
});
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
    expect(vi.mocked(previewCopilot).mock.calls[0][1].context).toEqual({
      stepRunIds: ["step"],
      artifactIds: [],
      fromLine: 0,
    });
    expect(
      vi.mocked(analyzeCopilot).mock.calls[0][1].context,
    ).not.toHaveProperty("sourceFiles");
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

const commit = "a".repeat(40);
const blob = "b".repeat(40);
const sourceStatus: CopilotStatus = {
  ...configured,
  models: [
    ...configured.models,
    { providerId: "approved", kind: "anthropic", model: "other-model" },
    {
      providerId: "other-provider",
      kind: "openai-compatible",
      model: "other-model",
    },
  ],
  codeContext: "registered-text-artifacts-and-selected-github-files",
  sourceContextEnabled: true,
  maxSourceFiles: 3,
  maxSourceFileBytes: 8192,
};
const sourceChoices: CopilotSources = {
  steps: [{ stepRunId: "step", name: "Compile", status: 5 }],
  artifacts: [{ artifactId: "artifact", name: "main.go", size: 20 }],
  sourceJobs: [
    {
      jobRunId: "job",
      name: "Build app",
      status: 5,
      available: true,
      reason: "",
      repository: "https://github.com/example/repo",
      requestedRef: "main",
      resolvedCommit: commit,
      provenanceState: "reported",
    },
    {
      jobRunId: "other-job",
      name: "Build tests",
      status: 5,
      available: true,
      reason: "",
      repository: "https://github.com/example/repo",
      requestedRef: "main",
      resolvedCommit: commit,
      provenanceState: "reported",
    },
    {
      jobRunId: "legacy-job",
      name: "Older build",
      status: 5,
      available: false,
      reason: "This job has no usable reported initial checkout",
      provenanceState: "unknown",
    },
  ],
  warnings: [],
};
const sourcePreview: CopilotPreview = {
  text: "Question: Why?\nSelected source text [REDACTED]",
  digest: "source-digest",
  evidence: [
    {
      kind: "source-file",
      id: "job:src/main.go",
      name: "src/main.go",
      bytes: 12,
      truncated: false,
      jobRunId: "job",
      repository: "https://github.com/example/repo",
      requestedRef: "main",
      resolvedCommit: commit,
      path: "src/main.go",
      blobSHA: blob,
      provenanceState: "reported",
    },
  ],
  warnings: [],
};
function configureSources() {
  vi.mocked(getCopilotStatus).mockResolvedValue(sourceStatus);
  vi.mocked(getCopilotSources).mockResolvedValue(sourceChoices);
  vi.mocked(previewCopilot).mockResolvedValue(sourcePreview);
  vi.mocked(analyzeCopilot).mockImplementation(async (_project, input) => ({
    ...sourcePreview,
    requestId: input.requestId,
    text: "Source analysis",
    truncated: false,
  }));
}
async function loadSources() {
  fireEvent.change(await screen.findByLabelText("Project ID"), {
    target: { value: "project" },
  });
  fireEvent.change(screen.getByLabelText("Run ID"), {
    target: { value: "run" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load context choices" }));
  await screen.findByLabelText("Source job");
}
function addSource(path = "src/main.go", jobRunId = "job") {
  fireEvent.change(screen.getByLabelText("Source job"), {
    target: { value: jobRunId },
  });
  fireEvent.change(screen.getByLabelText("Repository-relative path"), {
    target: { value: path },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add source file" }));
}
async function prepareSource(consent = true) {
  await loadSources();
  addSource();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Why?" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Preview redacted context" }),
  );
  await screen.findByRole("region", { name: "Redacted context preview" });
  if (consent) fireEvent.click(screen.getByLabelText(/Send this question/));
}

describe("Copilot selected initial-checkout source files", () => {
  beforeEach(configureSources);

  it("does not fetch choices, source content or model output merely by opening", () => {
    render(<CopilotConsole />);
    expect(getCopilotStatus).not.toHaveBeenCalled();
    expect(getCopilotSources).not.toHaveBeenCalled();
    expect(previewCopilot).not.toHaveBeenCalled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });

  it.each([false, undefined])(
    "fails closed when source capability is %s without disabling logs/artifacts",
    async (enabled) => {
      vi.mocked(getCopilotStatus).mockResolvedValue({
        ...sourceStatus,
        sourceContextEnabled: enabled,
      });
      render(<CopilotConsole />);
      await load();
      expect(
        screen.getByText(/Repository source context is unavailable/),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Source job")).not.toBeInTheDocument();
      expect(screen.getByLabelText("main.go (20 bytes)")).toBeEnabled();
      expect(previewCopilot).not.toHaveBeenCalled();
    },
  );

  it("shows absent and unavailable jobs honestly and never fetches a file on job/path edits", async () => {
    render(<CopilotConsole />);
    await loadSources();
    fireEvent.change(screen.getByLabelText("Source job"), {
      target: { value: "legacy-job" },
    });
    expect(
      screen.getByText("This job has no usable reported initial checkout"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Repository-relative path")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add source file" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Source job"), {
      target: { value: "job" },
    });
    fireEvent.change(screen.getByLabelText("Repository-relative path"), {
      target: { value: "src/main.go" },
    });
    expect(previewCopilot).not.toHaveBeenCalled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Selected job source")).toHaveTextContent(
      commit,
    );
    expect(
      screen.getByText(/current workspace or attest to what was built/),
    ).toBeInTheDocument();
  });

  it("shows a no-source-jobs state with logs and artifacts still selectable", async () => {
    vi.mocked(getCopilotSources).mockResolvedValue({
      ...sourceChoices,
      sourceJobs: [],
    });
    render(<CopilotConsole />);
    await load();
    expect(
      screen.getByText("No source jobs are available for this run."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Repository-relative path"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("main.go (20 bytes)")).toBeEnabled();
  });

  it("supports source-only preview, provenance review and explicitly consented analysis", async () => {
    vi.mocked(getCopilotSources).mockResolvedValue({
      ...sourceChoices,
      steps: [],
      artifacts: [],
    });
    render(<CopilotConsole />);
    await prepareSource(false);
    const previewRegion = screen.getByRole("region", {
      name: "Redacted context preview",
    });
    for (const value of [
      "job",
      "https://github.com/example/repo",
      "main",
      commit,
      "src/main.go",
      blob,
    ])
      expect(
        within(previewRegion).getByText(value, { exact: true }),
      ).toBeInTheDocument();
    expect(
      within(previewRegion).getByText(/Agent-reported initial commit/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analyze selected context" }),
    ).toBeDisabled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
    expect(vi.mocked(previewCopilot).mock.calls[0][1].context).toEqual({
      stepRunIds: [],
      artifactIds: [],
      sourceFiles: [{ jobRunId: "job", path: "src/main.go" }],
      fromLine: 0,
    });
    expect(
      vi.mocked(previewCopilot).mock.calls[0][1].shareSelectedContext,
    ).toBe(false);
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    const result = await screen.findByRole("region", {
      name: "Analysis result",
    });
    expect(vi.mocked(analyzeCopilot).mock.calls[0][1]).toMatchObject({
      contextDigest: "source-digest",
      shareSelectedContext: true,
      context: {
        stepRunIds: [],
        artifactIds: [],
        sourceFiles: [{ jobRunId: "job", path: "src/main.go" }],
      },
    });
    expect(within(result).getByText(blob)).toBeInTheDocument();
  });

  it("limits explicit selection to three source files, rejects duplicates and supports removal", async () => {
    render(<CopilotConsole />);
    await loadSources();
    addSource();
    addSource();
    expect(screen.getByRole("alert")).toHaveTextContent("already selected");
    addSource("src/other.ts");
    addSource("README.md");
    expect(
      within(
        screen.getByRole("list", { name: "Selected source files" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Repository-relative path"), {
      target: { value: "fourth.go" },
    });
    expect(
      screen.getByRole("button", { name: "Add source file" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove src/other.ts from job" }),
    );
    expect(
      screen.getByRole("button", { name: "Add source file" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Add source file" }));
    expect(
      screen.getByRole("list", { name: "Selected source files" }),
    ).toHaveTextContent("fourth.go");
    expect(previewCopilot).not.toHaveBeenCalled();
  });

  it("preserves separate log/artifact limits alongside source selection", async () => {
    vi.mocked(getCopilotSources).mockResolvedValue({
      ...sourceChoices,
      steps: Array.from({ length: 5 }, (_, i) => ({
        stepRunId: `step-${i}`,
        name: `Step ${i}`,
        status: 5,
      })),
      artifacts: Array.from({ length: 4 }, (_, i) => ({
        artifactId: `artifact-${i}`,
        name: `file-${i}.go`,
        size: 20,
      })),
    });
    render(<CopilotConsole />);
    await loadSources();
    addSource();
    for (let i = 0; i < 4; i++)
      fireEvent.click(screen.getByLabelText(`Step ${i}`, { exact: false }));
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByLabelText(`file-${i}.go (20 bytes)`));
    expect(screen.getByLabelText("Step 4", { exact: false })).toBeDisabled();
    expect(screen.getByLabelText("file-3.go (20 bytes)")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Why?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByRole("region", { name: "Redacted context preview" });
    expect(vi.mocked(previewCopilot).mock.calls[0][1].context).toEqual({
      stepRunIds: ["step-0", "step-1", "step-2", "step-3"],
      artifactIds: ["artifact-0", "artifact-1", "artifact-2"],
      sourceFiles: [{ jobRunId: "job", path: "src/main.go" }],
      fromLine: 0,
    });
  });

  it.each([1, 99])(
    "honors the smaller of the server source limit %s and three",
    async (limit) => {
      vi.mocked(getCopilotStatus).mockResolvedValue({
        ...sourceStatus,
        maxSourceFiles: limit,
      });
      render(<CopilotConsole />);
      await loadSources();
      for (let i = 0; i < Math.min(limit, 3); i++) addSource(`file-${i}.go`);
      fireEvent.change(screen.getByLabelText("Repository-relative path"), {
        target: { value: "another.go" },
      });
      expect(
        screen.getByRole("button", { name: "Add source file" }),
      ).toBeDisabled();
    },
  );

  it.each([
    "../main.go",
    "https://github.com/example/repo/main.go",
    "src/.env",
    "src/secrets.yaml",
    "src/main.go?ref=main",
    "src/image.png",
  ])("rejects unsafe typed path %s before requesting context", async (path) => {
    render(<CopilotConsole />);
    await loadSources();
    addSource(path);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Selected source files" }),
    ).not.toBeInTheDocument();
    expect(previewCopilot).not.toHaveBeenCalled();
  });

  it.each([
    [
      "question",
      () =>
        fireEvent.change(screen.getByLabelText("Question"), {
          target: { value: "What changed?" },
        }),
    ],
    [
      "model",
      () =>
        fireEvent.change(screen.getByLabelText("Configured model"), {
          target: { value: "1" },
        }),
    ],
    [
      "provider",
      () =>
        fireEvent.change(screen.getByLabelText("Configured model"), {
          target: { value: "2" },
        }),
    ],
    [
      "source job",
      () =>
        fireEvent.change(screen.getByLabelText("Source job"), {
          target: { value: "other-job" },
        }),
    ],
    [
      "typed path",
      () =>
        fireEvent.change(screen.getByLabelText("Repository-relative path"), {
          target: { value: "src/other.go" },
        }),
    ],
    [
      "source removal",
      () =>
        fireEvent.click(
          screen.getByRole("button", { name: "Remove src/main.go from job" }),
        ),
    ],
    [
      "step selection",
      () => fireEvent.click(screen.getByLabelText("Compile", { exact: false })),
    ],
    [
      "artifact selection",
      () => fireEvent.click(screen.getByLabelText("main.go (20 bytes)")),
    ],
    [
      "log range",
      () =>
        fireEvent.change(screen.getByLabelText("Starting log line"), {
          target: { value: "20" },
        }),
    ],
  ] as const)(
    "invalidates source preview and consent on %s changes",
    async (_name, change) => {
      render(<CopilotConsole />);
      await prepareSource();
      expect(
        screen.getByRole("button", { name: "Analyze selected context" }),
      ).toBeEnabled();
      change();
      expect(
        screen.queryByRole("region", { name: "Redacted context preview" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
      expect(
        screen.getByRole("button", { name: "Analyze selected context" }),
      ).toBeDisabled();
    },
  );

  it.each(["Project ID", "Run ID"])(
    "clears source selections and consent when %s changes",
    async (label) => {
      render(<CopilotConsole />);
      await prepareSource();
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "different" },
      });
      expect(
        screen.queryByRole("region", { name: "Redacted context preview" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("list", { name: "Selected source files" }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Load context choices" }),
      );
      await screen.findByLabelText("Source job");
      expect(screen.getByLabelText("Source job")).toHaveValue("");
      expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
    },
  );

  it("aborts and ignores stale preview after a path edit even when a newer preview finishes first", async () => {
    let finishOld!: (value: CopilotPreview) => void;
    vi.mocked(previewCopilot).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    render(<CopilotConsole />);
    await loadSources();
    addSource();
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Why?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    const oldSignal = vi.mocked(previewCopilot).mock.calls[0][2];
    fireEvent.change(screen.getByLabelText("Repository-relative path"), {
      target: { value: "src/new.go" },
    });
    expect(oldSignal?.aborted).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByRole("region", { name: "Redacted context preview" });
    await act(async () =>
      finishOld({ ...sourcePreview, text: "stale preview", digest: "stale" }),
    );
    expect(screen.queryByText("stale preview")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
    expect(cancelCopilot).not.toHaveBeenCalled();
  });

  it.each(["selection", "project", "cancel"])(
    "aborts pending source analysis on %s and suppresses late output",
    async (action) => {
      let complete!: (value: CopilotResult) => void;
      vi.mocked(analyzeCopilot).mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      render(<CopilotConsole />);
      await prepareSource();
      fireEvent.click(
        screen.getByRole("button", { name: "Analyze selected context" }),
      );
      const request = vi.mocked(analyzeCopilot).mock.calls[0];
      if (action === "selection")
        fireEvent.click(
          screen.getByRole("button", { name: "Remove src/main.go from job" }),
        );
      else if (action === "project")
        fireEvent.change(screen.getByLabelText("Project ID"), {
          target: { value: "new-project" },
        });
      else
        fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
      expect(request[2]?.aborted).toBe(true);
      expect(cancelCopilot).toHaveBeenCalledTimes(1);
      expect(cancelCopilot).toHaveBeenCalledWith(
        "project",
        request[1].requestId,
      );
      await act(async () =>
        complete({
          ...sourcePreview,
          text: "late source analysis",
          requestId: request[1].requestId,
          truncated: false,
        }),
      );
      expect(
        screen.queryByText("late source analysis"),
      ).not.toBeInTheDocument();
    },
  );

  it("ignores source choices that arrive after changing runs", async () => {
    let finish!: (value: CopilotSources) => void;
    vi.mocked(getCopilotSources).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
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
    await waitFor(() => expect(getCopilotSources).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText("Run ID"), {
      target: { value: "new-run" },
    });
    await act(async () => finish(sourceChoices));
    expect(screen.queryByLabelText("Source job")).not.toBeInTheDocument();
    expect(vi.mocked(getCopilotSources).mock.calls[0][2]?.aborted).toBe(true);
  });
});

function renderPanel() {
  let navigate!: ReturnType<typeof useNavigate>;
  function Panel() {
    navigate = useNavigate();
    return <CopilotPanel />;
  }
  render(
    <MemoryRouter initialEntries={["/build", "/observe"]} initialIndex={1}>
      <TooltipProvider>
        <Panel />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return {
    navigate: (to: string | number) =>
      act(() => {
        if (typeof to === "number") navigate(to);
        else navigate(to);
      }),
  };
}

describe("source context drawer dismissal", () => {
  beforeEach(configureSources);

  it.each(["Close", "Escape", "app navigation", "Back", "Forward"])(
    "cancels once on %s and reopens without source state",
    async (action) => {
      let finish!: (value: CopilotResult) => void;
      vi.mocked(analyzeCopilot).mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const router = renderPanel();
      if (action === "Forward") router.navigate(-1);
      fireEvent.click(screen.getByRole("button", { name: "Open Copilot" }));
      await prepareSource();
      fireEvent.click(
        screen.getByRole("button", { name: "Analyze selected context" }),
      );
      const request = vi.mocked(analyzeCopilot).mock.calls[0];
      if (action === "Close")
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
      else if (action === "Escape")
        fireEvent.keyDown(document, { key: "Escape" });
      else if (action === "Back") router.navigate(-1);
      else if (action === "Forward") router.navigate(1);
      else router.navigate("/agents");
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(cancelCopilot).toHaveBeenCalledTimes(1);
      expect(cancelCopilot).toHaveBeenCalledWith(
        "project",
        request[1].requestId,
      );
      expect(request[2]?.aborted).toBe(true);
      await act(async () =>
        finish({
          ...sourcePreview,
          text: "dismissed source result",
          requestId: request[1].requestId,
          truncated: false,
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Open Copilot" }));
      expect(await screen.findByLabelText("Project ID")).toHaveValue("");
      expect(
        screen.queryByRole("list", { name: "Selected source files" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("dismissed source result"),
      ).not.toBeInTheDocument();
      expect(cancelCopilot).toHaveBeenCalledTimes(1);
    },
  );

  it("aborts pending preview on Close without sending model data or cancellation", async () => {
    let finish!: (value: CopilotPreview) => void;
    vi.mocked(previewCopilot).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open Copilot" }));
    await loadSources();
    addSource();
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Why?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(vi.mocked(previewCopilot).mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => finish(sourcePreview));
    expect(analyzeCopilot).not.toHaveBeenCalled();
    expect(cancelCopilot).not.toHaveBeenCalled();
  });
});
