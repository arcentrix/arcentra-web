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
import { CopilotConsole } from "./copilot-console";
import {
  analyzeCopilot,
  getCopilotSources,
  getCopilotStatus,
} from "@/api/copilot";
import * as api from "@/api/copilot/history";
import * as plans from "@/api/copilot/plans";
import type { CopilotConversation, CopilotTurn } from "@/api/copilot/history";
import authStore from "@/store/auth";
import userStore from "@/store/user";
vi.mock("@/api/copilot", () => ({
  analyzeCopilot: vi.fn(),
  cancelCopilot: vi.fn(),
  getCopilotSources: vi.fn(),
  getCopilotStatus: vi.fn(),
  previewCopilot: vi.fn(),
}));
vi.mock("@/api/copilot/history", async (original) => ({
  ...(await original<typeof api>()),
  createCopilotConversation: vi.fn(),
  listCopilotConversations: vi.fn(),
  getCopilotConversation: vi.fn(),
  deleteCopilotConversation: vi.fn(),
  previewCopilotHistory: vi.fn(),
  sendCopilotTurn: vi.fn(),
  getCopilotRequest: vi.fn(),
  cancelCopilotTurn: vi.fn(),
}));
vi.mock("@/api/copilot/plans", async (original) => ({
  ...(await original<typeof plans>()),
  createCopilotPlan: vi.fn(),
  listCopilotPlans: vi.fn(),
  getCopilotPlan: vi.fn(),
  reviewCopilotPlan: vi.fn(),
  cancelCopilotPlan: vi.fn(),
}));
const conversation: CopilotConversation = {
  conversationId: "conversation",
  projectId: "project",
  pipelineId: "pipeline",
  runId: "run",
  state: "active",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
};
const turn = (sequence = 1): CopilotTurn => ({
  turnId: `turn-${sequence}`,
  requestId: `request-${sequence}`,
  sequence,
  state: "completed",
  version: 1,
  question: `Private question ${sequence}`,
  text: `Private answer ${sequence} <img src=x onerror=alert(1)>`,
  evidence: [
    {
      kind: "code-artifact",
      id: "artifact",
      name: "main.go",
      bytes: 20,
      truncated: false,
    },
  ],
  warnings: [],
  contentAvailable: true,
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
});
const status = {
  configured: true,
  models: [
    { providerId: "provider", kind: "anthropic" as const, model: "model" },
    { providerId: "provider", kind: "anthropic" as const, model: "other" },
  ],
  codeContext: "registered-text-artifacts-only" as const,
  maxContextBytes: 24576,
  maxQuestionBytes: 4096,
  historyEnabled: true,
  historyAvailable: true,
  historyRetentionDays: 30,
  historyMaxSelectedTurns: 6,
  historyMaxBytes: 8192,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCopilotStatus).mockResolvedValue(status);
  vi.mocked(getCopilotSources).mockResolvedValue({
    steps: [{ stepRunId: "step", name: "Compile", status: 5 }],
    artifacts: [],
    warnings: [],
  });
  vi.mocked(api.createCopilotConversation).mockResolvedValue(conversation);
  vi.mocked(api.listCopilotConversations).mockResolvedValue({
    conversations: [conversation],
  });
  vi.mocked(api.getCopilotConversation).mockResolvedValue({
    conversation,
    turns: [turn(1), turn(2)],
  });
  vi.mocked(api.previewCopilotHistory).mockImplementation(
    async (_p, _c, input) => ({
      text: `Exact full preview ${input.historyTurnIds.join(",")}`,
      digest: "digest",
      evidence: [],
      warnings: [],
      historyTurnIds: input.historyTurnIds,
      historyBytes: 50,
    }),
  );
  vi.mocked(api.sendCopilotTurn).mockImplementation(async (_p, _c, input) => ({
    ...turn(3),
    requestId: input.requestId,
    question: input.question,
  }));
  vi.mocked(api.cancelCopilotTurn).mockResolvedValue({
    ...turn(3),
    state: "cancelled",
    contentAvailable: false,
  });
  vi.mocked(api.deleteCopilotConversation).mockResolvedValue({ deleted: true });
});
afterEach(() => {
  cleanup();
  userStore.clearUserinfo();
  authStore.clearTokens();
});
async function load() {
  fireEvent.change(screen.getByLabelText("Project ID"), {
    target: { value: "project" },
  });
  fireEvent.change(screen.getByLabelText("Run ID"), {
    target: { value: "run" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load context choices" }));
  await screen.findByLabelText(/Compile/);
}
async function open() {
  await load();
  fireEvent.click(
    screen.getByRole("button", { name: "Load private conversations" }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Open private conversation conversation",
    }),
  );
  await screen.findByRole("article", { name: "Saved turn 1" });
}
async function preview() {
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Follow up" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Preview redacted context" }),
  );
  await screen.findByRole("region", { name: "Redacted context preview" });
}
describe("private Copilot history", () => {
  it("keeps exact explicit labels stable for every populated Copilot select", async () => {
    vi.mocked(getCopilotStatus).mockResolvedValue({
      ...status,
      sourceContextEnabled: true,
      maxSourceFiles: 3,
    });
    vi.mocked(getCopilotSources).mockResolvedValue({
      steps: [{ stepRunId: "step", name: "Compile", status: 5 }],
      artifacts: [],
      warnings: [],
      sourceJobs: ["job-1", "job-2"].map((jobRunId) => ({
        jobRunId,
        name: jobRunId,
        status: 5,
        available: true,
        reason: "",
        provenanceState: "reported" as const,
      })),
    });
    render(<CopilotConsole />);
    await open();
    fireEvent.change(screen.getByLabelText("Saved turn for proposal"), {
      target: { value: "turn-1" },
    });
    fireEvent.change(screen.getByLabelText("Proposal kind"), {
      target: { value: "code_patch" },
    });
    const choices = [
      ["Configured model", ["1", "0"]],
      ["Source job", ["job-1", "job-2"]],
      ["Saved turn for proposal", ["turn-2", "turn-1"]],
      ["Proposal kind", ["deployment_review", "code_patch"]],
      ["Previously selected patch base", ["0", "", "0"]],
    ] as const;
    for (const [name, values] of choices) {
      let select = screen.getByRole("combobox", { name });
      // Playwright's exact label engine includes all nested option text unless
      // the control has an explicit label. Testing Library alone omits it.
      expect(select.closest("label")?.textContent?.trim()).not.toBe(name);
      expect(select).toHaveAttribute("aria-label", name);
      for (const value of values) {
        fireEvent.change(screen.getByLabelText(name, { exact: true }), {
          target: { value },
        });
        select = screen.getByLabelText(name, { exact: true });
        expect(select).toHaveValue(value);
        expect(select).toHaveAttribute("aria-label", name);
      }
    }
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
    expect(plans.createCopilotPlan).not.toHaveBeenCalled();
    for (const path of ["src/first.go", "src/second.go"]) {
      fireEvent.change(screen.getByLabelText("Repository-relative path"), {
        target: { value: path },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add source file" }));
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Remove src/first.go from job-2" }),
    );
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    expect(api.previewCopilotHistory).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        historyTurnIds: ["turn-1"],
        context: {
          stepRunIds: [],
          artifactIds: [],
          fromLine: 0,
          sourceFiles: [{ jobRunId: "job-2", path: "src/second.go" }],
        },
      }),
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("article", { name: "Saved turn 3" });
    expect(api.sendCopilotTurn).toHaveBeenCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        historyTurnIds: ["turn-1"],
        context: {
          stepRunIds: [],
          artifactIds: [],
          fromLine: 0,
          sourceFiles: [{ jobRunId: "job-2", path: "src/second.go" }],
        },
        shareSelectedContext: true,
      }),
      expect.any(AbortSignal),
    );
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("has no automatic create/send and requires visible retention acknowledgement", async () => {
    render(<CopilotConsole />);
    await load();
    expect(api.createCopilotConversation).not.toHaveBeenCalled();
    expect(screen.getByText(/30 days from each message/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create private conversation · 30 days",
      }),
    );
    await screen.findByLabelText("Fixed conversation scope");
    expect(api.createCopilotConversation).toHaveBeenCalledWith(
      "project",
      expect.objectContaining({ runId: "run", acknowledgeRetention: true }),
      expect.any(AbortSignal),
    );
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("pages conversations, repeats open and refresh, and keeps or deletes only after explicit choices", async () => {
    const other = { ...conversation, conversationId: "other-conversation" };
    vi.mocked(api.listCopilotConversations)
      .mockResolvedValueOnce({
        conversations: [conversation],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({ conversations: [other] });
    render(<CopilotConsole />);
    await load();
    fireEvent.click(
      screen.getByRole("button", { name: "Load private conversations" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "More conversations" }),
    );
    await screen.findByRole("button", {
      name: "Open private conversation other-conversation",
    });
    expect(api.listCopilotConversations).toHaveBeenLastCalledWith(
      "project",
      "next",
      expect.any(AbortSignal),
    );
    const openCurrent = async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "Open private conversation conversation",
        }),
      );
      await screen.findByRole("article", { name: "Saved turn 1" });
    };
    await openCurrent();
    for (let count = 2; count <= 3; count++) {
      fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
      await preview();
      fireEvent.click(screen.getByLabelText(/Send this question/));
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh private history" }),
      );
      await screen.findByRole("article", { name: "Saved turn 1" });
      expect(api.getCopilotConversation).toHaveBeenCalledTimes(count);
      expect(
        screen.getByLabelText("Include turn 1 in next preview"),
      ).not.toBeChecked();
      expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
      expect(
        screen.queryByRole("region", { name: "Redacted context preview" }),
      ).not.toBeInTheDocument();
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Use ephemeral analysis" }),
    );
    expect(
      screen.queryByRole("article", { name: "Saved turn 1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Question")).toHaveValue("");
    fireEvent.click(
      screen.getByRole("button", { name: "Load private conversations" }),
    );
    await screen.findByRole("button", {
      name: "Open private conversation conversation",
    });
    await openCurrent();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep conversation" }));
    expect(api.deleteCopilotConversation).not.toHaveBeenCalled();
    expect(screen.getByRole("article", { name: "Saved turn 1" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete saved conversation" }),
    );
    expect(
      screen.queryByRole("article", { name: "Saved turn 1" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.deleteCopilotConversation).toHaveBeenCalledOnce(),
    );
    expect(api.deleteCopilotConversation).toHaveBeenCalledWith(
      "project",
      "conversation",
      1,
      expect.any(AbortSignal),
    );
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("repeats saved-status reads and requests cancellation without resending a dispatching turn", async () => {
    let saved: CopilotTurn = {
      ...turn(1),
      state: "dispatching",
      contentAvailable: false,
    };
    vi.mocked(api.getCopilotConversation).mockImplementation(async () => ({
      conversation,
      turns: [saved],
    }));
    vi.mocked(api.getCopilotRequest).mockImplementation(async () => saved);
    vi.mocked(api.cancelCopilotTurn).mockImplementation(async () => {
      saved = { ...saved, state: "cancelled", version: 2 };
      return saved;
    });
    render(<CopilotConsole />);
    await open();
    for (let count = 1; count <= 2; count++) {
      fireEvent.click(
        screen.getByRole("button", { name: "Check turn 1 saved status" }),
      );
      await waitFor(() =>
        expect(api.getCopilotRequest).toHaveBeenCalledTimes(count),
      );
    }
    expect(api.getCopilotRequest).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      "request-1",
      expect.any(AbortSignal),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request cancellation for turn 1" }),
    );
    await screen.findByText(
      "Cancelled. Data already transmitted cannot be recalled.",
    );
    expect(api.cancelCopilotTurn).toHaveBeenCalledWith(
      "project",
      "conversation",
      "request-1",
    );
    expect(
      screen.queryByRole("button", { name: "Request cancellation for turn 1" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh private history" }),
    );
    await screen.findByText(
      "Cancelled. Data already transmitted cannot be recalled.",
    );
    expect(
      screen.getByLabelText("Include turn 1 in next preview"),
    ).toBeDisabled();
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("supports explicitly ordered history-only continuation, resets consent, and never renders model markup", async () => {
    const { container } = render(<CopilotConsole />);
    await open();
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByLabelText("Include turn 2 in next preview"));
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    expect(api.previewCopilotHistory).toHaveBeenCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        historyTurnIds: ["turn-2", "turn-1"],
        context: { stepRunIds: [], artifactIds: [], fromLine: 0 },
      }),
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.change(screen.getByLabelText("Configured model"), {
      target: { value: "1" },
    });
    expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
    expect(
      screen.queryByRole("region", { name: "Redacted context preview" }),
    ).not.toBeInTheDocument();
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("article", { name: "Saved turn 3" });
    expect(api.sendCopilotTurn).toHaveBeenCalledTimes(1);
    expect(api.sendCopilotTurn).toHaveBeenCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        historyTurnIds: ["turn-2", "turn-1"],
        shareSelectedContext: true,
        contextDigest: "digest",
        model: "other",
      }),
      expect.any(AbortSignal),
    );
    expect(analyzeCopilot).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("Include turn 1 in next preview"),
    ).not.toBeChecked();
  });
  it("keeps a stable explicit question label while editing a populated history-only follow-up", async () => {
    let sequence = 0;
    vi.mocked(api.sendCopilotTurn).mockImplementation(
      async (_p, _c, input) => ({
        ...turn(++sequence),
        requestId: input.requestId,
        question: input.question,
        contentAvailableUntil: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    render(<CopilotConsole />);
    await load();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create private conversation · 30 days",
      }),
    );
    await screen.findByLabelText("Fixed conversation scope");
    fireEvent.click(screen.getByLabelText(/Compile/));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("article", { name: "Saved turn 1" });
    const question = screen.getByRole("textbox", {
      name: "Question",
    });
    expect(question).toHaveValue("");
    const followUp = "Using only the checked earlier pair, what next?";
    fireEvent.change(question, { target: { value: followUp } });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByRole("region", { name: "Redacted context preview" });
    expect(api.previewCopilotHistory).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      expect.objectContaining({ historyTurnIds: [] }),
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    fireEvent.click(screen.getByLabelText(/Compile/));
    // React writes the controlled value into the textarea's text node. An
    // explicit label keeps exact browser label locators stable despite that.
    expect(question.textContent).toBe(followUp);
    expect(question).toHaveAttribute("aria-label", "Question");
    expect(question).toBeEnabled();
    const editedFollowUp = "Explain only the next diagnostic check.";
    fireEvent.change(screen.getByLabelText("Question", { exact: true }), {
      target: { value: editedFollowUp },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByRole("region", { name: "Redacted context preview" });
    expect(api.previewCopilotHistory).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        question: editedFollowUp,
        historyTurnIds: ["turn-1"],
        context: { stepRunIds: [], artifactIds: [], fromLine: 0 },
      }),
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("article", { name: "Saved turn 2" });
    expect(api.sendCopilotTurn).toHaveBeenCalledTimes(2);
    expect(api.sendCopilotTurn).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        question: editedFollowUp,
        historyTurnIds: ["turn-1"],
        context: { stepRunIds: [], artifactIds: [], fromLine: 0 },
        shareSelectedContext: true,
      }),
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("article", { name: "Saved turn 1" })).toBeVisible();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("clears current private bodies when a successful refreshed list filters out a revoked pipeline", async () => {
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    vi.mocked(api.listCopilotConversations).mockResolvedValueOnce({
      conversations: [],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load private conversations" }),
    );
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Review-only action plans" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Redacted context preview" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.listCopilotConversations).toHaveBeenCalledTimes(2),
    );
    expect(
      screen.queryByRole("list", { name: "Your conversations" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
  });
  it("loads more than 20 turns with the next sequence and never duplicates the first page", async () => {
    vi.mocked(api.getCopilotConversation)
      .mockResolvedValueOnce({
        conversation,
        turns: Array.from({ length: 20 }, (_, i) => turn(i + 1)),
        nextAfterSequence: 20,
      })
      .mockResolvedValueOnce({ conversation, turns: [turn(21), turn(22)] });
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "More saved turns" }));
    await screen.findByRole("article", { name: "Saved turn 22" });
    expect(api.getCopilotConversation).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      20,
      expect.any(AbortSignal),
    );
    expect(screen.getAllByRole("article")).toHaveLength(22);
    for (let i = 1; i <= 22; i++)
      expect(
        screen.getAllByRole("article", {
          name: `Saved turn ${i}`,
        }),
      ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "More saved turns" }),
    ).not.toBeInTheDocument();
  });
  it("fails closed if a later turn page repeats earlier sequence IDs", async () => {
    vi.mocked(api.getCopilotConversation)
      .mockResolvedValueOnce({
        conversation,
        turns: [turn(1), turn(2)],
        nextAfterSequence: 2,
      })
      .mockResolvedValueOnce({ conversation, turns: [turn(1), turn(2)] });
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "More saved turns" }));
    await screen.findByText(
      /Previously displayed private content has been cleared/,
    );
    expect(
      screen.queryByRole("article", { name: "Saved turn 1" }),
    ).not.toBeInTheDocument();
  });
  it("clears all displayed private data after rejected revalidation", async () => {
    render(<CopilotConsole />);
    await open();
    vi.mocked(api.getCopilotConversation).mockRejectedValueOnce(
      new Error("403 forbidden with private server payload"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh private history" }),
    );
    await screen.findByText(
      /Previously displayed private content has been cleared/,
    );
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/private server payload/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Your conversations" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
  });
  it.each(["project", "account", "logout"])(
    "clears private data and rejects stale responses on %s switch",
    async (change) => {
      if (change === "logout")
        authStore.setTokens({
          accessToken: "initial-session",
          refreshToken: "initial-refresh",
        });
      let resolve!: (value: api.CopilotConversationDetail) => void;
      render(<CopilotConsole />);
      await open();
      vi.mocked(api.getCopilotConversation).mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh private history" }),
      );
      const pending = vi
        .mocked(api.getCopilotConversation)
        .mock.calls.at(-1)?.[3];
      if (change === "project")
        fireEvent.change(screen.getByLabelText("Project ID"), {
          target: { value: "other" },
        });
      else if (change === "account")
        await act(async () => {
          userStore.setUserinfo(
            {
              userId: "other-user",
              username: "other",
              email: "",
              avatar: "",
              fullName: "",
              phone: "",
            },
            "user",
          );
        });
      else
        await act(async () => {
          authStore.clearTokens();
        });
      expect(pending?.aborted).toBe(true);
      await act(async () => resolve({ conversation, turns: [turn(1)] }));
      expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Fixed conversation scope"),
      ).not.toBeInTheDocument();
    },
  );
  it("never silently falls back after failed private creation", async () => {
    vi.mocked(api.createCopilotConversation).mockRejectedValue(
      new Error("history_unavailable"),
    );
    render(<CopilotConsole />);
    await load();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create private conversation · 30 days",
      }),
    );
    await screen.findByText(/never fall back to ephemeral analysis/);
    await screen.findByText(
      /Previously displayed private content has been cleared/,
    );
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("allows reading history without a configured model and blocks sending without encryption", async () => {
    vi.mocked(getCopilotStatus).mockResolvedValueOnce({
      ...status,
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Load private conversations" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open private conversation conversation",
      }),
    );
    await screen.findByRole("article", { name: "Saved turn 1" });
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
    cleanup();
    vi.mocked(getCopilotStatus).mockResolvedValue({
      ...status,
      historyAvailable: false,
    });
    render(<CopilotConsole />);
    await load();
    expect(
      screen.getByText(/valid managed encryption key is required/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Create private conversation · 30 days",
      }),
    ).not.toBeInTheDocument();
  });
  it("shows expired/unavailable/unknown states without history selection or resend", async () => {
    vi.mocked(api.getCopilotConversation).mockResolvedValue({
      conversation,
      turns: [
        { ...turn(1), expiresAt: "2000-01-01T00:00:00Z" },
        { ...turn(2), contentAvailable: false, state: "outcome_unknown" },
      ],
    });
    render(<CopilotConsole />);
    await open();
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/provider may have received this request/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Include turn 1 in next preview"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Include turn 2 in next preview"),
    ).toBeDisabled();
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
  });
  it("keeps history opt-in after reopening and refuses a no-selection follow-up", async () => {
    render(<CopilotConsole />);
    await open();
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "What next?" },
    });
    expect(
      screen.getByRole("button", { name: "Preview redacted context" }),
    ).toBeDisabled();
    for (const item of [1, 2])
      expect(
        screen.getByLabelText(`Include turn ${item} in next preview`),
      ).not.toBeChecked();
    expect(JSON.stringify(localStorage)).not.toContain("Private question");
    expect(JSON.stringify(localStorage)).not.toContain("Private answer");
    expect(JSON.stringify(sessionStorage)).not.toContain("Private answer");
  });
  it("rejects excess history and makes a changed ordered selection invalidate consent", async () => {
    vi.mocked(api.getCopilotConversation).mockResolvedValue({
      conversation,
      turns: Array.from({ length: 7 }, (_, i) => turn(i + 1)),
    });
    render(<CopilotConsole />);
    await open();
    for (let i = 1; i <= 6; i++)
      fireEvent.click(
        screen.getByLabelText(`Include turn ${i} in next preview`),
      );
    expect(
      screen.getByLabelText("Include turn 7 in next preview"),
    ).toBeDisabled();
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(screen.getByLabelText("Include turn 2 in next preview"));
    expect(screen.getByLabelText(/Send this question/)).not.toBeChecked();
    expect(
      screen.queryByRole("region", { name: "Redacted context preview" }),
    ).not.toBeInTheDocument();
  });
  it("does not accept a private preview with a different historical selection", async () => {
    vi.mocked(api.previewCopilotHistory).mockResolvedValueOnce({
      text: "Foreign history content",
      digest: "bad",
      historyTurnIds: ["foreign"],
      historyBytes: 5,
      evidence: [],
      warnings: [],
    });
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "What next?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    await screen.findByText(
      /Previously displayed private content has been cleared/,
    );
    expect(
      screen.queryByText("Foreign history content"),
    ).not.toBeInTheDocument();
    expect(api.sendCopilotTurn).not.toHaveBeenCalled();
  });
  it("suppresses a delayed preview after changing the fixed run", async () => {
    let finish!: (value: api.CopilotHistoryPreview) => void;
    vi.mocked(api.previewCopilotHistory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "What next?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Preview redacted context" }),
    );
    const signal = vi.mocked(api.previewCopilotHistory).mock.calls[0][3];
    fireEvent.change(screen.getByLabelText("Run ID"), {
      target: { value: "another-run" },
    });
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      finish({
        text: "Late private preview",
        digest: "old",
        historyTurnIds: ["turn-1"],
        historyBytes: 50,
        evidence: [],
        warnings: [],
      }),
    );
    expect(screen.queryByText("Late private preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
  });
  it("clears private content on a failed cancellation and offers only saved-status reconciliation", async () => {
    vi.mocked(api.sendCopilotTurn).mockImplementationOnce(
      () => new Promise(() => {}),
    );
    vi.mocked(api.cancelCopilotTurn).mockRejectedValueOnce(
      new Error("unconfirmed cancellation"),
    );
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    await screen.findByRole("button", { name: "Check saved request status" });
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(api.sendCopilotTurn).toHaveBeenCalledOnce();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
  it("honors an earlier dependency availability deadline without claiming body retention expired", async () => {
    vi.mocked(api.getCopilotConversation).mockResolvedValueOnce({
      conversation,
      turns: [{ ...turn(1), contentAvailableUntil: "2000-01-01T00:00:00Z" }],
    });
    render(<CopilotConsole />);
    await open();
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Include turn 1 in next preview"),
    ).toBeDisabled();
    expect(
      screen.queryByText(/retention period has expired/),
    ).not.toBeInTheDocument();
  });
  it("extends only conversation metadata when a new turn has a later body expiry", async () => {
    vi.mocked(api.getCopilotConversation).mockResolvedValueOnce({
      conversation: { ...conversation, expiresAt: "2030-01-01T00:00:00Z" },
      turns: [turn(1)],
    });
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    await screen.findByRole("article", { name: "Saved turn 3" });
    expect(
      screen.getByLabelText("Fixed conversation scope").textContent,
    ).toContain(new Date(turn(3).expiresAt).toLocaleString());
  });
  it("deletion hides bodies immediately and suppresses a late answer", async () => {
    let finish!: (value: CopilotTurn) => void;
    vi.mocked(api.sendCopilotTurn).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete saved conversation" }),
    );
    await waitFor(() =>
      expect(api.deleteCopilotConversation).toHaveBeenCalledOnce(),
    );
    const input = vi.mocked(api.sendCopilotTurn).mock.calls[0][2];
    await act(async () => finish({ ...turn(3), requestId: input.requestId }));
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
    expect(api.cancelCopilotTurn).toHaveBeenCalledOnce();
  });
  it("displays durable transport uncertainty and only reconciles with a GET", async () => {
    vi.mocked(api.sendCopilotTurn).mockRejectedValueOnce(
      new Error("connection lost"),
    );
    vi.mocked(api.getCopilotRequest).mockImplementation(async (_p, _c, id) => ({
      ...turn(3),
      requestId: id,
      state: "outcome_unknown",
      contentAvailable: false,
    }));
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByLabelText("Include turn 1 in next preview"));
    await preview();
    fireEvent.click(screen.getByLabelText(/Send this question/));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze selected context" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Check saved request status" }),
    );
    await waitFor(() => expect(api.getCopilotRequest).toHaveBeenCalledOnce());
    expect(api.sendCopilotTurn).toHaveBeenCalledOnce();
    expect(analyzeCopilot).not.toHaveBeenCalled();
  });
});
describe("typed review-only plans", () => {
  const plan: plans.CopilotPlan = {
    planId: "plan",
    requestId: "plan-request",
    turnId: "turn-1",
    kind: "code_patch",
    state: "proposed",
    version: 1,
    planDigest: "digest",
    executionEnabled: false,
    executionStatus: "Not executed",
    eligible: true,
    createdAt: "2026-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    payload: {
      schemaVersion: 1,
      kind: "code_patch",
      label: "<a href='https://malicious.invalid'>approved</a>",
      codePatch: {
        artifactId: "artifact",
        path: "main.go",
        baseDigest: "base",
        patchDigest: "patch",
        resultDigest: "result",
        snapshotOnly: true,
        patch:
          "--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-<img src=x>\n+<script>execute()</script>",
      },
    },
  };
  it("pages and reloads saved proposals without duplicating articles or reviewing anything", async () => {
    const other = { ...plan, planId: "other-plan" };
    vi.mocked(plans.listCopilotPlans)
      .mockResolvedValueOnce({ plans: [plan], nextAfter: 20 })
      .mockResolvedValueOnce({ plans: [other] })
      .mockResolvedValueOnce({ plans: [other] });
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Load saved plans" }));
    await screen.findByRole("article", { name: "Plan plan" });
    fireEvent.click(screen.getByRole("button", { name: "More saved plans" }));
    await screen.findByRole("article", { name: "Plan other-plan" });
    expect(plans.listCopilotPlans).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      20,
      expect.any(AbortSignal),
    );
    expect(screen.getAllByRole("article", { name: /^Plan / })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Load saved plans" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Plan plan" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole("article", { name: /^Plan / })).toHaveLength(1);
    expect(plans.listCopilotPlans).toHaveBeenLastCalledWith(
      "project",
      "conversation",
      0,
      expect.any(AbortSignal),
    );
    expect(plans.createCopilotPlan).not.toHaveBeenCalled();
    expect(plans.reviewCopilotPlan).not.toHaveBeenCalled();
    expect(plans.cancelCopilotPlan).not.toHaveBeenCalled();
  });
  it.each([
    "new_run_review",
    "code_patch_artifact",
    "code_patch_source",
    "retry_approval_review",
    "deployment_review",
  ] as const)(
    "repeats populated %s controls and scopes refresh, review, and cancel to the intended proposal",
    async (scenario) => {
      const kind: plans.CopilotPlanKind =
        scenario === "code_patch_artifact" || scenario === "code_patch_source"
          ? "code_patch"
          : scenario;
      const source = {
        kind: "source-file",
        id: "source",
        name: "src/main.go",
        bytes: 20,
        truncated: false,
        jobRunId: "job",
        path: "src/main.go",
      };
      vi.mocked(api.getCopilotConversation).mockResolvedValue({
        conversation,
        turns: [
          { ...turn(1), evidence: [...turn(1).evidence, source] },
          turn(2),
        ],
      });
      const other = { ...plan, planId: "other-plan" };
      vi.mocked(plans.listCopilotPlans).mockResolvedValue({ plans: [other] });
      let stored = plan;
      const expected: Record<string, unknown> = { kind, turnId: "turn-1" };
      const payload: plans.CopilotPlanPayload = {
        schemaVersion: 1,
        kind,
        label: "Review only; not executed",
      };
      vi.mocked(plans.createCopilotPlan).mockImplementation(
        async (_project, _conversation, input) => {
          stored = { ...plan, kind, requestId: input.requestId, payload };
          return stored;
        },
      );
      vi.mocked(plans.getCopilotPlan).mockImplementation(async () => stored);
      vi.mocked(plans.reviewCopilotPlan).mockImplementation(async () => {
        stored = { ...stored, state: "reviewed", version: stored.version + 1 };
        return stored;
      });
      vi.mocked(plans.cancelCopilotPlan).mockImplementation(async () => {
        stored = { ...stored, state: "cancelled", version: stored.version + 1 };
        return stored;
      });
      render(<CopilotConsole />);
      await open();
      fireEvent.click(screen.getByRole("button", { name: "Load saved plans" }));
      const otherArticle = await screen.findByRole("article", {
        name: "Plan other-plan",
      });
      for (const value of ["turn-2", "turn-1"])
        fireEvent.change(screen.getByLabelText("Saved turn for proposal"), {
          target: { value },
        });
      for (const value of ["deployment_review", "code_patch", kind])
        fireEvent.change(screen.getByLabelText("Proposal kind"), {
          target: { value },
        });
      const edit = (name: string, value: string) => {
        fireEvent.change(screen.getByLabelText(name, { exact: true }), {
          target: { value: "draft-value" },
        });
        fireEvent.change(screen.getByLabelText(name, { exact: true }), {
          target: { value },
        });
        expect(screen.getByLabelText(name, { exact: true })).toHaveValue(value);
      };
      if (kind === "code_patch") {
        const sourcePatch = scenario === "code_patch_source";
        for (const value of ["1", "0", sourcePatch ? "1" : "0"])
          fireEvent.change(
            screen.getByLabelText("Previously selected patch base"),
            {
              target: { value },
            },
          );
        const path = sourcePatch ? "src/main.go" : "main.go";
        const patch = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new`;
        edit("Proposed unified diff", patch);
        expected.codePatch = sourcePatch
          ? { sourceFile: { jobRunId: "job", path: "src/main.go" }, patch }
          : { artifactId: "artifact", patch };
        payload.codePatch = {
          ...plan.payload!.codePatch!,
          patch,
          ...(sourcePatch && {
            artifactId: undefined,
            jobRunId: "job",
            path: "src/main.go",
            snapshotOnly: false,
          }),
        };
      } else if (kind === "new_run_review") {
        payload.newRun = { pipelineId: "pipeline", diagnosticRunId: "run" };
      } else if (kind === "retry_approval_review") {
        edit("Existing retry approval ID", "approval");
        expected.retryApproval = { approvalId: "approval" };
        payload.retryApproval = {
          approvalId: "approval",
          jobRunId: "job",
          bindingKind: "exact",
          evidenceDigest: "evidence",
          policyId: "policy",
          deadline: null,
        };
      } else {
        edit("Existing environment ID", "environment");
        edit("Registered release artifact ID", "release-artifact");
        edit("Existing release ID (optional)", "release");
        expected.deployment = {
          environmentId: "environment",
          artifactId: "release-artifact",
          releaseId: "release",
        };
        payload.deployment = {
          environmentId: "environment",
          artifactId: "release-artifact",
          releaseId: "release",
          artifactDigest: "artifact-digest",
          targetFingerprint: "target",
          namespace: "namespace",
          workload: "workload",
          container: "container",
          imageDigest: "image-digest",
          approvalRequired: false,
        };
      }
      fireEvent.click(
        screen.getByRole("button", { name: "Create review-only proposal" }),
      );
      const article = await screen.findByRole("article", { name: "Plan plan" });
      expect(plans.createCopilotPlan).toHaveBeenCalledWith(
        "project",
        "conversation",
        { ...expected, requestId: expect.any(String) },
        expect.any(AbortSignal),
      );
      const review = () =>
        within(article).getByRole("button", {
          name: "Record review · Not executed",
        });
      expect(review()).toBeDisabled();
      for (let count = 1; count <= 2; count++) {
        fireEvent.click(
          within(article).getByLabelText(
            /I understand this records review only/,
          ),
        );
        expect(review()).toBeEnabled();
        fireEvent.click(
          within(article).getByRole("button", { name: "Refresh proposal" }),
        );
        await waitFor(() =>
          expect(plans.getCopilotPlan).toHaveBeenCalledTimes(count),
        );
        expect(review()).toBeDisabled();
        expect(
          within(article).getByLabelText(
            /I understand this records review only/,
          ),
        ).not.toBeChecked();
      }
      expect(plans.getCopilotPlan).toHaveBeenLastCalledWith(
        "project",
        "conversation",
        "plan",
        expect.any(AbortSignal),
      );
      fireEvent.click(
        within(article).getByLabelText(/I understand this records review only/),
      );
      fireEvent.click(review());
      await waitFor(() =>
        expect(plans.reviewCopilotPlan).toHaveBeenCalledOnce(),
      );
      expect(plans.reviewCopilotPlan).toHaveBeenCalledWith(
        "project",
        "conversation",
        expect.objectContaining({
          planId: "plan",
          version: 1,
          planDigest: "digest",
        }),
        expect.any(AbortSignal),
      );
      expect(review()).toBeDisabled();
      fireEvent.click(
        within(article).getByRole("button", { name: "Cancel proposal only" }),
      );
      await waitFor(() =>
        expect(plans.cancelCopilotPlan).toHaveBeenCalledOnce(),
      );
      expect(plans.cancelCopilotPlan).toHaveBeenCalledWith(
        "project",
        "conversation",
        expect.objectContaining({
          planId: "plan",
          version: 2,
          state: "reviewed",
        }),
        expect.any(AbortSignal),
      );
      expect(
        within(article).getByRole("button", { name: "Cancel proposal only" }),
      ).toBeDisabled();
      expect(
        within(otherArticle).getByRole("button", {
          name: "Cancel proposal only",
        }),
      ).toBeEnabled();
      expect(
        within(otherArticle).getByLabelText(
          /I understand this records review only/,
        ),
      ).not.toBeChecked();
      expect(
        within(article).getByText("Not executed", { exact: true }),
      ).toBeVisible();
      expect(api.sendCopilotTurn).not.toHaveBeenCalled();
      expect(analyzeCopilot).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Run ID"), {
        target: { value: "other-run" },
      });
      expect(
        screen.queryByRole("region", { name: "Review-only action plans" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("article", { name: "Saved turn 1" }),
      ).not.toBeInTheDocument();
    },
  );
  it("renders injected model/diff content inert and requires digest-bound explicit review", async () => {
    vi.mocked(plans.createCopilotPlan).mockResolvedValue(plan);
    vi.mocked(plans.reviewCopilotPlan).mockResolvedValue({
      ...plan,
      state: "reviewed",
      version: 2,
    });
    const { container } = render(<CopilotConsole />);
    await open();
    fireEvent.change(screen.getByLabelText("Saved turn for proposal"), {
      target: { value: "turn-1" },
    });
    fireEvent.change(screen.getByLabelText("Proposal kind"), {
      target: { value: "code_patch" },
    });
    fireEvent.change(screen.getByLabelText("Previously selected patch base"), {
      target: { value: "0" },
    });
    const diff = screen.getByLabelText("Proposed unified diff");
    const initialPatch =
      "--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new";
    fireEvent.change(diff, { target: { value: initialPatch } });
    expect(diff.textContent).toBe(initialPatch);
    expect(diff).toHaveAttribute("aria-label", "Proposed unified diff");
    fireEvent.change(screen.getByLabelText("Proposed unified diff"), {
      target: { value: plan.payload!.codePatch!.patch },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create review-only proposal" }),
    );
    const article = await screen.findByRole("article", { name: "Plan plan" });
    expect(
      container.querySelector("script, img, a[href^='https://malicious']"),
    ).toBeNull();
    expect(
      within(article).getByText("Not executed", { exact: true }),
    ).toBeInTheDocument();
    expect(
      within(article).getByText(
        "Snapshot patch; repository destination unverified",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record review · Not executed" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(/I understand this records review only/),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Record review · Not executed" }),
    );
    await waitFor(() =>
      expect(plans.reviewCopilotPlan).toHaveBeenCalledWith(
        "project",
        "conversation",
        plan,
        expect.any(AbortSignal),
      ),
    );
    expect(plans.createCopilotPlan).toHaveBeenCalledWith(
      "project",
      "conversation",
      expect.objectContaining({
        turnId: "turn-1",
        kind: "code_patch",
        codePatch: {
          artifactId: "artifact",
          patch: plan.payload!.codePatch!.patch,
        },
      }),
      expect.any(AbortSignal),
    );
  });
  it("drops stale private plans on review failure rather than showing a false receipt", async () => {
    vi.mocked(plans.listCopilotPlans).mockResolvedValue({ plans: [plan] });
    vi.mocked(plans.reviewCopilotPlan).mockRejectedValue(new Error("revoked"));
    render(<CopilotConsole />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Load saved plans" }));
    await screen.findByRole("article", { name: "Plan plan" });
    fireEvent.click(
      screen.getByLabelText(/I understand this records review only/),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Record review · Not executed" }),
    );
    await screen.findByText(
      /Previously displayed private content has been cleared/,
    );
    expect(
      screen.queryByRole("article", { name: "Plan plan" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Private answer/)).not.toBeInTheDocument();
  });
});
