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
import { PipelineSpecDialog } from "./pipeline-dialogs";
import {
  getPipelineSpec,
  savePipelineSpec,
  validatePipelineSpec,
} from "@/api/pipeline";
import type { Pipeline, PipelineSpec } from "@/api/pipeline/types";
import { ApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
vi.mock("@/api/pipeline", () => ({
  getPipelineSpec: vi.fn(),
  savePipelineSpec: vi.fn(),
  validatePipelineSpec: vi.fn(),
}));
const pipeline = {
  pipelineId: "p1",
  projectId: "pr1",
  name: "Visual",
  pipelineFilePath: "pipeline.yaml",
} as Pipeline;
const spec = () => ({
  namespace: "visual-ci",
  variables: { PRESERVE: "retained" },
  jobs: [
    {
      name: "build",
      description: "Original",
      env: { KEEP: "value" },
      steps: [
        {
          name: "compile",
          uses: "shell",
          action: "run",
          args: { run: "echo original" },
          runOnAgent: true,
        },
      ],
    },
  ],
});
const snapshot = (overrides: Partial<PipelineSpec> = {}): PipelineSpec => ({
  spec: spec(),
  format: "SPEC_FORMAT_YAML",
  headCommitSha: "a".repeat(40),
  branch: "main",
  pipelineFilePath: "pipeline.yaml",
  ...overrides,
});
const json = () =>
  screen.getByLabelText("Pipeline definition JSON") as HTMLTextAreaElement;
const button = (name: string) => screen.getByRole("button", { name });
async function show(readOnly = false) {
  const onClose = vi.fn();
  const view = render(
    <PipelineSpecDialog
      pipeline={pipeline}
      onClose={onClose}
      readOnly={readOnly}
    />,
  );
  await screen.findByLabelText("Pipeline definition JSON");
  await waitFor(() => expect(json()).not.toBeDisabled());
  return { ...view, onClose };
}
function tab(name: "Graph" | "JSON") {
  const target = screen.getByRole("tab", { name });
  fireEvent.mouseDown(target, { button: 0, ctrlKey: false });
  fireEvent.click(target);
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
}
async function reload() {
  fireEvent.click(button("Reload definition"));
  if (screen.queryByRole("button", { name: "Reload and discard draft" }))
    fireEvent.click(button("Reload and discard draft"));
  await waitFor(() => expect(button("Reload definition")).toBeEnabled());
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPipelineSpec).mockResolvedValue(snapshot());
  vi.mocked(validatePipelineSpec).mockResolvedValue({
    jobsCount: 1,
    warnings: [],
  });
  vi.mocked(savePipelineSpec).mockResolvedValue({
    commitSha: "b".repeat(40),
    prUrl: "",
    saveMode: "PIPELINE_SAVE_MODE_DIRECT",
  });
});
afterEach(() => {
  cleanup();
  authStore.clearTokens();
});

