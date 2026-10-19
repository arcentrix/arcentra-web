import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  changeCopilotExecution,
  getCopilotExecution,
  listCopilotExecutions,
  prepareCopilotExecution,
  validateExecutionIntent,
} from "./execution";
import type { CopilotExecutionIntent } from "./execution";
import type { CopilotPlan } from "./plans";
import { hash } from "@/components/build/retry-approval.test-fixture";
import {
  intentFixture,
  planFixture,
} from "@/components/copilot-execution.test-fixture";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("detached bound retry API", () => {
  it.each(["prepared", "submitted", "cancelled", "expired"] as const)(
    "accepts %s with complete scoped evidence",
    (state) => {
      expect(
        validateExecutionIntent(
          {
            ...intentFixture(),
            state,
            ...(state === "submitted"
              ? {
                  version: 2,
                  decisionId: "decision",
                  submittedAt: "2099-01-01T00:05:00Z",
                }
              : {}),
          },
          "project",
        ).state,
      ).toBe(state);
    },
  );
  it("rejects invalid scope, identifiers, digest, deadline, state and unbounded budget", () => {
    for (const patch of [
      { projectId: "other" },
      { version: 0 },
      { intentDigest: "approve()" },
      { intentId: "https://evil" },
      { state: "execute" },
      { expiresAt: "bad" },
    ])
      expect(() =>
        validateExecutionIntent(
          { ...intentFixture(), ...patch } as CopilotExecutionIntent,
          "project",
        ),
      ).toThrow();
    const value = intentFixture();
    value.retryReview!.evidence.retryPlan.policy.max_attempts = 999;
    expect(() => validateExecutionIntent(value, "project")).toThrow();
  });
  it("prepares only reviewed retry proposals with detached acknowledgement and exact CAS", async () => {
    vi.mocked(post).mockResolvedValue(intentFixture());
    await prepareCopilotExecution(
      "project",
      "conversation",
      planFixture(),
      "request",
    );
    expect(post).toHaveBeenCalledWith(
      "/projects/project/copilot/conversations/conversation/plans/plan/execution-intents",
      {
        requestId: "request",
        expectedVersion: 2,
        planDigest: hash(),
        acknowledgeDetachedIntent: true,
      },
      expect.anything(),
    );
    for (const patch of [
      { state: "proposed" },
      { kind: "new_run_review" },
      { eligible: false },
    ])
      await expect(
        prepareCopilotExecution(
          "project",
          "conversation",
          { ...planFixture(), ...patch } as CopilotPlan,
          "request",
        ),
      ).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("submits exact version and digest with permanent acknowledgement only for confirm", async () => {
    vi.mocked(post).mockResolvedValue({
      ...intentFixture(),
      state: "submitted",
      submittedAt: "2099-01-01T00:05:00Z",
      decisionId: "decision",
      version: 2,
    });
    await changeCopilotExecution("project", intentFixture(), "confirm");
    expect(post).toHaveBeenCalledWith(
      "/projects/project/copilot/execution-intents/intent/confirm",
      {
        expectedVersion: 1,
        intentDigest: hash("b"),
        acknowledgePermanentApproval: true,
      },
      expect.anything(),
    );
    vi.mocked(post).mockResolvedValue({
      ...intentFixture(),
      state: "cancelled",
      version: 2,
    });
    await changeCopilotExecution("project", intentFixture(), "cancel");
    expect(post).toHaveBeenLastCalledWith(
      "/projects/project/copilot/execution-intents/intent/cancel",
      { expectedVersion: 1, intentDigest: hash("b") },
      expect.anything(),
    );
  });
  it("reads only and rejects mismatched ids and oversized pages", async () => {
    vi.mocked(get).mockResolvedValue({
      intents: [intentFixture()],
      nextAfter: 20,
    });
    await listCopilotExecutions("project", 10);
    expect(get).toHaveBeenCalledWith(
      "/projects/project/copilot/execution-intents",
      expect.objectContaining({ params: { after: 10, limit: 20 } }),
    );
    vi.mocked(get).mockResolvedValue({ ...intentFixture(), intentId: "other" });
    await expect(getCopilotExecution("project", "intent")).rejects.toThrow();
    vi.mocked(get).mockResolvedValue({
      intents: Array(21).fill(intentFixture()),
    });
    await expect(listCopilotExecutions("project")).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
  it("rejects changed binding and ambiguous mutation outcomes without another POST", async () => {
    for (const patch of [
      { state: "prepared" },
      {
        state: "submitted",
        submittedAt: "2099-01-01T00:05:00Z",
        decisionId: "decision",
        intentDigest: hash("c"),
      },
      {
        state: "submitted",
        submittedAt: "2099-01-01T00:05:00Z",
        decisionId: "decision",
        sourcePlanId: "other",
      },
    ]) {
      vi.mocked(post).mockResolvedValue({ ...intentFixture(), ...patch });
      await expect(
        changeCopilotExecution("project", intentFixture(), "confirm"),
      ).rejects.toThrow();
    }
    expect(post).toHaveBeenCalledTimes(3);
  });
  it("permits metadata inspection and cancellation without evidence but never confirmation", async () => {
    const value = { ...intentFixture(), retryReview: undefined };
    expect(validateExecutionIntent(value, "project")).toEqual(value);
    await expect(
      changeCopilotExecution("project", value, "confirm"),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    vi.mocked(post).mockResolvedValue({
      ...value,
      state: "cancelled",
      version: 2,
    });
    await changeCopilotExecution("project", value, "cancel");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("requires a durable submitted receipt and exact prepared-to-submitted version increment", async () => {
    const submitted: CopilotExecutionIntent = {
      ...intentFixture(),
      state: "submitted",
      version: 2,
      decisionId: "decision",
      submittedAt: "2099-01-01T00:05:00Z",
    };
    for (const patch of [
      { decisionId: undefined },
      { decisionId: "" },
      { submittedAt: undefined },
      { submittedAt: "invalid" },
      { submittedAt: "2098-01-01T00:00:00Z" },
      { submittedAt: "2099-01-01T02:00:00Z" },
      { version: 1 },
    ]) {
      expect(() =>
        validateExecutionIntent({ ...submitted, ...patch }, "project"),
      ).toThrow();
      vi.mocked(post).mockResolvedValue({ ...submitted, ...patch });
      await expect(
        changeCopilotExecution("project", intentFixture(), "confirm"),
      ).rejects.toThrow();
    }
    vi.mocked(post).mockResolvedValue({ ...submitted, version: 3 });
    await expect(
      changeCopilotExecution("project", intentFixture(), "confirm"),
    ).rejects.toThrow();
    vi.mocked(post).mockResolvedValue(submitted);
    expect(
      await changeCopilotExecution("project", intentFixture(), "confirm"),
    ).toEqual(submitted);
  });
});
