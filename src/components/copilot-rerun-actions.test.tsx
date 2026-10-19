import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CopilotRerunActions,
  RERUN_ACKNOWLEDGEMENT,
} from "./copilot-rerun-actions";
import * as api from "@/api/copilot/rerun";
import {
  confirmedRerunFixture,
  rerunEligibilityFixture,
  rerunIntentFixture,
  rerunScope,
} from "./copilot-rerun.test-fixture";
import { readRerunRecovery } from "./copilot-rerun-recovery";
vi.mock("@/api/copilot/rerun", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getCopilotRerunAvailability: vi.fn(),
  getCopilotRerunEligibility: vi.fn(),
  getCopilotRerun: vi.fn(),
  prepareCopilotRerun: vi.fn(),
  changeCopilotRerun: vi.fn(),
}));
const button = (name: string) => screen.getByRole("button", { name });
const renderActions = () =>
  render(<CopilotRerunActions {...rerunScope} enabled />);
async function eligible() {
  await screen.findByLabelText("Original job ID");
  fireEvent.change(screen.getByLabelText("Original job ID"), {
    target: { value: "old-job" },
  });
  fireEvent.click(button("Check rerun eligibility"));
  await screen.findByText("Eligible for a separate whole-job new execution.");
}
async function prepare() {
  await eligible();
  fireEvent.click(button("Prepare new execution"));
  await screen.findByRole("article", {
    name: "Whole-job re-execution intent",
  });
}
function consent() {
  fireEvent.click(
    screen.getByRole("checkbox", { name: RERUN_ACKNOWLEDGEMENT }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(api.getCopilotRerunAvailability).mockResolvedValue({
    available: true,
    cancelNewExecutionAvailable: false,
  });
  vi.mocked(api.getCopilotRerunEligibility).mockResolvedValue(
    rerunEligibilityFixture(),
  );
  vi.mocked(api.prepareCopilotRerun).mockImplementation(
    async (_scope, _eligibility, requestId) => ({
      ...rerunIntentFixture(),
      requestId,
    }),
  );
  vi.mocked(api.getCopilotRerun).mockResolvedValue(rerunIntentFixture());
  vi.mocked(api.changeCopilotRerun).mockResolvedValue(confirmedRerunFixture());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("whole-job NEW-execution UI", () => {
  it("stays inert without an independent available server, irrespective of model/vote support", async () => {
    const { rerender } = render(
      <CopilotRerunActions {...rerunScope} enabled={false} />,
    );
    expect(api.getCopilotRerunAvailability).not.toHaveBeenCalled();
    vi.mocked(api.getCopilotRerunAvailability).mockRejectedValue(
      new Error("404"),
    );
    rerender(<CopilotRerunActions {...rerunScope} enabled />);
    await waitFor(() =>
      expect(api.getCopilotRerunAvailability).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.queryByRole("region", { name: "Whole-job new executions" }),
    ).not.toBeInTheDocument();
    expect(api.prepareCopilotRerun).not.toHaveBeenCalled();
  });
  it("eligibility is read-only and shows the exact supported output-upload boundary", async () => {
    renderActions();
    await eligible();
    expect(api.prepareCopilotRerun).not.toHaveBeenCalled();
    expect(api.changeCopilotRerun).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Shell steps followed by output uploads are supported/),
    ).toBeInTheDocument();
    expect(screen.getByText("Expected checkout:")).toBeInTheDocument();
    expect(screen.queryByText(/Observed checkout/)).not.toBeInTheDocument();
    expect(screen.getByText(/Every job step runs again/)).toBeInTheDocument();
  });
  it("performs deliberate prepare then separate unchecked exact confirmation, preserving old/new links", async () => {
    renderActions();
    await prepare();
    expect(api.prepareCopilotRerun).toHaveBeenCalledTimes(1);
    expect(api.changeCopilotRerun).not.toHaveBeenCalled();
    expect(button("Confirm new execution")).toBeDisabled();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    consent();
    fireEvent.click(button("Confirm new execution"));
    await screen.findByText("New execution created");
    expect(api.changeCopilotRerun).toHaveBeenCalledWith(
      rerunScope,
      expect.objectContaining({
        version: 1,
        intentDigest: rerunIntentFixture().intentDigest,
      }),
      "confirm",
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole("link", { name: "View original execution" }),
    ).toHaveAttribute(
      "href",
      "/projects/project/pipelines?pipeline=pipeline&run=old-run",
    );
    expect(
      screen.getByRole("link", {
        name: "View new execution and independent approval",
      }),
    ).toHaveAttribute(
      "href",
      "/projects/project/pipelines?pipeline=pipeline&run=new-run",
    );
    expect(
      screen.getByText(
        /Independent approval and runtime outcome have not been observed/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Cancel new execution",
      }),
    ).not.toBeInTheDocument();
  });
  it("fences double-click Prepare and Confirm without a second write", async () => {
    let resolve!: (v: api.CopilotRerunIntent) => void;
    vi.mocked(api.prepareCopilotRerun).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    renderActions();
    await eligible();
    const prepareButton = button("Prepare new execution");
    fireEvent.click(prepareButton);
    fireEvent.click(prepareButton);
    expect(api.prepareCopilotRerun).toHaveBeenCalledTimes(1);
    await act(async () => resolve(rerunIntentFixture()));
    consent();
    vi.mocked(api.changeCopilotRerun).mockImplementation(
      () => new Promise(() => {}),
    );
    const confirm = button("Confirm new execution");
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.changeCopilotRerun).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Confirming request…");
  });
  it("lost Prepare preserves one opaque RequestID across reload and only inspects it", async () => {
    vi.mocked(api.prepareCopilotRerun).mockRejectedValue(
      new Error("response lost"),
    );
    const view = renderActions();
    await eligible();
    fireEvent.click(button("Prepare new execution"));
    await screen.findByRole("alert");
    const recovery = readRerunRecovery(rerunScope)!;
    expect(recovery.requestId).toBeTruthy();
    expect(Object.keys(recovery)).toEqual(["requestId"]);
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toMatch(
      /review|consent|candidate|source|token|digest/,
    );
    view.unmount();
    renderActions();
    await screen.findByRole("button", {
      name: "Inspect rerun request",
    });
    expect(
      screen.queryByRole("button", { name: "Prepare new execution" }),
    ).not.toBeInTheDocument();
    vi.mocked(api.getCopilotRerun).mockResolvedValue({
      ...rerunIntentFixture(),
      requestId: recovery.requestId,
    });
    fireEvent.click(button("Inspect rerun request"));
    await screen.findByRole("article");
    expect(api.getCopilotRerun).toHaveBeenCalledWith(
      rerunScope,
      recovery,
      expect.any(AbortSignal),
    );
    expect(button("Confirm new execution")).toBeDisabled();
    expect(api.prepareCopilotRerun).toHaveBeenCalledTimes(1);
    expect(api.changeCopilotRerun).not.toHaveBeenCalled();
  });
  it("lost Confirm and exact replay inspection recover fixed target without automatically confirming", async () => {
    vi.mocked(api.changeCopilotRerun).mockRejectedValue(new Error("lost"));
    renderActions();
    await prepare();
    consent();
    fireEvent.click(button("Confirm new execution"));
    await screen.findByRole("alert");
    expect(
      screen.queryByLabelText("Whole-job execution review"),
    ).not.toBeInTheDocument();
    vi.mocked(api.getCopilotRerun).mockResolvedValue(confirmedRerunFixture());
    fireEvent.click(button("Inspect rerun request"));
    await screen.findByText("New execution created");
    fireEvent.click(button("Inspect rerun request"));
    await screen.findByText("New execution created");
    expect(api.changeCopilotRerun).toHaveBeenCalledTimes(1);
    expect(api.prepareCopilotRerun).toHaveBeenCalledTimes(1);
    expect(api.getCopilotRerun).toHaveBeenCalledTimes(2);
  });
  it.each(["permission", "policy", "version", "expired"])(
    "%s conflict clears protected review and consent before inspection",
    async () => {
      vi.mocked(api.changeCopilotRerun).mockRejectedValue(new Error("409"));
      renderActions();
      await prepare();
      consent();
      fireEvent.click(button("Confirm new execution"));
      await screen.findByRole("alert");
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Whole-job execution review"),
      ).not.toBeInTheDocument();
      vi.mocked(api.getCopilotRerun).mockResolvedValue({
        ...rerunIntentFixture(),
        reviewStatus: "changed",
        canConfirm: false,
        review: undefined,
      });
      fireEvent.click(button("Inspect rerun request"));
      await screen.findByRole("article");
      expect(button("Confirm new execution")).toBeDisabled();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    },
  );
  it("revoked inspection removes protected evidence and does not leak raw errors", async () => {
    renderActions();
    await prepare();
    consent();
    vi.mocked(api.getCopilotRerun).mockRejectedValue(
      new Error("SECRET_PROVIDER_CONFIG"),
    );
    fireEvent.click(button("Inspect rerun request"));
    await screen.findByRole("alert");
    expect(
      screen.queryByLabelText("Whole-job execution review"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/SECRET_PROVIDER_CONFIG/),
    ).not.toBeInTheDocument();
  });
  it("scope/identity/permission changes clear protected review and isolate recovery", async () => {
    const view = renderActions();
    await prepare();
    consent();
    view.rerender(
      <CopilotRerunActions
        {...rerunScope}
        enabled
        authorizationRevision="revoked"
      />,
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await screen.findByRole("button", {
      name: "Inspect rerun request",
    });
    view.rerender(
      <CopilotRerunActions {...rerunScope} ownerId="someone-else" enabled />,
    );
    await screen.findByLabelText("Original job ID");
    expect(screen.queryByText(/Recovery request ID/)).not.toBeInTheDocument();
    view.rerender(
      <CopilotRerunActions
        {...rerunScope}
        projectId="another-project"
        originalRunId="another-run"
        enabled
      />,
    );
    await screen.findByLabelText("Original job ID");
    expect(screen.queryByText(/Recovery request ID/)).not.toBeInTheDocument();
  });
  it("focus during Confirm invalidates stale responses, preserving inspect-only recovery", async () => {
    let resolve!: (v: api.CopilotRerunIntent) => void;
    vi.mocked(api.changeCopilotRerun).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    renderActions();
    await prepare();
    consent();
    fireEvent.click(button("Confirm new execution"));
    fireEvent(window, new Event("focus"));
    await screen.findByRole("button", {
      name: "Inspect rerun request",
    });
    await act(async () => resolve(confirmedRerunFixture()));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("outcome is unknown");
    expect(readRerunRecovery(rerunScope)?.intentId).toBe("intent");
    expect(api.changeCopilotRerun).toHaveBeenCalledTimes(1);
  });
  it("prepared cancellation never cancels a target and does not confirm", async () => {
    vi.mocked(api.changeCopilotRerun).mockResolvedValue({
      ...rerunIntentFixture(),
      state: "cancelled",
      version: 2,
      cancelledAt: "2099-01-01T00:01:00Z",
      canConfirm: false,
      canCancelPrepared: false,
    });
    renderActions();
    await prepare();
    fireEvent.click(button("Cancel prepared request"));
    await screen.findByText(
      "Prepared request cancelled. No new execution was created.",
    );
    expect(api.changeCopilotRerun).toHaveBeenCalledWith(
      rerunScope,
      expect.anything(),
      "cancel-prepared",
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("uses server-time expiry, keeps the stable Confirm name and disables expired consent", async () => {
    vi.mocked(api.prepareCopilotRerun).mockResolvedValue({
      ...rerunIntentFixture(),
      expiresAt: "2099-01-01T00:00:01Z",
    });
    renderActions();
    await prepare();
    consent();
    await waitFor(
      () => expect(button("Confirm new execution")).toBeDisabled(),
      { timeout: 2500 },
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Prepared request expired",
    );
  });
  it("unsupported eligibility never exposes Prepare", async () => {
    vi.mocked(api.getCopilotRerunEligibility).mockResolvedValue({
      available: true,
      eligible: false,
      reasonCode: "unsupported",
      serverTime: "2099-01-01T00:00:00Z",
    });
    renderActions();
    await screen.findByLabelText("Original job ID");
    fireEvent.change(screen.getByLabelText("Original job ID"), {
      target: { value: "old-job" },
    });
    fireEvent.click(button("Check rerun eligibility"));
    await screen.findByText(/This original execution is unsupported/);
    expect(
      screen.queryByRole("button", { name: "Prepare new execution" }),
    ).not.toBeInTheDocument();
  });
  it("cannot submit Prepare if reload recovery storage is unavailable", async () => {
    renderActions();
    await eligible();
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    fireEvent.click(button("Prepare new execution"));
    await screen.findByRole("alert");
    expect(api.prepareCopilotRerun).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
