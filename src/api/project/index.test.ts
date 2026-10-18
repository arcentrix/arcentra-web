import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import { listProjectMembers } from "./index";

vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe("project member association reads", () => {
  it("encodes the project ID, supports cancellation, and exposes only actual association fields", async () => {
    const signal = new AbortController().signal;
    vi.mocked(get).mockResolvedValue({
      list: [
        {
          projectId: "project/a",
          userId: "user-one",
          role: "owner",
          name: "Unverified name",
          email: "unverified@example.test",
        },
      ],
      total: 1,
    });
    expect(await listProjectMembers("project/a", signal)).toEqual({
      list: [{ projectId: "project/a", userId: "user-one" }],
      total: 1,
    });
    expect(get).toHaveBeenCalledWith("/project/project%2Fa/members", {
      signal,
      silence: true,
      redactErrors: true,
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it.each([null, []])(
    "accepts an explicitly empty association response (%j)",
    async (list) => {
      vi.mocked(get).mockResolvedValue({ list, total: 0 });
      expect(await listProjectMembers("project-a")).toEqual({
        list: [],
        total: 0,
      });
    },
  );

  it.each([
    null,
    {},
    { list: "not a list", total: 0 },
    { list: null, total: 1 },
    { list: [], total: -1 },
    { list: [], total: "0" },
    {
      list: [{ projectId: "other-project", userId: "private-user" }],
      total: 1,
    },
    { list: [{ userId: "user-one" }], total: 1 },
    { list: [{ projectId: "project-a", userId: " " }], total: 1 },
    { list: [{ projectId: "project-a", userId: 42 }], total: 1 },
    {
      list: [
        { projectId: "project-a", userId: "one" },
        { projectId: "project-a", userId: "one" },
      ],
      total: 2,
    },
  ])(
    "rejects unverifiable or wrong-project association responses (%j)",
    async (response) => {
      vi.mocked(get).mockResolvedValue(response);
      await expect(listProjectMembers("project-a")).rejects.toThrow(
        "Project member associations could not be verified.",
      );
    },
  );

  it("preserves backend read errors rather than treating failure as an empty directory", async () => {
    const failure = new Error("Read failed");
    vi.mocked(get).mockRejectedValue(failure);
    await expect(listProjectMembers("project-a")).rejects.toBe(failure);
  });

  it("does not issue a request without a project ID", async () => {
    await expect(listProjectMembers(" ")).rejects.toThrow(
      "A project ID is required.",
    );
    expect(get).not.toHaveBeenCalled();
  });
});
