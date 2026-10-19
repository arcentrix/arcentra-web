import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post, del } from "../client";
import {
  cancelCopilotTurn,
  createCopilotConversation,
  deleteCopilotConversation,
  getCopilotConversation,
  getCopilotRequest,
  historySelectionError,
  listCopilotConversations,
  previewCopilotHistory,
  sendCopilotTurn,
} from "./history";
import type { CopilotTurn } from "./history";
import {
  cancelCopilotPlan,
  createCopilotPlan,
  getCopilotPlan,
  listCopilotPlans,
  reviewCopilotPlan,
  validateReviewOnlyPlan,
} from "./plans";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const turn = (turnId: string, text = "Answer"): CopilotTurn => ({
  turnId,
  requestId: turnId,
  sequence: 1,
  state: "completed",
  version: 1,
  question: "Question",
  text,
  contentAvailable: true,
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  evidence: [],
  warnings: [],
});
describe("private history contracts", () => {
  it("uses project/conversation scoped encoded paths, bounded pages and privacy-redacted errors", () => {
    const signal = new AbortController().signal;
    listCopilotConversations("p/a", "next", signal);
    getCopilotConversation("p/a", "c/b", 20, signal);
    getCopilotRequest("p/a", "c/b", "request/c", signal);
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/projects/p%2Fa/copilot/conversations",
      {
        params: { limit: 20, cursor: "next" },
        signal,
        silence: true,
        redactErrors: true,
      },
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/projects/p%2Fa/copilot/conversations/c%2Fb",
      {
        params: { limit: 20, after: 20 },
        signal,
        silence: true,
        redactErrors: true,
      },
    );
    expect(get).toHaveBeenNthCalledWith(
      3,
      "/projects/p%2Fa/copilot/conversations/c%2Fb/requests/request%2Fc",
      { signal, silence: true, redactErrors: true },
    );
  });
  it("requires explicit retention creation, CAS deletion and exact selected history order", () => {
    createCopilotConversation("p", {
      runId: "r",
      requestId: "create",
      acknowledgeRetention: true,
    });
    deleteCopilotConversation("p", "c", 3);
    const input = {
      requestId: "request",
      runId: "r",
      providerId: "provider",
      model: "model",
      question: "why",
      context: { stepRunIds: [], artifactIds: [], fromLine: 0 },
      historyTurnIds: ["second", "first"],
      shareSelectedContext: false,
    };
    previewCopilotHistory("p", "c", input);
    sendCopilotTurn("p", "c", {
      ...input,
      contextDigest: "preview",
      shareSelectedContext: true,
    });
    cancelCopilotTurn("p", "c", "request");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/projects/p/copilot/conversations",
      { runId: "r", requestId: "create", acknowledgeRetention: true },
      expect.objectContaining({ redactErrors: true }),
    );
    expect(del).toHaveBeenCalledWith(
      "/projects/p/copilot/conversations/c",
      expect.objectContaining({
        data: { expectedVersion: 3 },
        redactErrors: true,
      }),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/projects/p/copilot/conversations/c/preview",
      input,
      expect.objectContaining({ timeout: 20000 }),
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/projects/p/copilot/conversations/c/turns",
      { ...input, contextDigest: "preview", shareSelectedContext: true },
      expect.objectContaining({ timeout: 55000 }),
    );
    expect(post).toHaveBeenNthCalledWith(
      4,
      "/projects/p/copilot/conversations/c/requests/request/cancel",
      {},
      expect.objectContaining({ redactErrors: true }),
    );
  });
  it("rejects duplicate, foreign, incomplete, unavailable, expired and oversized selected pairs without truncation", () => {
    const turns = Array.from({ length: 7 }, (_, index) => turn(String(index)));
    expect(historySelectionError(turns, ["1", "0"])).toBeNull();
    for (const ids of [
      ["1", "1"],
      ["foreign"],
      turns.map((item) => item.turnId),
    ])
      expect(historySelectionError(turns, ids)).not.toBeNull();
    for (const changed of [
      { state: "outcome_unknown" },
      { contentAvailable: false },
      { expiresAt: "2000-01-01T00:00:00Z" },
      { contentAvailableUntil: "2000-01-01T00:00:00Z" },
      { contentAvailableUntil: "invalid" },
      { text: "中".repeat(3000) },
    ])
      expect(
        historySelectionError(
          [{ ...turn("1"), ...changed } as CopilotTurn],
          ["1"],
        ),
      ).not.toBeNull();
  });
});
describe("review-only plan contracts", () => {
  it("only calls proposal/read/review/cancel APIs and binds human review to digest and version", () => {
    const plan = { planId: "plan/id", version: 2, planDigest: "digest" };
    createCopilotPlan("p", "c", {
      requestId: "request",
      turnId: "turn",
      kind: "new_run_review",
    });
    listCopilotPlans("p", "c", 20);
    getCopilotPlan("p", "c", plan.planId);
    reviewCopilotPlan("p", "c", plan);
    cancelCopilotPlan("p", "c", plan);
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/projects/p/copilot/conversations/c/plans/plan%2Fid/review",
      {
        expectedVersion: 2,
        planDigest: "digest",
        acknowledgeNotExecuted: true,
      },
      expect.objectContaining({ redactErrors: true }),
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/projects/p/copilot/conversations/c/plans/plan%2Fid/cancel",
      { expectedVersion: 2 },
      expect.objectContaining({ redactErrors: true }),
    );
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/projects/p/copilot/conversations/c/plans",
      expect.objectContaining({ params: { after: 20, limit: 20 } }),
    );
  });
  it("fails closed for forged execution receipts or unknown plan kinds", () => {
    for (const value of [
      { executionEnabled: true },
      { executionStatus: "Succeeded" },
      { kind: "run_shell" },
      { state: "executed" },
    ])
      expect(() =>
        validateReviewOnlyPlan({
          planId: "plan",
          kind: "new_run_review",
          state: "proposed",
          executionEnabled: false,
          executionStatus: "Not executed",
          ...value,
        } as never),
      ).toThrow();
  });
});
