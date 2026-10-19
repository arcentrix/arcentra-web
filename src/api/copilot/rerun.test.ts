import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  changeCopilotRerun,
  getCopilotRerun,
  getCopilotRerunAvailability,
  getCopilotRerunEligibility,
  prepareCopilotRerun,
  validateRerunEligibility,
  validateRerunIntent,
  validateRerunReview,
} from "./rerun";
import {
  confirmedRerunFixture,
  rerunEligibilityFixture,
  rerunIntentFixture,
  rerunReviewFixture,
  rerunScope,
} from "@/components/copilot-rerun.test-fixture";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("terminal whole-job NEW-execution API", () => {
  it("accepts safe native/local repository display and an unspecified display-only source ref", () => {
    const value = rerunReviewFixture();
    value.source.ref = "";
    value.source.repository = "git://localhost/anonymous.git";
    value.definition.repository = "/tmp/verified-definition";
    expect(validateRerunReview(value, rerunScope).source.expectedCommit).toBe(
      value.source.expectedCommit,
    );
  });
  it("reads independent server availability and eligibility without mutation", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({
        available: true,
        cancelNewExecutionAvailable: false,
      })
      .mockResolvedValueOnce(rerunEligibilityFixture());
    await getCopilotRerunAvailability("project");
    await getCopilotRerunEligibility(rerunScope, "old-job");
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/projects/project/copilot/rerun-intents/availability",
      expect.objectContaining({ silence: true, redactErrors: true }),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/projects/project/copilot/rerun-intents/eligibility",
      expect.objectContaining({ params: { originalJobRunId: "old-job" } }),
    );
    expect(post).not.toHaveBeenCalled();
  });
  it("binds one deliberate prepare to the exact RequestID and snapshot", async () => {
    vi.mocked(post).mockResolvedValue(rerunIntentFixture());
    const value = await prepareCopilotRerun(
      rerunScope,
      rerunEligibilityFixture(),
      "request",
    );
    expect(value.newRunId).toBe("new-run");
    expect(post).toHaveBeenCalledWith(
      "/projects/project/copilot/rerun-intents",
      {
        requestId: "request",
        originalJobRunId: "old-job",
        snapshotDigest: value.snapshotDigest,
      },
      expect.anything(),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("confirms exact CAS bindings with explicit NEW-execution acknowledgement, never a vote", async () => {
    vi.mocked(post).mockResolvedValue(confirmedRerunFixture());
    const intent = rerunIntentFixture();
    await changeCopilotRerun(rerunScope, intent, "confirm");
    expect(post).toHaveBeenCalledWith(
      "/projects/project/copilot/rerun-intents/intent/confirm",
      {
        expectedVersion: 1,
        intentDigest: intent.intentDigest,
        reviewedRunContextDigest: intent.reviewedRunContextDigest,
        acknowledgeNewExecution: true,
      },
      expect.anything(),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("cancels only prepared requests using exact bindings and no acknowledgement or target cancel", async () => {
    const intent = rerunIntentFixture();
    vi.mocked(post).mockResolvedValue({
      ...intent,
      version: 2,
      state: "cancelled",
      cancelledAt: "2099-01-01T00:01:00Z",
      canConfirm: false,
      canCancelPrepared: false,
    });
    await changeCopilotRerun(rerunScope, intent, "cancel-prepared");
    expect(post).toHaveBeenCalledWith(
      "/projects/project/copilot/rerun-intents/intent/cancel-prepared",
      {
        expectedVersion: 1,
        intentDigest: intent.intentDigest,
        reviewedRunContextDigest: intent.reviewedRunContextDigest,
      },
      expect.anything(),
    );
  });
  it("reconciles a lost prepare by RequestID, then inspects IntentID without any POST", async () => {
    vi.mocked(get).mockResolvedValue(confirmedRerunFixture());
    await getCopilotRerun(rerunScope, { requestId: "request" });
    await getCopilotRerun(rerunScope, {
      requestId: "request",
      intentId: "intent",
    });
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/projects/project/copilot/rerun-intents/by-request/request",
      expect.anything(),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/projects/project/copilot/rerun-intents/intent",
      expect.anything(),
    );
    expect(post).not.toHaveBeenCalled();
  });
  it("accepts exact prepare replay and durable confirmed receipt after its prepare deadline", async () => {
    const value = {
      ...confirmedRerunFixture(),
      serverTime: "2099-01-02T00:00:00Z",
      reviewStatus: "expired" as const,
      review: undefined,
    };
    vi.mocked(post).mockResolvedValue(value);
    expect(
      await prepareCopilotRerun(
        rerunScope,
        rerunEligibilityFixture(),
        "request",
      ),
    ).toEqual(value);
    expect(validateRerunIntent(value, rerunScope).state).toBe("confirmed");
  });
  it("allows authorized minimal inspection but never confirms missing, changed or expired evidence", async () => {
    const minimal = {
      ...rerunIntentFixture(),
      review: undefined,
      reviewStatus: "unavailable" as const,
      canConfirm: false,
    };
    expect(validateRerunIntent(minimal, rerunScope)).toEqual(minimal);
    await expect(
      changeCopilotRerun(rerunScope, minimal, "confirm"),
    ).rejects.toThrow();
    for (const patch of [
      { review: undefined },
      { reviewStatus: "changed" },
      { serverTime: "2099-01-02T00:00:00Z" },
    ])
      expect(() =>
        validateRerunIntent(
          { ...rerunIntentFixture(), ...patch } as ReturnType<
            typeof rerunIntentFixture
          >,
          rerunScope,
        ),
      ).toThrow();
    expect(post).not.toHaveBeenCalled();
  });
  it("rejects active/successful/wrong-scope/failed-step and requester self-approval review", () => {
    for (const patch of [
      { originalRunId: "another" },
      { originalJobRunId: "another" },
      { originalRunStatus: 2 },
      { originalRunStatus: 3 },
      { originalJobStatus: 4 },
      { retryMode: "failed_step" },
      { snapshotDigest: "" },
      { definition: { ...rerunReviewFixture().definition, revision: "main" } },
      { source: { ...rerunReviewFixture().source, expectedCommit: "main" } },
      { policy: { ...rerunReviewFixture().policy, candidates: ["requester"] } },
      {
        retryBudget: { ...rerunReviewFixture().retryBudget, maxAttempts: 999 },
      },
    ])
      expect(() =>
        validateRerunReview(
          { ...rerunReviewFixture(), ...patch } as ReturnType<
            typeof rerunReviewFixture
          >,
          rerunScope,
          "old-job",
        ),
      ).toThrow();
  });
  it("requires eligible review and fails closed for legacy/unsupported/omitted snapshot", async () => {
    expect(
      validateRerunEligibility(
        {
          available: true,
          eligible: false,
          reasonCode: "unsupported",
          serverTime: "2099-01-01T00:00:00Z",
        },
        rerunScope,
        "old-job",
      ).eligible,
    ).toBe(false);
    expect(() =>
      validateRerunEligibility(
        { ...rerunEligibilityFixture(), review: undefined },
        rerunScope,
        "old-job",
      ),
    ).toThrow();
    await expect(
      prepareCopilotRerun(
        rerunScope,
        {
          ...rerunEligibilityFixture(),
          eligible: false,
          reasonCode: "unsupported",
        },
        "request",
      ),
    ).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
  it("rejects changed target, old run reuse, mismatched recovery, malformed receipts and unknown states", async () => {
    for (const patch of [
      { newRunId: "old-run" },
      { newJobRunId: "old-job" },
      { requestId: "another" },
      { intentId: "another" },
      { confirmedAt: undefined },
      { confirmedAt: "2099-01-01T01:00:00Z" },
      { version: 3 },
      { state: "running" },
      { reviewedRunContextDigest: "bad" },
    ]) {
      vi.mocked(post).mockResolvedValue({
        ...confirmedRerunFixture(),
        ...patch,
      });
      await expect(
        changeCopilotRerun(rerunScope, rerunIntentFixture(), "confirm"),
      ).rejects.toThrow();
    }
  });
  it("rejects mixed lifecycle timestamps and terminal mutation capabilities", () => {
    const cancelled = {
      ...rerunIntentFixture(),
      state: "cancelled" as const,
      version: 2,
      cancelledAt: "2099-01-01T00:01:00Z",
      canConfirm: false,
      canCancelPrepared: false,
    };
    const expired = {
      ...rerunIntentFixture(),
      state: "expired" as const,
      reviewStatus: "expired" as const,
      review: undefined,
      canConfirm: false,
      canCancelPrepared: false,
    };
    expect(validateRerunIntent(expired, rerunScope).state).toBe("expired");
    for (const value of [
      { ...cancelled, confirmedAt: "2099-01-01T00:01:00Z" },
      { ...confirmedRerunFixture(), cancelledAt: "2099-01-01T00:01:00Z" },
      { ...rerunIntentFixture(), confirmedAt: "2099-01-01T00:01:00Z" },
      { ...rerunIntentFixture(), cancelledAt: "2099-01-01T00:01:00Z" },
      { ...expired, confirmedAt: "2099-01-01T00:01:00Z" },
      { ...expired, cancelledAt: "2099-01-01T00:01:00Z" },
      ...[cancelled, expired, confirmedRerunFixture()].flatMap((value) => [
        { ...value, canConfirm: true },
        { ...value, canCancelPrepared: true },
      ]),
    ])
      expect(() => validateRerunIntent(value, rerunScope)).toThrow();
  });
  it("does not replay rejected writes or uncertain transport automatically", async () => {
    for (const status of [403, 409, 410, 503, "timeout"]) {
      vi.mocked(post).mockRejectedValue(new Error(String(status)));
      await expect(
        changeCopilotRerun(rerunScope, rerunIntentFixture(), "confirm"),
      ).rejects.toThrow();
    }
    expect(post).toHaveBeenCalledTimes(5);
    expect(get).not.toHaveBeenCalled();
  });
});
