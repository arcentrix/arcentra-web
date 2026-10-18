import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock("@/api/pipeline", () => ({
  getPipelineSpec: vi.fn(),
  savePipelineSpec: vi.fn(),
  validatePipelineSpec: vi.fn(),
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
const retry = {
  mode: "failed_step",
  maxAttempts: 2,
  allowedExitCodes: [9],
  idempotent: true,
};
const definition: PipelineSpec = {
  spec: {
    runtime: { type: "containerd-offline-v1" },
    jobs: [{ name: "build", steps: [{ name: "prepare", uses: "shell" }] }],
  },
  format: "json",
  headCommitSha: "a".repeat(40),
  branch: "main",
  pipelineFilePath: ".arcentra/pipeline.yaml",
  deploymentPlan: null,
  deploymentPlanHash: "",
};
const editor = () =>
  screen.getByLabelText("Pipeline definition JSON") as HTMLTextAreaElement;
const applyRetry = () =>
  screen.getByRole("button", { name: "Apply retry policy to draft" });
const save = () => screen.getByRole("button", { name: "Save to repository" });
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
  await waitFor(() => expect(save().hasAttribute("disabled")).toBe(readOnly));
  fireEvent.click(
    screen.getByText("Retry policy · off unless explicitly configured"),
  );
  return { ...view, onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPipelineSpec).mockResolvedValue(definition);
  vi.mocked(validatePipelineSpec).mockResolvedValue({
    jobsCount: 1,
    warnings: [],
  });
});
afterEach(cleanup);

describe("failed-step retry draft integration", () => {
  it("applies only to the local JSON and discards it on Close without validation or a save", async () => {
    const view = await show();
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[90dvh]",
      "overflow-y-auto",
    );
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "failed_step" },
    });
    fireEvent.change(screen.getByLabelText("Retry exit codes"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(JSON.parse(editor().value)).toEqual(definition.spec);
    fireEvent.click(applyRetry());
    const draft = JSON.parse(editor().value);
    expect(draft.jobs[0].retry).toEqual({ ...retry, delay: "1s" });
    expect(draft.runtime).toEqual(definition.spec.runtime);
    expect(validatePipelineSpec).not.toHaveBeenCalled();
    expect(savePipelineSpec).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Committed|Saved to a pull request/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    await show();
    expect(JSON.parse(editor().value)).toEqual(definition.spec);
    expect(screen.getByLabelText("Retry scope")).toHaveValue("off");
    expect(savePipelineSpec).not.toHaveBeenCalled();
  });

  it("keeps the authored failed-step draft and backend refusal visible; never falls back or saves after a rejected validation", async () => {
    await show();
    const authored = JSON.stringify({
      ...definition.spec,
      jobs: [{ name: "build", retry }],
    });
    fireEvent.change(editor(), { target: { value: authored } });
    vi.mocked(validatePipelineSpec).mockRejectedValue(
      new ApiError({
        code: 422,
        message: "Failed-step runtime acceptance gate is closed",
      }),
    );
    fireEvent.click(save());
    await screen.findByText(
      "The server rejected this definition or could not save it. Your draft is retained; check the DSL and retry explicitly.",
    );
    expect(validatePipelineSpec).toHaveBeenCalledWith(
      "p1",
      JSON.parse(authored),
    );
    expect(editor()).toHaveValue(authored);
    expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
    expect(savePipelineSpec).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Committed|Saved to a pull request|Valid definition/),
    ).not.toBeInTheDocument();
  });

  it("does not auto-apply an unsupported gate and keeps server save errors without a success notice", async () => {
    await show();
    const authored = JSON.stringify({
      ...definition.spec,
      jobs: [
        {
          name: "build",
          retry,
          approval: {
            required: true,
            type: "manual",
            plugin: "builtin:retry-approval",
            params: { approvers: ["untrusted"] },
          },
        },
      ],
    });
    fireEvent.change(editor(), { target: { value: authored } });
    expect(applyRetry()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "requires the exact manual",
    );
    expect(editor()).toHaveValue(authored);
    expect(validatePipelineSpec).not.toHaveBeenCalled();
    expect(savePipelineSpec).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "off" },
    });
    fireEvent.click(applyRetry());
    const changed = editor().value;
    vi.mocked(savePipelineSpec).mockRejectedValue(
      new ApiError({
        code: 409,
        message: "Repository head changed; review the definition again",
      }),
    );
    fireEvent.click(save());
    await screen.findByText(
      "The repository changed. Your draft is retained. Reload and review the latest definition before saving again.",
    );
    expect(editor()).toHaveValue(changed);
    expect(savePipelineSpec).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/Committed|Saved to a pull request/),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["duplicate keys", '"variables":{"keep":"first","keep":"second"}', "off"],
    [
      "duplicate keys",
      '"variables":{"keep":"first","keep":"second"}',
      "failed_step",
    ],
    ["unsafe integer", '"variables":{"keep":9007199254740993}', "off"],
    ["unsafe integer", '"variables":{"keep":9007199254740993}', "failed_step"],
  ])(
    "retains raw %s through the existing %s retry entry with scope %s",
    async (_label, ambiguous, scope) => {
      await show();
      const repaired = {
        ...definition.spec,
        variables: { keep: "retained" },
        jobs: [
          {
            name: "build",
            steps: [{ name: "prepare", uses: "shell" }],
            ...(scope === "off" ? {} : { retry }),
          },
        ],
      };
      const safeText = JSON.stringify(repaired);
      fireEvent.change(editor(), { target: { value: safeText } });
      expect(screen.getByLabelText("Retry scope")).toHaveValue(scope);
      const raw =
        "{ " +
        ambiguous +
        ", " +
        JSON.stringify({ ...repaired, variables: undefined }).slice(1);
      fireEvent.change(editor(), { target: { value: raw } });
      expect(screen.getByLabelText("Retry scope")).toBeDisabled();
      expect(applyRetry()).toBeDisabled();
      fireEvent.click(applyRetry());
      expect(editor()).toHaveValue(raw);
      fireEvent.click(save());
      await waitFor(() => expect(save()).toBeEnabled());
      expect(editor()).toHaveValue(raw);
      expect(validatePipelineSpec).not.toHaveBeenCalled();
      expect(savePipelineSpec).not.toHaveBeenCalled();
      fireEvent.change(editor(), { target: { value: safeText } });
      expect(screen.getByLabelText("Retry scope")).toBeEnabled();
      expect(screen.getByLabelText("Retry scope")).toHaveValue(scope);
      expect(applyRetry()).toBeEnabled();
      fireEvent.click(applyRetry());
      expect(JSON.parse(editor().value)).toEqual({
        ...repaired,
        jobs: [
          {
            ...repaired.jobs[0],
            ...(scope === "off" ? {} : { retry: { ...retry, delay: "1s" } }),
          },
        ],
      });
      expect(validatePipelineSpec).not.toHaveBeenCalled();
      expect(savePipelineSpec).not.toHaveBeenCalled();
    },
  );

  it("locks draft controls during validation without inventing a saved result", async () => {
    let reject!: (reason: unknown) => void;
    vi.mocked(validatePipelineSpec).mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByLabelText("Retry scope")).toBeDisabled();
    expect(applyRetry()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    await act(async () =>
      reject(new ApiError({ code: 503, message: "Validation unavailable" })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The server rejected this definition or could not save it.",
    );
    expect(savePipelineSpec).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Retry scope")).toBeEnabled();
  });
});
