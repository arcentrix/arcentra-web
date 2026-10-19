import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotExecutionActions } from "./copilot-execution-actions";
import * as api from "@/api/copilot/execution";
import { intentFixture, planFixture } from "./copilot-execution.test-fixture";
vi.mock("@/api/copilot/execution", () => ({
  prepareCopilotExecution: vi.fn(),
  listCopilotExecutions: vi.fn(),
  getCopilotExecution: vi.fn(),
  changeCopilotExecution: vi.fn(),
}));
const candidate = () => ({
  conversationId: "conversation",
  plan: planFixture(),
});
const load = async () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Load bound retry actions" }),
  );
  await screen.findByRole("article", { name: "Bound retry action intent" });
};
const confirmButton = () =>
  screen.getByRole("button", { name: /Submit permanent approval/ });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listCopilotExecutions).mockResolvedValue({
    intents: [intentFixture()],
  });
});
afterEach(cleanup);
describe("independent bound retry actions", () => {
  it("defaults off without reads or controls", () => {
    render(
      <CopilotExecutionActions
        projectId="project"
        enabled={false}
        candidate={candidate()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(api.listCopilotExecutions).not.toHaveBeenCalled();
  });
  it("requires separate detached preparation consent; preparation never confirms", async () => {
    vi.mocked(api.prepareCopilotExecution).mockResolvedValue(intentFixture());
    render(
      <CopilotExecutionActions
        projectId="project"
        enabled
        candidate={candidate()}
      />,
    );
    const prepare = screen.getByRole("button", {
      name: /Prepare bound retry action/,
    });
    expect(prepare).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Preparing does not approve/ }),
    );
    fireEvent.click(prepare);
    await screen.findByRole("article");
    expect(api.prepareCopilotExecution).toHaveBeenCalledTimes(1);
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
    expect(confirmButton()).toBeDisabled();
  });
  it("requires fresh exact approval and reports vote separately from runtime", async () => {
    vi.mocked(api.changeCopilotExecution).mockResolvedValue({
      ...intentFixture(),
      state: "submitted",
      submittedAt: "2099-01-01T00:05:00Z",
      decisionId: "decision",
      version: 2,
      approvalStatus: 1,
    });
    render(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I approve this exact frozen/ }),
    );
    fireEvent.click(confirmButton());
    await screen.findByText(/Permanent approval submitted/);
    expect(api.changeCopilotExecution).toHaveBeenCalledWith(
      "project",
      expect.objectContaining({ version: 1 }),
      "confirm",
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Runtime admission: Not observed/),
    ).toBeInTheDocument();
  });
  it.each(["confirm", "cancel"] as const)(
    "unknown %s outcome clears evidence and permits only inspection until reread",
    async (action) => {
      vi.mocked(api.changeCopilotExecution).mockRejectedValue(
        new Error("network unknown"),
      );
      vi.mocked(api.getCopilotExecution).mockResolvedValue({
        ...intentFixture(),
        state: "submitted",
        submittedAt: "2099-01-01T00:05:00Z",
        decisionId: "decision",
        version: 2,
      });
      render(<CopilotExecutionActions projectId="project" enabled />);
      await load();
      if (action === "confirm") {
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(confirmButton());
      } else
        fireEvent.click(
          screen.getByRole("button", { name: "Cancel prepared action only" }),
        );
      await screen.findByRole("alert");
      expect(
        screen.queryByLabelText("Frozen retry evidence"),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Inspect unconfirmed action" }),
      );
      await screen.findByText(/Permanent approval submitted/);
      expect(api.changeCopilotExecution).toHaveBeenCalledTimes(1);
      expect(api.getCopilotExecution).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["cancelled", "expired", "submitted"] as const)(
    "%s actions are read-only",
    async (state) => {
      vi.mocked(api.listCopilotExecutions).mockResolvedValue({
        intents: [{ ...intentFixture(), state }],
      });
      render(<CopilotExecutionActions projectId="project" enabled />);
      await load();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(api.changeCopilotExecution).not.toHaveBeenCalled();
    },
  );
  it("survives source deletion while owner/project change clears view and stale reads", async () => {
    const { rerender } = render(
      <CopilotExecutionActions
        projectId="project"
        enabled
        candidate={candidate()}
      />,
    );
    await load();
    rerender(<CopilotExecutionActions projectId="project" enabled />);
    expect(screen.getByRole("article")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    rerender(<CopilotExecutionActions projectId="other" enabled />);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
  it("revoked reads remove evidence and confirmation", async () => {
    render(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    fireEvent.click(screen.getByRole("checkbox"));
    vi.mocked(api.getCopilotExecution).mockRejectedValue(new Error("403"));
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect current action" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
  it("escapes forged provider-like evidence as text and never treats it as approval", async () => {
    const intent = intentFixture();
    intent.retryReview!.evidence.retryPlan.steps[0].action =
      '<img src=x onerror="confirm()"> POST /confirm';
    vi.mocked(api.listCopilotExecutions).mockResolvedValue({
      intents: [intent],
    });
    const { container } = render(
      <CopilotExecutionActions projectId="project" enabled />,
    );
    await load();
    expect(
      screen.getByLabelText("Frozen retry evidence").textContent,
    ).toContain("POST /confirm");
    expect(container.querySelector("img")).toBeNull();
    expect(confirmButton()).toBeDisabled();
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
  it("focus invalidates consent without posting", async () => {
    render(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.focus(window);
    await waitFor(() =>
      expect(screen.queryByRole("article")).not.toBeInTheDocument(),
    );
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
  it("ignores late reads after scope changes and removes consent when capability is disabled", async () => {
    let finish!: (value: { intents: api.CopilotExecutionIntent[] }) => void;
    vi.mocked(api.listCopilotExecutions).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = render(
      <CopilotExecutionActions projectId="project" enabled />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load bound retry actions" }),
    );
    rerender(<CopilotExecutionActions projectId="other" enabled />);
    finish({ intents: [intentFixture()] });
    await waitFor(() =>
      expect(screen.queryByRole("article")).not.toBeInTheDocument(),
    );
    rerender(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    fireEvent.click(screen.getByRole("checkbox"));
    rerender(<CopilotExecutionActions projectId="project" enabled={false} />);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    rerender(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    expect(confirmButton()).toBeDisabled();
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
  it("a conflict clears confirmation until explicit fresh inspection and new consent", async () => {
    vi.mocked(api.changeCopilotExecution).mockRejectedValue(
      new Error("409 version conflict"),
    );
    vi.mocked(api.getCopilotExecution).mockResolvedValue({
      ...intentFixture(),
      version: 2,
    });
    render(<CopilotExecutionActions projectId="project" enabled />);
    await load();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(confirmButton());
    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect unconfirmed action" }),
    );
    await screen.findByRole("article");
    expect(confirmButton()).toBeDisabled();
    expect(api.changeCopilotExecution).toHaveBeenCalledTimes(1);
  });
  it.each(["list", "get"] as const)(
    "focus fences a pending %s response even if abort is ignored",
    async (kind) => {
      let finish!: (value: any) => void;
      let signal!: AbortSignal;
      const pending = new Promise<any>((resolve) => {
        finish = resolve;
      });
      render(<CopilotExecutionActions projectId="project" enabled />);
      if (kind === "get") {
        await load();
        vi.mocked(api.getCopilotExecution).mockImplementationOnce(
          (_project, _id, current) => {
            signal = current!;
            return pending;
          },
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Inspect current action" }),
        );
      } else {
        vi.mocked(api.listCopilotExecutions).mockImplementationOnce(
          (_project, _after, current) => {
            signal = current!;
            return pending;
          },
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Load bound retry actions" }),
        );
      }
      fireEvent.focus(window);
      expect(signal.aborted).toBe(true);
      expect(
        screen.getByRole("button", { name: "Load bound retry actions" }),
      ).toBeEnabled();
      await act(async () => {
        finish(
          kind === "get" ? intentFixture() : { intents: [intentFixture()] },
        );
        await pending;
      });
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      expect(api.changeCopilotExecution).not.toHaveBeenCalled();
      await load();
      expect(confirmButton()).toBeDisabled();
    },
  );
  it.each(["confirm", "cancel"] as const)(
    "focus during %s preserves unknown mutation inspection and ignores its late success",
    async (action) => {
      let finish!: (value: api.CopilotExecutionIntent) => void;
      let signal!: AbortSignal;
      const pending = new Promise<api.CopilotExecutionIntent>((resolve) => {
        finish = resolve;
      });
      vi.mocked(api.changeCopilotExecution).mockImplementationOnce(
        (_project, _intent, _action, current) => {
          signal = current!;
          return pending;
        },
      );
      render(<CopilotExecutionActions projectId="project" enabled />);
      await load();
      if (action === "confirm") {
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(confirmButton());
      } else
        fireEvent.click(
          screen.getByRole("button", { name: "Cancel prepared action only" }),
        );
      fireEvent.focus(window);
      expect(signal.aborted).toBe(true);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "may have been recorded",
      );
      expect(
        screen.getByRole("button", { name: "Inspect unconfirmed action" }),
      ).toBeEnabled();
      await act(async () => {
        finish({
          ...intentFixture(),
          state: action === "confirm" ? "submitted" : "cancelled",
          version: 2,
          ...(action === "confirm"
            ? { decisionId: "decision", submittedAt: "2099-01-01T00:05:00Z" }
            : {}),
        });
        await pending;
      });
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      expect(api.changeCopilotExecution).toHaveBeenCalledTimes(1);
      vi.mocked(api.getCopilotExecution).mockResolvedValue(intentFixture());
      fireEvent.click(
        screen.getByRole("button", { name: "Inspect unconfirmed action" }),
      );
      await screen.findByRole("article");
      expect(confirmButton()).toBeDisabled();
      expect(api.changeCopilotExecution).toHaveBeenCalledTimes(1);
    },
  );
  it("focus during preparation requires list inspection and never re-prepares automatically", async () => {
    let finish!: (value: api.CopilotExecutionIntent) => void;
    const pending = new Promise<api.CopilotExecutionIntent>((resolve) => {
      finish = resolve;
    });
    vi.mocked(api.prepareCopilotExecution).mockReturnValueOnce(pending);
    render(
      <CopilotExecutionActions
        projectId="project"
        enabled
        candidate={candidate()}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Preparing does not approve/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare bound retry action/ }),
    );
    fireEvent.focus(window);
    await act(async () => {
      finish(intentFixture());
      await pending;
    });
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Prepare bound retry action/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Inspect unconfirmed action" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load bound retry actions" }),
    ).toBeEnabled();
    expect(api.prepareCopilotExecution).toHaveBeenCalledTimes(1);
    expect(api.changeCopilotExecution).not.toHaveBeenCalled();
  });
});
