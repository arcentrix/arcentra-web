import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "@/api/client";
import { RunApprovals } from "./run-approvals";
import { validateRetryApproval } from "./retry-approval-review";
import { retryFixture, retryScope } from "./retry-approval.test-fixture";
vi.mock("@/api/client", () => ({ get: vi.fn(), post: vi.fn() }));
describe.each([false, true])(
  "exact retry dialog failedStep=%s",
  (failedStep) => {
    let fixture: ReturnType<typeof retryFixture>;
    function expireReviewFixture() {
      const now = Date.now();
      fixture.evidence.createdAtUnixMilli = now - 3_600_001;
      fixture.evidence.expiresAtUnixMilli = now - 1;
      fixture.approval.expiresAt = new Date(
        fixture.evidence.expiresAtUnixMilli,
      ).toISOString();
    }
    function read(url: string) {
      if (url === "/approvals/") return [fixture.approval];
      if (url === "/approvals/approval")
        return structuredClone(fixture.approval);
      if (url === "/pipelines/pipeline")
        return { pipelineId: "pipeline", projectId: "project" };
      if (url === "/pipelines/pipeline/runs/run") return { ...fixture.run };
      throw new Error(`Unexpected request ${url}`);
    }
    beforeEach(() => {
      fixture = retryFixture(failedStep);
      vi.mocked(get).mockImplementation(async (url) => read(url) as never);
      vi.mocked(post).mockResolvedValue({
        ...fixture.approval,
        status: 1,
        approvedCount: 1,
      } as never);
    });
    afterEach(() => {
      cleanup();
      vi.resetAllMocks();
    });
    function show() {
      return render(
        <MemoryRouter>
          <RunApprovals {...retryScope} />
        </MemoryRouter>,
      );
    }
    async function open() {
      fireEvent.click(
        await screen.findByRole("button", { name: "Review approval approval" }),
      );
      await screen.findByText(fixture.evidence.inputs.sourceCommit);
      await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
    }
    it("shows the exact source, all inputs and entire attempt budget before an authenticated reason-only vote", async () => {
      show();
      await open();
      expect(
        screen.getByText(
          failedStep
            ? "2 total attempts, including the first for each logical step"
            : "2 total attempts, including the first",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/producer \/ producer-step/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Approve retry plan" }),
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.change(screen.getByLabelText("Decision reason (optional)"), {
        target: { value: "Reviewed exact inputs" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      expect(post).toHaveBeenCalledWith(
        "/approvals/approval/approve",
        { reason: "Reviewed exact inputs" },
        { silence: true },
      );
      expect(
        vi
          .mocked(get)
          .mock.calls.filter(([url]) => url === "/approvals/approval").length,
      ).toBeGreaterThanOrEqual(2);
    });
    it("rereads evidence and refuses a changed plan without writing", async () => {
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      fixture.evidence.retryPlan.steps[0].definitionDigest =
        "v1:" + "f".repeat(64);
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      await screen.findByRole("alert");
      expect(post).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByRole("checkbox")).not.toBeChecked(),
      );
    });
    it("refuses revoked current eligibility on preflight", async () => {
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      fixture.approval.canApprove = false;
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      await screen.findByRole("alert");
      expect(post).not.toHaveBeenCalled();
    });
    it("keeps ambiguous decision failures visible and never retries automatically", async () => {
      vi.mocked(post).mockRejectedValue(new Error("connection lost"));
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      await screen.findByText(/no automatic decision retry/);
      expect(post).toHaveBeenCalledTimes(1);
    });
    it("prevents a double vote while preflight is in flight", async () => {
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      let finish: (() => void) | undefined;
      vi.mocked(get).mockImplementation((url) =>
        url === "/approvals/approval"
          ? new Promise((resolve) => {
              finish = () =>
                resolve(structuredClone(fixture.approval) as never);
            })
          : Promise.resolve(read(url) as never),
      );
      const button = screen.getByRole("button", { name: "Approve retry plan" });
      fireEvent.click(button);
      fireEvent.click(button);
      await act(async () => finish?.());
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    });
    it("unmount during preflight prevents voting", async () => {
      const view = show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      let finish: (() => void) | undefined;
      vi.mocked(get).mockImplementation((url) =>
        url === "/approvals/approval"
          ? new Promise((resolve) => {
              finish = () =>
                resolve(structuredClone(fixture.approval) as never);
            })
          : Promise.resolve(read(url) as never),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      view.unmount();
      await act(async () => finish?.());
      expect(post).not.toHaveBeenCalled();
    });
    it("keeps expired evidence structurally valid when the clock advances between reads", () => {
      const now = Date.now();
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValueOnce(now)
        .mockReturnValue(now + 1);
      try {
        expireReviewFixture();
        // Expired evidence must remain inspectable: invalid lifetime evidence
        // would exercise a different refusal path and hide the pinned source.
        expect(() =>
          validateRetryApproval(retryScope, fixture.approval, fixture.run),
        ).not.toThrow();
        expect(
          fixture.evidence.expiresAtUnixMilli -
            fixture.evidence.createdAtUnixMilli,
        ).toBe(3_600_000);
        expect(fixture.evidence.expiresAtUnixMilli).toBe(now - 1);
        expect(clock).toHaveBeenCalledTimes(1);
      } finally {
        clock.mockRestore();
      }
    });
    it.each(["expired", "cancelled", "wrong project"])(
      "refuses %s review",
      async (reason) => {
        if (reason === "expired") {
          expireReviewFixture();
        } else if (reason === "cancelled") fixture.run.status = "cancelled";
        else fixture.evidence.context.projectId = "other";
        show();
        fireEvent.click(
          await screen.findByRole("button", {
            name: "Review approval approval",
          }),
        );
        if (reason === "wrong project") await screen.findByRole("alert");
        else await screen.findByText(fixture.evidence.inputs.sourceCommit);
        expect(
          screen.getByRole("button", { name: "Approve retry plan" }),
        ).toBeDisabled();
        expect(post).not.toHaveBeenCalled();
      },
    );

    it.each(["kind", "source", "producer", "attempt", "step-order"])(
      "refuses substituted %s on preflight",
      async (field) => {
        show();
        await open();
        fireEvent.click(screen.getByRole("checkbox"));
        if (field === "kind")
          Object.assign(fixture.evidence, { kind: "future_retry" });
        if (field === "source")
          fixture.evidence.inputs.sourceCommit = "f".repeat(40);
        if (field === "producer")
          fixture.evidence.artifacts[0].producerStepRunId = "other-producer";
        if (field === "attempt")
          fixture.evidence.retryPlan.steps[0].attemptRunIds[1] = "substituted";
        if (field === "step-order")
          fixture.evidence.retryPlan.steps[0].stepIndex = 1;
        fireEvent.click(
          screen.getByRole("button", { name: "Approve retry plan" }),
        );
        await screen.findByRole("alert");
        expect(post).not.toHaveBeenCalled();
      },
    );
    it("refuses a decision reply for the other retry kind", async () => {
      vi.mocked(post).mockResolvedValue({
        ...fixture.approval,
        bindingKind: failedStep ? "retry_whole_job_v1" : "retry_failed_step_v1",
      } as never);
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(
        screen.getByRole("button", { name: "Approve retry plan" }),
      );
      await screen.findByText(/decision response did not match/);
      expect(post).toHaveBeenCalledTimes(1);
    });
    it("closing an unsubmitted review sends nothing", async () => {
      show();
      await open();
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Close review" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    });
  },
);