describe("visual CI definition dialog", () => {
  it("gives command textareas an exact stable accessible name independent of initial command text", async () => {
    await show();
    tab("Graph");
    const command = screen.getByRole("textbox", {
      name: "Command for compile",
    });
    expect(command).toHaveAttribute("aria-label", "Command for compile");
    expect(command).toHaveValue("echo original");
    fireEvent.change(command, { target: { value: "printf 'updated\\n'" } });
    expect(
      screen.getByRole("textbox", { name: "Command for compile" }),
    ).toHaveValue("printf 'updated\\n'");
  });
  it("keeps one draft across modes and saves only explicitly with original format, head and request ID", async () => {
    await show();
    const original = JSON.parse(json().value);
    tab("Graph");
    change("Command for compile", "echo edited");
    change("New step name", "verify");
    fireEvent.click(button("Add step"));
    change("New job name", "package");
    fireEvent.click(button("Add job"));
    fireEvent.click(screen.getByRole("checkbox", { name: "build" }));
    expect(savePipelineSpec).not.toHaveBeenCalled();
    expect(validatePipelineSpec).not.toHaveBeenCalled();
    tab("JSON");
    const expected = JSON.parse(json().value);
    expect(expected.variables).toEqual(original.variables);
    expect(expected.jobs[0].env).toEqual(original.jobs[0].env);
    expect(expected.jobs[0].description).toBe("Original");
    expect(expected.jobs[0].steps[0].args.run).toBe("echo edited");
    expect(expected.jobs[1].dependsOn).toEqual(["build"]);
    fireEvent.click(button("Save to repository"));
    await screen.findByText(`Committed ${"b".repeat(12)} to main.`);
    expect(validatePipelineSpec).toHaveBeenCalledWith("p1", expected);
    expect(savePipelineSpec).toHaveBeenCalledWith(
      "p1",
      expected,
      "a".repeat(40),
      expect.any(String),
      "yaml",
    );
    expect(json().value).toBe(JSON.stringify(expected, null, 2));
    expect(json()).toHaveAttribute("readonly");
    expect(button("Save to repository")).toBeDisabled();
    expect(getPipelineSpec).toHaveBeenCalledTimes(1);
    vi.mocked(getPipelineSpec).mockResolvedValue(
      snapshot({ spec: expected, headCommitSha: "b".repeat(40) }),
    );
    await reload();
    expect(json()).not.toHaveAttribute("readonly");
    expect(
      screen.getByText(`Based on commit ${"b".repeat(40)}`),
    ).toBeInTheDocument();
  });
  it("retains unknown fields and blocks opaque identity edits while allowing narrow command patches", async () => {
    const authored = { ...spec(), extension: { opaque: [1, "keep"] } };
    vi.mocked(getPipelineSpec).mockResolvedValue(snapshot({ spec: authored }));
    await show();
    tab("Graph");
    expect(button("Rename job")).toBeDisabled();
    expect(button("Delete job")).toBeDisabled();
    change("Command for compile", "echo changed");
    tab("JSON");
    expect(JSON.parse(json().value).extension).toEqual(authored.extension);
    expect(savePipelineSpec).not.toHaveBeenCalled();
  });
  it("keeps invalid raw text byte-for-byte when Graph cannot project it", async () => {
    await show();
    const raw = '{ "jobs": [ ??? untouched';
    fireEvent.change(json(), { target: { value: raw } });
    tab("Graph");
    expect(screen.getByRole("status")).toHaveTextContent("Graph unavailable");
    tab("JSON");
    expect(json().value).toBe(raw);
    fireEvent.click(button("Validate"));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(alert).toHaveTextContent("Invalid JSON");
    expect(validatePipelineSpec).not.toHaveBeenCalled();
  });
  it("rejects cyclic dependency controls without changing the JSON", async () => {
    await show();
    tab("Graph");
    change("New job name", "test");
    fireEvent.click(button("Add job"));
    fireEvent.click(screen.getByRole("checkbox", { name: "build" }));
    fireEvent.click(button("Job build"));
    fireEvent.click(screen.getByRole("checkbox", { name: "test" }));
    expect(screen.getByRole("alert")).toHaveTextContent("cycle");
    expect(screen.getByRole("checkbox", { name: "test" })).not.toBeChecked();
    tab("JSON");
    expect(JSON.parse(json().value).jobs[0].dependsOn).toBeUndefined();
  });
  it("retains a conflicted draft, never retries automatically, and only discards after explicit successful reload", async () => {
    await show();
    const edited = JSON.stringify({ ...spec(), version: "1.2.3" });
    fireEvent.change(json(), { target: { value: edited } });
    vi.mocked(savePipelineSpec).mockRejectedValue(
      new ApiError({ code: 409, message: "SECRET_CONFLICT_CANARY" }),
    );
    fireEvent.click(button("Save to repository"));
    await screen.findByText(/The repository changed/);
    expect(document.body).not.toHaveTextContent("SECRET_CONFLICT_CANARY");
    expect(json().value).toBe(edited);
    expect(button("Save to repository")).toBeDisabled();
    fireEvent.change(json(), { target: { value: edited + "\n" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The repository changed",
    );
    expect(button("Save to repository")).toBeDisabled();
    fireEvent.change(json(), { target: { value: edited } });
    fireEvent.click(button("Reload definition"));
    fireEvent.click(button("Keep draft"));
    expect(json().value).toBe(edited);
    expect(getPipelineSpec).toHaveBeenCalledTimes(1);
    vi.mocked(getPipelineSpec).mockRejectedValueOnce(
      new ApiError({ code: 503, message: "SECRET_RELOAD_CANARY" }),
    );
    await reload();
    expect(json().value).toBe(edited);
    expect(document.body).not.toHaveTextContent("SECRET_RELOAD_CANARY");
    vi.mocked(getPipelineSpec).mockResolvedValue(
      snapshot({ headCommitSha: "c".repeat(40) }),
    );
    await reload();
    expect(JSON.parse(json().value)).toEqual(spec());
    expect(button("Save to repository")).toBeEnabled();
    expect(savePipelineSpec).toHaveBeenCalledTimes(1);
  });
  it.each(["validate", "save", "reload"])(
    "hides private drafts on %s access denial",
    async (phase) => {
      vi.mocked(getPipelineSpec).mockResolvedValue(
        snapshot({
          spec: { ...spec(), variables: { PRIVATE: "PRIVATE_SPEC_CANARY" } },
        }),
      );
      await show();
      const denied = new ApiError({
        code: 403,
        message: "PRIVATE_ERROR_CANARY",
      });
      if (phase === "validate")
        vi.mocked(validatePipelineSpec).mockRejectedValue(denied);
      if (phase === "save")
        vi.mocked(savePipelineSpec).mockRejectedValue(denied);
      if (phase === "reload") {
        vi.mocked(getPipelineSpec).mockRejectedValue(denied);
        await reload();
      } else fireEvent.click(button("Save to repository"));
      await screen.findByText(
        "Definition access is restricted. The previous snapshot is hidden.",
      );
      expect(document.body).not.toHaveTextContent(/PRIVATE_.*CANARY/);
      expect(
        screen.queryByLabelText("Pipeline definition JSON"),
      ).not.toBeInTheDocument();
      expect(button("Save to repository")).toBeDisabled();
    },
  );
  it("disables every mutation in read-only mode while keeping accessible graph navigation", async () => {
    await show(true);
    expect(json()).toHaveAttribute("readonly");
    tab("Graph");
    for (const control of within(
      screen.getByRole("region", { name: "Visual pipeline editor" }),
    ).getAllByRole("button"))
      if (control.textContent !== "Job build") expect(control).toBeDisabled();
    expect(button("Job build")).toHaveAttribute("aria-pressed", "true");
    expect(button("Validate")).toBeDisabled();
    expect(button("Save to repository")).toBeDisabled();
  });
  it("never sends a late save after account changes or update permission is removed", async () => {
    let resolve!: (value: { jobsCount: number; warnings: string[] }) => void;
    vi.mocked(validatePipelineSpec).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = await show();
    fireEvent.click(button("Save to repository"));
    view.rerender(
      <PipelineSpecDialog
        pipeline={pipeline}
        onClose={view.onClose}
        readOnly
      />,
    );
    await act(async () => resolve({ jobsCount: 1, warnings: [] }));
    expect(savePipelineSpec).not.toHaveBeenCalled();
    view.rerender(
      <PipelineSpecDialog pipeline={pipeline} onClose={view.onClose} />,
    );
    vi.mocked(validatePipelineSpec).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(button("Save to repository"));
    await act(async () => {
      authStore.setTokens({
        accessToken: "synthetic-second-account",
        refreshToken: "synthetic-second-refresh",
      });
    });
    await act(async () => resolve({ jobsCount: 1, warnings: [] }));
    expect(savePipelineSpec).not.toHaveBeenCalled();
  });
  it("uses the same request ID only for explicit retry of an unchanged uncertain save", async () => {
    await show();
    vi.mocked(savePipelineSpec).mockRejectedValue(
      new ApiError({ code: 503, message: "RAW_SAVE_CANARY" }),
    );
    fireEvent.click(button("Save to repository"));
    await screen.findByRole("alert");
    const first = vi.mocked(savePipelineSpec).mock.calls[0];
    expect(document.body).not.toHaveTextContent("RAW_SAVE_CANARY");
    fireEvent.click(button("Save to repository"));
    await waitFor(() => expect(savePipelineSpec).toHaveBeenCalledTimes(2));
    expect(vi.mocked(savePipelineSpec).mock.calls[1][3]).toBe(first[3]);
    await waitFor(() => expect(button("Save to repository")).toBeEnabled());
    fireEvent.change(json(), {
      target: { value: JSON.stringify({ ...spec(), version: "1.0.1" }) },
    });
    fireEvent.click(button("Save to repository"));
    await waitFor(() => expect(savePipelineSpec).toHaveBeenCalledTimes(3));
    expect(vi.mocked(savePipelineSpec).mock.calls[2][3]).not.toBe(first[3]);
    expect(vi.mocked(savePipelineSpec).mock.calls[2][2]).toBe("a".repeat(40));
  });

  it.each(["not-a-sha", "b".repeat(39), "g".repeat(40), ""])(
    "rejects malformed saved commit %s without losing the draft or request ID",
    async (commitSha) => {
      await show();
      const retained = json().value;
      vi.mocked(savePipelineSpec).mockResolvedValueOnce({
        commitSha,
        prUrl: "",
        saveMode: "PIPELINE_SAVE_MODE_DIRECT",
      });
      fireEvent.click(button("Save to repository"));
      await screen.findByText(/The save response could not be verified/);
      expect(json()).toHaveValue(retained);
      expect(screen.queryByText(/^Committed /)).not.toBeInTheDocument();
      expect(json()).not.toHaveAttribute("readonly");
      const first = vi.mocked(savePipelineSpec).mock.calls[0];
      fireEvent.click(button("Save to repository"));
      await screen.findByText(`Committed ${"b".repeat(12)} to main.`);
      expect(vi.mocked(savePipelineSpec).mock.calls[1]).toEqual(first);
    },
  );

  it("keeps a PR-mode idempotent retry honest when the backend omits the PR URL", async () => {
    await show();
    vi.mocked(savePipelineSpec).mockRejectedValueOnce(
      new ApiError({ code: 503, message: "uncertain" }),
    );
    fireEvent.click(button("Save to repository"));
    await screen.findByRole("alert");
    const first = vi.mocked(savePipelineSpec).mock.calls[0];
    vi.mocked(savePipelineSpec).mockResolvedValueOnce({
      commitSha: "c".repeat(40),
      prUrl: "",
      saveMode: "PIPELINE_SAVE_MODE_PR",
    });
    fireEvent.click(button("Save to repository"));
    await screen.findByText(/Recorded PR-mode commit/);
    expect(vi.mocked(savePipelineSpec).mock.calls[1]).toEqual(first);
    expect(screen.getByText(/Recorded PR-mode commit/)).toHaveTextContent(
      "a default-branch update is not confirmed",
    );
    expect(screen.queryByText(/^Committed /)).not.toBeInTheDocument();
    expect(button("Save to repository")).toBeDisabled();
  });

  it("never assumes a default-branch update when save mode is missing", async () => {
    await show();
    vi.mocked(savePipelineSpec).mockResolvedValueOnce({
      commitSha: "c".repeat(64),
      prUrl: "",
    });
    fireEvent.click(button("Save to repository"));
    await screen.findByText(/The save mode was not returned/);
    expect(screen.queryByText(/^Committed /)).not.toBeInTheDocument();
  });

  it.each([
    null,
    { spec: null },
    { headCommitSha: "not-a-sha" },
    { headCommitSha: "" },
    { format: "xml" },
    { branch: "" },
    { pipelineFilePath: "" },
  ])(
    "never replaces a retained draft with malformed successful reload %j",
    async (override) => {
      await show();
      const retained = JSON.stringify({ ...spec(), version: "retained-draft" });
      fireEvent.change(json(), { target: { value: retained } });
      vi.mocked(getPipelineSpec).mockResolvedValueOnce(
        (override === null
          ? null
          : { ...snapshot(), ...override }) as PipelineSpec,
      );
      await reload();
      expect(json()).toHaveValue(retained);
      expect(json()).toBeDisabled();
      expect(button("Save to repository")).toBeDisabled();
      expect(
        screen.getByText(/The pipeline definition could not be loaded/),
      ).toBeInTheDocument();
      expect(savePipelineSpec).not.toHaveBeenCalled();
      vi.mocked(getPipelineSpec).mockResolvedValueOnce(
        snapshot({ headCommitSha: "c".repeat(40) }),
      );
      await reload();
      expect(json().value).not.toContain("retained-draft");
      expect(button("Save to repository")).toBeEnabled();
    },
  );

  it("locks duplicate clicks and does not replace an unsaved draft during failed reload", async () => {
    let complete!: (value: { jobsCount: number; warnings: string[] }) => void;
    vi.mocked(validatePipelineSpec).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await show();
    const action = button("Save to repository");
    fireEvent.click(action);
    fireEvent.click(action);
    expect(validatePipelineSpec).toHaveBeenCalledTimes(1);
    expect(savePipelineSpec).not.toHaveBeenCalled();
    expect(button("Reload definition")).toBeDisabled();
    await act(async () => complete({ jobsCount: 1, warnings: [] }));
    expect(savePipelineSpec).toHaveBeenCalledTimes(1);
  });

  it("does not flash a denied private snapshot while rechecking read access", async () => {
    vi.mocked(getPipelineSpec).mockResolvedValue(
      snapshot({ spec: { ...spec(), namespace: "READ_CANARY" } }),
    );
    await show();
    vi.mocked(getPipelineSpec).mockRejectedValueOnce(
      new ApiError({ status: 403, code: 500, message: "READ_ERROR_CANARY" }),
    );
    await reload();
    expect(
      screen.queryByLabelText("Pipeline definition JSON"),
    ).not.toBeInTheDocument();
    let complete!: (value: PipelineSpec) => void;
    vi.mocked(getPipelineSpec).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    fireEvent.click(button("Reload definition"));
    await screen.findByRole("button", { name: "Reloading…" });
    expect(document.body).not.toHaveTextContent("READ_CANARY");
    expect(
      screen.queryByLabelText("Pipeline definition JSON"),
    ).not.toBeInTheDocument();
    await act(async () => complete(snapshot()));
    await screen.findByLabelText("Pipeline definition JSON");
    expect(json().value).not.toContain("READ_CANARY");
  });

  it("isolates pipeline identity and drops the previous unsaved draft", async () => {
    const view = await show();
    fireEvent.change(json(), {
      target: { value: '{"private":"OLD_DRAFT_CANARY"}' },
    });
    vi.mocked(getPipelineSpec).mockResolvedValue(
      snapshot({ spec: { ...spec(), namespace: "second" } }),
    );
    view.rerender(
      <PipelineSpecDialog
        pipeline={{ ...pipeline, pipelineId: "p2" }}
        onClose={view.onClose}
      />,
    );
    await waitFor(() => expect(json().value).toContain("second"));
    expect(json().value).not.toContain("OLD_DRAFT_CANARY");
  });
  it("provides keyboard mode switching and semantic controls without drag-only actions", async () => {
    await show();
    const jsonTab = screen.getByRole("tab", { name: "JSON" });
    act(() => jsonTab.focus());
    fireEvent.keyDown(jsonTab, { key: "ArrowLeft" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Graph" })).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Graph" }), {
      key: "Enter",
    });
    await screen.findByRole("region", { name: "Visual pipeline editor" });
    expect(
      screen.getByRole("img", { name: /Static job dependency graph/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Ordered steps for build" }),
    ).toBeInTheDocument();
    expect(button("Add job").closest('[role="dialog"]')).toHaveClass(
      "overflow-y-auto",
      "min-w-0",
    );
  });
});
