import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RetryPolicyEditor, setJobRetry } from "./retry-policy-editor";
import { normalizeStep } from "@/api/pipeline";
import type { RetryPolicy } from "@/api/pipeline/types";

const spec = JSON.stringify({
  namespace: "example",
  jobs: [{ name: "build", steps: [{ name: "test", uses: "shell" }] }],
});
const wholeJob: RetryPolicy = {
  mode: "whole_job",
  maxAttempts: 2,
  allowedExitCodes: [9],
  idempotent: true,
};
const containerSpec = (job: Record<string, unknown> = {}) =>
  JSON.stringify({
    ...JSON.parse(spec),
    runtime: { type: "containerd-offline-v1" },
    jobs: [{ ...JSON.parse(spec).jobs[0], ...job }],
  });
const applyButton = () =>
  screen.getByRole("button", { name: "Apply retry policy to draft" });

describe("explicit retry configuration", () => {
  it("defaults off and requires idempotency plus exit allowlist before editing the draft", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor value={spec} onChange={update} disabled={false} />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("off");
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "whole_job" },
    });
    expect(screen.getByRole("note")).toHaveTextContent(
      "Repeats earlier successful steps",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply retry policy to draft" }),
    );
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm idempotency");
    fireEvent.change(screen.getByLabelText("Retry exit codes"), {
      target: { value: "9, 75" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply retry policy to draft" }),
    );
    expect(JSON.parse(update.mock.calls[0][0]).jobs[0].retry).toEqual({
      mode: "whole_job",
      maxAttempts: 2,
      delay: "1s",
      allowedExitCodes: [9, 75],
      idempotent: true,
    });
  });
  it("removes retry rather than introducing an implicit default", () => {
    const configured = setJobRetry(spec, 0, {
      mode: "failed_step",
      maxAttempts: 2,
      allowedExitCodes: [9],
      idempotent: true,
    });
    expect(
      JSON.parse(setJobRetry(configured, 0)).jobs[0].retry,
    ).toBeUndefined();
    expect(JSON.parse(configured).jobs[0].steps).toHaveLength(1);
  });
  it("honors read-only permission", () => {
    const update = vi.fn();
    render(<RetryPolicyEditor value={spec} onChange={update} disabled />);
    expect(screen.getByLabelText("Retry scope")).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply retry policy to draft" }),
    );
    expect(update).not.toHaveBeenCalled();
  });
  it("preserves attempt identity for history and logs", () => {
    expect(
      normalizeStep({
        stepRunId: "attempt-2",
        attempt: 2,
        retryMode: "failed_step",
        previousStepRunId: "attempt-1",
        status: 4,
      }),
    ).toMatchObject({
      attempt: 2,
      retryMode: "failed_step",
      previousStepRunId: "attempt-1",
      status: "success",
    });
  });
  it("keeps legacy and malformed definitions editable", () => {
    const update = vi.fn();
    const legacy = JSON.stringify({
      jobs: [{ name: "old", retry: { maxAttempts: 3, delay: "1s" } }],
    });
    const view = render(
      <RetryPolicyEditor value={legacy} onChange={update} disabled={false} />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("unsupported");
    expect(screen.getByRole("alert")).toHaveTextContent("Unsupported authored");
    expect(update).not.toHaveBeenCalled();
    view.rerender(
      <RetryPolicyEditor
        value={JSON.stringify({ jobs: [null, 7] })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Apply retry policy to draft" }),
    ).toBeDisabled();
    view.rerender(
      <RetryPolicyEditor value="{" onChange={update} disabled={false} />,
    );
    expect(
      screen.getByRole("button", { name: "Apply retry policy to draft" }),
    ).toBeDisabled();
  });
});

