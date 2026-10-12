import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RetryPolicyEditor, setJobRetry } from "./retry-policy-editor";
import { normalizeStep } from "@/api/pipeline";

const spec = JSON.stringify({
  namespace: "example",
  jobs: [{ name: "build", steps: [{ name: "test", uses: "shell" }] }],
});

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
    expect(screen.getByLabelText("Retry scope")).toHaveValue("off");
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
