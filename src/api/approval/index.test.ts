import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  approvalCandidates,
  decideApproval,
  getApproval,
  listRunApprovals,
} from ".";
import type { ApprovalRequest } from ".";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
const approval = {
  approvalId: "approval/a",
  pipelineRunId: "run/a",
  status: 0,
  candidateApprovers: '["operator-1","operator-2"]',
} as ApprovalRequest;
beforeEach(() => vi.resetAllMocks());
describe("durable approval API contracts", () => {
  it("lists only an explicit run using the authenticated API and accepts an empty raw array", async () => {
    const controller = new AbortController();
    vi.mocked(get).mockResolvedValue([approval]);
    expect(await listRunApprovals("run/a", controller.signal)).toEqual([
      approval,
    ]);
    expect(get).toHaveBeenCalledWith("/approvals/", {
      params: { pipeline_run_id: "run/a" },
      signal: controller.signal,
      silence: true,
    });
    vi.mocked(get).mockResolvedValue(null);
    expect(await listRunApprovals("run/a")).toEqual([]);
    vi.mocked(get).mockResolvedValue({ list: [approval] });
    await expect(listRunApprovals("run/a")).rejects.toThrow(
      "list response is invalid",
    );
  });
  it("rejects cross-run, cross-approval, and unknown-status responses", async () => {
    vi.mocked(get).mockResolvedValue([{ ...approval, pipelineRunId: "other" }]);
    await expect(listRunApprovals("run/a")).rejects.toThrow("does not match");
    for (const invalid of [
      { ...approval, approvalId: "other" },
      { ...approval, status: 99 },
    ]) {
      vi.mocked(get).mockResolvedValue(invalid);
      await expect(getApproval("run/a", "approval/a")).rejects.toThrow(
        "does not match",
      );
    }
  });
  it("encodes detail and decision paths; submits only a reason and preserves server status", async () => {
    vi.mocked(get).mockResolvedValue(approval);
    const controller = new AbortController();
    await getApproval("run/a", "approval/a", controller.signal);
    expect(get).toHaveBeenCalledWith("/approvals/approval%2Fa", {
      signal: controller.signal,
      silence: true,
    });
    vi.mocked(post).mockResolvedValue({
      ...approval,
      approvedCount: 1,
      status: 0,
    });
    expect(
      await decideApproval(
        "run/a",
        "approval/a",
        "approve",
        "Reviewed artifact",
      ),
    ).toMatchObject({ status: 0 });
    expect(post).toHaveBeenCalledWith(
      "/approvals/approval%2Fa/approve",
      { reason: "Reviewed artifact" },
      { silence: true },
    );
    await decideApproval("run/a", "approval/a", "reject", "Wrong release");
    expect(post).toHaveBeenLastCalledWith(
      "/approvals/approval%2Fa/reject",
      { reason: "Wrong release" },
      { silence: true },
    );
  });
  it("bounds UTF-8 reason bytes before sending and never invents candidate identities", async () => {
    await expect(
      decideApproval("run/a", "approval/a", "approve", "😀".repeat(513)),
    ).rejects.toThrow("2,048");
    expect(post).not.toHaveBeenCalled();
    expect(approvalCandidates(approval)).toEqual(["operator-1", "operator-2"]);
    for (const candidateApprovers of [
      "broken",
      '["requester"]',
      '["duplicate","duplicate"]',
      '[" padded"]',
      '"user"',
      '["operator",42]',
      "[]",
    ])
      expect(
        approvalCandidates({
          ...approval,
          requestedBy: "requester",
          candidateApprovers,
        }),
      ).toEqual([]);
  });
});
