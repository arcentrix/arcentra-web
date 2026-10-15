import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { get, post } from "@/api/client";
import { RunApprovals } from "./run-approvals";
import { retryFixture, retryScope } from "./retry-approval.test-fixture";
vi.mock("@/api/client", () => ({ get: vi.fn(), post: vi.fn() }));
let fixture: ReturnType<typeof retryFixture>;
function read(url: string) {
  if (url === "/approvals/") return [fixture.approval];
  if (url === "/approvals/approval") return structuredClone(fixture.approval);
  if (url === "/pipelines/pipeline")
    return { pipelineId: "pipeline", projectId: "project" };
  if (url === "/pipelines/pipeline/runs/run") return { ...fixture.run };
  throw new Error(`Unexpected request ${url}`);
}
beforeEach(() => {
  fixture = retryFixture();
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
    screen.getByText("2 total attempts, including the first"),
  ).toBeInTheDocument();
  expect(screen.getByText(/producer \/ producer-step/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Approve retry plan" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Decision reason (optional)"), {
    target: { value: "Reviewed exact inputs" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve retry plan" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith(
    "/approvals/approval/approve",
    { reason: "Reviewed exact inputs" },
    { silence: true },
  );
  expect(
    vi.mocked(get).mock.calls.filter(([url]) => url === "/approvals/approval")
      .length,
  ).toBeGreaterThanOrEqual(2);
});
it("rereads evidence and refuses a changed plan without writing", async () => {
  show();
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  fixture.evidence.retryPlan.steps[0].definitionDigest = "v1:" + "f".repeat(64);
  fireEvent.click(screen.getByRole("button", { name: "Approve retry plan" }));
  await screen.findByRole("alert");
  expect(post).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
});
it("refuses revoked current eligibility on preflight", async () => {
  show();
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  fixture.approval.canApprove = false;
  fireEvent.click(screen.getByRole("button", { name: "Approve retry plan" }));
  await screen.findByRole("alert");
  expect(post).not.toHaveBeenCalled();
});
it("keeps ambiguous decision failures visible and never retries automatically", async () => {
  vi.mocked(post).mockRejectedValue(new Error("connection lost"));
  show();
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Approve retry plan" }));
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
          finish = () => resolve(structuredClone(fixture.approval) as never);
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
          finish = () => resolve(structuredClone(fixture.approval) as never);
        })
      : Promise.resolve(read(url) as never),
  );
  fireEvent.click(screen.getByRole("button", { name: "Approve retry plan" }));
  view.unmount();
  await act(async () => finish?.());
  expect(post).not.toHaveBeenCalled();
});
it.each(["expired", "cancelled", "wrong project"])(
  "refuses %s review",
  async (reason) => {
    if (reason === "expired") {
      fixture.evidence.createdAtUnixMilli = Date.now() - 3_600_001;
      fixture.evidence.expiresAtUnixMilli = Date.now() - 1;
      fixture.approval.expiresAt = new Date(
        fixture.evidence.expiresAtUnixMilli,
      ).toISOString();
    } else if (reason === "cancelled") fixture.run.status = "cancelled";
    else fixture.evidence.context.projectId = "other";
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Review approval approval" }),
    );
    if (reason === "wrong project") await screen.findByRole("alert");
    else await screen.findByText(fixture.evidence.inputs.sourceCommit);
    expect(
      screen.getByRole("button", { name: "Approve retry plan" }),
    ).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  },
);