describe("offline container retry scope", () => {
  it("defaults off, allows both scopes, and explains the independent operator opt-ins", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor
        value={containerSpec()}
        onChange={update}
        disabled={false}
      />,
    );
    fireEvent.click(
      screen.getByText("Retry policy · off unless explicitly configured"),
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("off");
    expect(screen.getByRole("option", { name: "Off" })).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Failed step only" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Whole job steps" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/must enable allowWholeJobRetry/),
    ).toHaveTextContent(
      "Each defaults off; editing this draft does not enable it",
    );
    expect(
      screen.getByText(/must enable allowWholeJobRetry/),
    ).toHaveTextContent("allowFailedStepRetry on both Control and Agent");
    expect(
      screen.getByText(/must enable allowWholeJobRetry/),
    ).toHaveTextContent("separately accepted backend");
    expect(screen.getByText(/No automatic resume after restart/)).toBeVisible();
    expect(update).not.toHaveBeenCalled();
  });

  it("explains fresh runtime state and pinned inputs without dropping idempotency", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor
        value={containerSpec()}
        onChange={update}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "whole_job" },
    });
    expect(screen.getByRole("note")).toHaveTextContent(
      "fresh session, rootfs, and workspace, with the pinned source SHA and input artifacts",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "External side effects are not rolled back",
    );
    expect(screen.getByRole("note")).not.toHaveTextContent(
      "Reuses the current workspace",
    );
    fireEvent.click(applyButton());
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm idempotency");
    fireEvent.change(screen.getByLabelText("Retry exit codes"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(applyButton());
    const updated = JSON.parse(update.mock.calls[0][0]);
    expect(updated.jobs[0].retry).toEqual({ ...wholeJob, delay: "1s" });
    expect(updated.runtime).toEqual({ type: "containerd-offline-v1" });
  });

  it("retains an authored failed-step policy until an explicit edit and allows Off to remove it", () => {
    const update = vi.fn();
    const value = containerSpec({
      retry: { ...wholeJob, mode: "failed_step" },
    });
    render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
    expect(screen.getByRole("note")).toHaveTextContent(
      "one continuously live session",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "Earlier successful steps are preserved and are not run again",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "partial writes also remain",
    );
    expect(screen.getByRole("note")).toHaveTextContent("No rollback");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Shell-local variables and process state are not preserved",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "any live or zombie descendants, including those from earlier steps, refuse retry",
    );
    expect(applyButton()).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "off" },
    });
    expect(applyButton()).toBeEnabled();
    fireEvent.click(applyButton());
    expect(JSON.parse(update.mock.calls[0][0])).toEqual(
      JSON.parse(containerSpec()),
    );
  });

  it("blocks retry on an approval-bearing job, preserves the mode, and permits removal", () => {
    const update = vi.fn();
    const approval = { approvers: ["reviewer"] };
    const value = containerSpec({ retry: wholeJob, approval });
    render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("whole_job");
    expect(
      screen.getByRole("option", { name: "Whole job steps" }),
    ).toBeDisabled();
    expect(screen.getByText(/Container retry with approval/)).toHaveTextContent(
      "requires the exact manual builtin:retry-approval gate",
    );
    expect(applyButton()).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "off" },
    });
    fireEvent.click(applyButton());
    expect(JSON.parse(update.mock.calls[0][0])).toEqual(
      JSON.parse(containerSpec({ approval })),
    );
  });

  it("reevaluates runtime and approval changes without silently changing authored mode", () => {
    const update = vi.fn();
    const value = setJobRetry(spec, 0, { ...wholeJob, mode: "failed_step" });
    const view = render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(applyButton()).toBeEnabled();
    view.rerender(
      <RetryPolicyEditor
        value={containerSpec({ retry: { ...wholeJob, mode: "failed_step" } })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
    expect(applyButton()).toBeEnabled();
    view.rerender(
      <RetryPolicyEditor
        value={containerSpec({ retry: wholeJob, approval: {} })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("whole_job");
    expect(applyButton()).toBeDisabled();
    view.rerender(
      <RetryPolicyEditor
        value={containerSpec({ retry: wholeJob, approval: null })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(applyButton()).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("enforces the scope in setJobRetry and still removes invalid legacy policies", () => {
    expect(
      JSON.parse(
        setJobRetry(containerSpec(), 0, { ...wholeJob, mode: "failed_step" }),
      ).jobs[0].retry.mode,
    ).toBe("failed_step");
    expect(() =>
      setJobRetry(containerSpec(), 0, {
        ...wholeJob,
        mode: "off",
      } as unknown as RetryPolicy),
    ).toThrow("Unsupported authored retry policy");
    for (const approval of [{}, { approved: true }, false]) {
      const value = containerSpec({ approval, retry: wholeJob });
      expect(() => setJobRetry(value, 0, wholeJob)).toThrow(
        "Container retry with approval requires",
      );
      expect(JSON.parse(setJobRetry(value, 0)).jobs[0]).toEqual({
        ...JSON.parse(spec).jobs[0],
        approval,
      });
    }
    expect(
      JSON.parse(setJobRetry(containerSpec({ approval: null }), 0, wholeJob))
        .jobs[0].retry,
    ).toEqual(wholeJob);
  });

  it("uses the selected job's approval and restores its own authored mode on return", () => {
    const update = vi.fn();
    const value = JSON.stringify({
      ...JSON.parse(containerSpec()),
      jobs: [
        { name: "reviewed", retry: wholeJob, approval: {} },
        { name: "build", dependsOn: ["reviewed"] },
      ],
    });
    render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(applyButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Retry job"), {
      target: { value: "1" },
    });
    expect(screen.getByLabelText("Retry scope")).toHaveValue("off");
    expect(
      screen.getByRole("option", { name: "Whole job steps" }),
    ).toBeEnabled();
    expect(JSON.parse(setJobRetry(value, 1, wholeJob)).jobs[1].retry).toEqual(
      wholeJob,
    );
    fireEvent.change(screen.getByLabelText("Retry job"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("Retry scope")).toHaveValue("whole_job");
    expect(applyButton()).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, { type: "local" }, { type: "baremetal" }])(
    "preserves both local retry modes with runtime %j, including approval jobs",
    (runtime) => {
      const value = JSON.stringify({
        ...JSON.parse(spec),
        runtime,
        jobs: [{ ...JSON.parse(spec).jobs[0], approval: {} }],
      });
      for (const mode of ["failed_step", "whole_job"] as const) {
        const configured = setJobRetry(value, 0, { ...wholeJob, mode });
        expect(JSON.parse(configured).jobs[0].retry.mode).toBe(mode);
      }
      render(
        <RetryPolicyEditor
          value={setJobRetry(value, 0, wholeJob)}
          onChange={vi.fn()}
          disabled={false}
        />,
      );
      expect(screen.getByRole("note")).toHaveTextContent(
        "Reuses the current workspace and source snapshot",
      );
      expect(
        screen.getByRole("option", { name: "Failed step only" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("option", { name: "Whole job steps" }),
      ).toBeEnabled();
    },
  );

  it.each([null, [], false, { jobs: null }, { jobs: [null, []] }])(
    "handles malformed root/jobs safely: %j",
    (definition) => {
      const value = JSON.stringify(definition);
      render(
        <RetryPolicyEditor value={value} onChange={vi.fn()} disabled={false} />,
      );
      expect(applyButton()).toBeDisabled();
      expect(() => setJobRetry(value, 0, wholeJob)).toThrow(
        "Select an existing job",
      );
    },
  );

  it.each([null, [], "containerd-offline-v1", { type: null }])(
    "reads only an object root runtime.type safely: %j",
    (runtime) => {
      render(
        <RetryPolicyEditor
          value={JSON.stringify({ ...JSON.parse(spec), runtime })}
          onChange={vi.fn()}
          disabled={false}
        />,
      );
      expect(
        screen.queryByText(/must enable allowWholeJobRetry/),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps invalid container policies read-only, including their Off removal", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor
        value={containerSpec({ retry: wholeJob, approval: {} })}
        onChange={update}
        disabled
      />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("whole_job");
    expect(screen.getByLabelText("Retry scope")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(applyButton()).toBeDisabled();
    fireEvent.click(applyButton());
    expect(update).not.toHaveBeenCalled();
  });
});

it("allows only the exact operator-controlled durable retry approval marker", () => {
  const retry = {
    mode: "whole_job" as const,
    maxAttempts: 2,
    idempotent: true,
    allowedExitCodes: [23],
    delay: "1s",
  };
  const gate = {
    required: true,
    type: "manual",
    plugin: "builtin:retry-approval",
    params: {},
  };
  const definition = (approval: unknown) =>
    JSON.stringify({
      runtime: { type: "containerd-offline-v1" },
      jobs: [{ name: "build", approval }],
    });
  expect(
    JSON.parse(setJobRetry(definition(gate), 0, retry)).jobs[0].retry,
  ).toEqual(retry);
  for (const approval of [
    { ...gate, required: false },
    { ...gate, type: undefined },
    { ...gate, params: { approvers: ["self"] } },
    { ...gate, approved: true },
    { ...gate, plugin: "builtin:deployment" },
  ]) {
    expect(() => setJobRetry(definition(approval), 0, retry)).toThrow(
      "requires the exact manual",
    );
  }
  expect(() =>
    setJobRetry(definition(gate), 0, { ...retry, mode: "failed_step" }),
  ).toThrow("cannot be combined with any approval gate");
});

describe("bounded live container failed-step drafts", () => {
  const retry: RetryPolicy = { ...wholeJob, mode: "failed_step" };
  const gate = {
    required: true,
    type: "manual",
    plugin: "builtin:retry-approval",
    params: {},
  };

  it("requires explicit idempotency, limits and exit allowlist before applying; never auto-applies", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor
        value={containerSpec()}
        onChange={update}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "failed_step" },
    });
    expect(
      screen.getByRole("checkbox", { name: /partial failed-command writes/ }),
    ).not.toBeChecked();
    expect(
      screen.getByText("Per-step attempts including first"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Retry exit codes")).toHaveValue("");
    fireEvent.click(applyButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm idempotency");
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Maximum attempts"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Retry exit codes"), {
      target: { value: "9, 75" },
    });
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(applyButton());
    expect(update).toHaveBeenCalledTimes(1);
    expect(JSON.parse(update.mock.calls[0][0]).jobs[0].retry).toEqual({
      mode: "failed_step",
      maxAttempts: 5,
      delay: "1s",
      allowedExitCodes: [9, 75],
      idempotent: true,
    });
    expect(
      screen.getByText(/Applying changes only the local draft/),
    ).toHaveTextContent("does not save or start a run");
  });

  it.each([
    {},
    false,
    "manual",
    { approvers: ["reviewer"] },
    gate,
    { ...gate, params: { candidates: ["self"] } },
  ])(
    "rejects every non-null approval shape for failed_step while preserving the author: %j",
    (approval) => {
      const update = vi.fn();
      const value = containerSpec({ retry, approval });
      render(
        <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
      );
      expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
      expect(
        screen.getByRole("option", { name: "Failed step only" }),
      ).toBeDisabled();
      expect(applyButton()).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "cannot be combined with any approval gate",
      );
      fireEvent.click(applyButton());
      expect(update).not.toHaveBeenCalled();
      expect(() => setJobRetry(value, 0, retry)).toThrow("any approval gate");
      fireEvent.change(screen.getByLabelText("Retry scope"), {
        target: { value: "off" },
      });
      fireEvent.click(applyButton());
      expect(JSON.parse(update.mock.calls[0][0])).toEqual(
        JSON.parse(containerSpec({ approval })),
      );
    },
  );

  it("keeps the exact whole-job approval gate available without authorizing failed-step retry", () => {
    const update = vi.fn();
    const value = containerSpec({ retry, approval: gate });
    render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(
      screen.getByRole("option", { name: "Whole job steps" }),
    ).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "whole_job" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(applyButton());
    const changed = JSON.parse(update.mock.calls[0][0]);
    expect(changed.jobs[0].approval).toEqual(gate);
    expect(changed.jobs[0].retry.mode).toBe("whole_job");
  });

  it.each(["continueOnError", "continue_on_error"])(
    "blocks %s on any step, including an earlier one, without silently removing it",
    (field) => {
      const update = vi.fn();
      const steps = [
        { name: "prepare", uses: "shell", [field]: true },
        { name: "build", uses: "shell" },
      ];
      const value = containerSpec({ retry, steps });
      const view = render(
        <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
      );
      expect(applyButton()).toBeDisabled();
      expect(
        screen.getByRole("option", { name: "Failed step only" }),
      ).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "does not support continueOnError on any step",
      );
      expect(() => setJobRetry(value, 0, retry)).toThrow("continueOnError");
      expect(JSON.parse(setJobRetry(value, 0)).jobs[0].steps).toEqual(steps);
      view.rerender(
        <RetryPolicyEditor
          value={containerSpec({
            retry,
            steps: [{ ...steps[0], [field]: false }, steps[1]],
          })}
          onChange={update}
          disabled={false}
        />,
      );
      expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
      expect(applyButton()).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("rechecks newly added approval even if the authored retry is unchanged", () => {
    const update = vi.fn();
    const view = render(
      <RetryPolicyEditor
        value={containerSpec({ retry })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(applyButton()).toBeEnabled();
    view.rerender(
      <RetryPolicyEditor
        value={containerSpec({ retry, approval: gate })}
        onChange={update}
        disabled={false}
      />,
    );
    expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
    expect(applyButton()).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    { idempotent: false },
    { idempotent: "true" },
    { maxAttempts: 1 },
    { maxAttempts: 6 },
    { maxAttempts: 2.5 },
    { maxAttempts: "2" },
    { allowedExitCodes: [] },
    { allowedExitCodes: [0] },
    { allowedExitCodes: [126] },
    { allowedExitCodes: [9, 9] },
    { allowedExitCodes: [9.5] },
    { allowedExitCodes: ["9"] },
  ])("rejects invalid bounds in the shared setter: %j", (invalid) => {
    expect(() =>
      setJobRetry(containerSpec(), 0, { ...retry, ...invalid } as RetryPolicy),
    ).toThrow("Confirm idempotency");
  });

  it.each([
    ["Maximum attempts", "1"],
    ["Maximum attempts", "6"],
    ["Maximum attempts", "2.5"],
    ["Retry exit codes", ""],
    ["Retry exit codes", "9, 9"],
    ["Retry exit codes", "0"],
    ["Retry exit codes", "126"],
    ["Retry exit codes", "9,"],
    ["Retry exit codes", "9.5"],
    ["Retry exit codes", "oops"],
  ])(
    "shows %s=%s validation errors without fallback or draft changes",
    (label, invalid) => {
      const update = vi.fn();
      render(
        <RetryPolicyEditor
          value={containerSpec({ retry })}
          onChange={update}
          disabled={false}
        />,
      );
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: invalid },
      });
      fireEvent.click(applyButton());
      expect(screen.getByRole("alert")).toHaveTextContent("2–5 attempts");
      expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { mode: "future_mode", marker: "keep" },
    { maxAttempts: 3 },
    "failed_step",
    [],
    false,
  ])(
    "preserves unsupported authored policies visibly until an explicit edit: %j",
    (authored) => {
      const update = vi.fn();
      const value = containerSpec({ retry: authored });
      render(
        <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
      );
      expect(screen.getByLabelText("Retry scope")).toHaveValue("unsupported");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unsupported authored retry policy",
      );
      expect(applyButton()).toBeDisabled();
      expect(update).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Retry scope"), {
        target: { value: "off" },
      });
      fireEvent.click(applyButton());
      expect(JSON.parse(update.mock.calls[0][0])).toEqual(
        JSON.parse(containerSpec()),
      );
    },
  );

  it("does not carry a different job's authority or unsaved scope when switching jobs", () => {
    const update = vi.fn();
    const value = JSON.stringify({
      ...JSON.parse(containerSpec()),
      jobs: [
        { name: "plain", retry },
        { name: "approved", retry, approval: gate },
        { name: "continued", retry, steps: [{ continueOnError: true }] },
      ],
    });
    render(
      <RetryPolicyEditor value={value} onChange={update} disabled={false} />,
    );
    expect(applyButton()).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Retry scope"), {
      target: { value: "whole_job" },
    });
    for (const index of ["1", "2"]) {
      fireEvent.change(screen.getByLabelText("Retry job"), {
        target: { value: index },
      });
      expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
      expect(applyButton()).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText("Retry job"), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText("Retry scope")).toHaveValue("failed_step");
    expect(applyButton()).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("disables supported failed-step edits under read-only permission", () => {
    const update = vi.fn();
    render(
      <RetryPolicyEditor
        value={containerSpec({ retry })}
        onChange={update}
        disabled
      />,
    );
    expect(screen.getByLabelText("Retry scope")).toBeDisabled();
    expect(screen.getByLabelText("Maximum attempts")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(applyButton()).toBeDisabled();
    fireEvent.click(applyButton());
    expect(update).not.toHaveBeenCalled();
  });
});
