import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  inboxCountLabel,
  inboxTarget,
  inboxTitle,
  listInbox,
  markInboxRead,
  unreadInboxCount,
  type InboxItem,
} from "./index";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
const row: InboxItem = {
  id: "notice-1",
  kind: "run_result",
  status: "success",
  occurredAt: "2026-10-18T00:00:00Z",
  deliveredAt: "2026-10-18T00:00:01Z",
  readAt: null,
  availability: "available",
  target: {
    type: "run",
    runId: "run-1",
    projectId: "project-1",
    pipelineId: "pipeline-1",
  },
};
beforeEach(() => vi.resetAllMocks());
describe("inbox API boundary", () => {
  it("projects only safe fields, uses private read requests, and keeps opaque continuation", async () => {
    vi.mocked(get).mockResolvedValue({
      list: [
        {
          ...row,
          title: "Provider secret",
          reason: "secret",
          target: { ...row.target, url: "https://evil.test" },
        },
      ],
      nextCursor: "opaque",
      scanIncomplete: true,
    });
    const result = await listInbox("unread", "prior");
    expect(get).toHaveBeenCalledWith(
      "/inbox",
      expect.objectContaining({
        silence: true,
        redactErrors: true,
        params: { filter: "unread", limit: 20, cursor: "prior" },
      }),
    );
    expect(result.list).toEqual([row]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.nextCursor).toBe("opaque");
  });
  it.each(["approved", "rejected", "expired", "cancelled"] as const)(
    "accepts authoritative resolved request status %s",
    async (status) => {
      vi.mocked(get).mockResolvedValue({
        list: [{ ...row, kind: "approval_requested", status }],
        nextCursor: null,
        scanIncomplete: false,
      });
      expect((await listInbox("all", null)).list[0].status).toBe(status);
    },
  );
  it.each(["../bad", "https://evil.test", "id?token=secret", "", "<script>"])(
    "rejects unsafe IDs %s",
    async (id) => {
      vi.mocked(get).mockResolvedValue({
        list: [{ ...row, target: { ...row.target, runId: id } }],
        nextCursor: null,
        scanIncomplete: false,
      });
      await expect(listInbox("all", null)).rejects.toThrow(
        "could not be verified",
      );
    },
  );
  it("removes unavailable target links and does not derive pending resolution actions", async () => {
    vi.mocked(get).mockResolvedValue({
      list: [{ ...row, availability: "unavailable" }],
      nextCursor: null,
      scanIncomplete: false,
    });
    const result = (await listInbox("all", null)).list[0];
    expect(result.target).toBeNull();
    expect(inboxTarget(result)).toBeNull();
    expect(
      inboxTarget({ ...row, availability: "awaiting_resolution" }),
    ).toBeNull();
  });
  it("rejects invented kinds/statuses and invalid count contracts", async () => {
    vi.mocked(get).mockResolvedValue({
      list: [{ ...row, kind: "provider_message" }],
      nextCursor: null,
      scanIncomplete: false,
    });
    await expect(listInbox("all", null)).rejects.toThrow();
    for (const count of [
      { count: -1, capped: false, incomplete: false },
      { count: 100, capped: true, incomplete: false },
      { count: 1, capped: true, incomplete: false },
    ]) {
      vi.mocked(get).mockResolvedValue(count);
      await expect(unreadInboxCount()).rejects.toThrow();
    }
  });
  it("marks only the explicit item with an empty body and validates its confirmation", async () => {
    vi.mocked(post).mockResolvedValue({ id: row.id, readAt: row.deliveredAt });
    await markInboxRead(row.id);
    expect(post).toHaveBeenCalledWith(
      "/inbox/notice-1/read",
      {},
      expect.objectContaining({ silence: true, redactErrors: true }),
    );
    vi.mocked(post).mockResolvedValue({
      id: "foreign",
      readAt: row.deliveredAt,
    });
    await expect(markInboxRead(row.id)).rejects.toThrow();
  });
  it("labels capped, incomplete, exact and unavailable counts honestly", () => {
    expect(
      inboxCountLabel({ count: 99, capped: false, incomplete: false }),
    ).toBe("99 unread");
    expect(inboxCountLabel({ count: 99, capped: true, incomplete: true })).toBe(
      "99+ unread",
    );
    expect(inboxCountLabel({ count: 3, capped: false, incomplete: true })).toBe(
      "At least 3 unread",
    );
    expect(inboxCountLabel({ count: 0, capped: false, incomplete: true })).toBe(
      "Unread count unavailable",
    );
    expect(
      inboxCountLabel({ count: 0, capped: false, incomplete: false }),
    ).toBe("0 unread");
    expect(inboxCountLabel()).toBe("Unread count unavailable");
    expect(inboxTitle(row)).toBe("Run succeeded");
  });
});

describe("strict Inbox timestamps", () => {
  const invalidDates = [
    "2026-10-18 (Provider secret)",
    "0",
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "1900-02-29T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-10-18",
    "2026-10-18T12:00:00",
    "Sun, 18 Oct 2026 12:00:00 GMT",
    "2026-10-18T12:00:00Z (Provider secret)",
    "2026-10-18T24:00:00Z",
    "2026-10-18T12:60:00Z",
    "2026-10-18T12:00:60Z",
    "2026-10-18T12:00:00+24:00",
    "2026-10-18T12:00:00+00:60",
    "2026-10-18T12:00:00.1234567890Z",
    "2026-13-01T00:00:00Z",
    "2026-00-01T00:00:00Z",
    "2026-01-00T00:00:00Z",
    "0000-01-01T00:00:00Z",
    " 2026-10-18T12:00:00Z",
    "2026-10-18T12:00:00Z\n",
    "2026-10-18T12:00:00Z" + "x".repeat(65),
  ];
  it.each(invalidDates)(
    "rejects malformed timestamp %s in every response field",
    async (value) => {
      for (const field of ["occurredAt", "deliveredAt", "readAt"]) {
        vi.mocked(get).mockResolvedValue({
          list: [{ ...row, [field]: value }],
          nextCursor: null,
          scanIncomplete: false,
        });
        await expect(listInbox("all", null)).rejects.toThrow(
          "Inbox response could not be verified.",
        );
      }
      vi.mocked(post).mockResolvedValue({ id: row.id, readAt: value });
      await expect(markInboxRead(row.id)).rejects.toThrow(
        "Inbox response could not be verified.",
      );
    },
  );
  it.each([
    "2024-02-29T23:59:59Z",
    "2000-02-29T00:00:00.123456789Z",
    "2026-10-18T12:00:00+05:30",
    "2026-10-18T12:00:00.1-07:00",
  ])("preserves a valid ISO instant %s exactly", async (value) => {
    vi.mocked(get).mockResolvedValue({
      list: [{ ...row, occurredAt: value, deliveredAt: value, readAt: value }],
      nextCursor: null,
      scanIncomplete: false,
    });
    expect((await listInbox("all", null)).list[0]).toMatchObject({
      occurredAt: value,
      deliveredAt: value,
      readAt: value,
    });
    vi.mocked(post).mockResolvedValue({ id: row.id, readAt: value });
    expect(await markInboxRead(row.id)).toEqual({ id: row.id, readAt: value });
  });
});
