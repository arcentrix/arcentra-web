import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post, put, del } from "../client";
import {
  listScopedMembers,
  addScopedMember,
  updateScopedMember,
  removeScopedMember,
} from ".";
vi.mock("../client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
const row = {
  projectId: "project/a",
  userId: "user-one",
  username: "sample",
  displayName: "Sample",
  roleId: "project_developer",
  version: 2,
  hasOtherAccess: true,
  isProtectedOwner: false,
};
const response = {
  list: [row],
  total: 1,
  canManageMembers: true,
  canAssignOwner: false,
  assignableRoleIds: ["project_developer", "project_reporter", "project_guest"],
};
describe("managed scoped membership contract", () => {
  it("verifies scope and strips unrelated fields without consulting global users", async () => {
    vi.mocked(get).mockResolvedValue({
      ...response,
      list: [{ ...row, email: "PRIVATE-CANARY", accessToken: "CANARY" }],
    });
    const signal = new AbortController().signal;
    expect(await listScopedMembers("project", "project/a", signal)).toEqual(
      response,
    );
    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith("/project/project%2Fa/members", {
      signal,
      silence: true,
      redactErrors: true,
    });
  });
  it.each([
    { ...row, projectId: "other" },
    { ...row, roleId: "platform_admin" },
    { ...row, roleId: "org_owner" },
    { ...row, version: 0 },
    { ...row, userId: "" },
    { ...row, isProtectedOwner: "true" },
  ])("rejects malformed or cross-scope member %j", async (member) => {
    vi.mocked(get).mockResolvedValue({ ...response, list: [member] });
    await expect(listScopedMembers("project", "project/a")).rejects.toThrow(
      "could not be verified",
    );
  });
  it("supports a legacy association with no managed role, without claiming a grant", async () => {
    vi.mocked(get).mockResolvedValue({
      ...response,
      list: [{ ...row, roleId: "" }],
    });
    expect(
      (await listScopedMembers("project", "project/a")).list[0].roleId,
    ).toBe("");
  });
  it("encodes mutations and sends optimistic version checks only to the selected scope", async () => {
    await addScopedMember("org", "org/a", {
      userId: "user/b",
      roleId: "org_member",
    });
    await updateScopedMember("project", "project/a", "user/b", {
      roleId: "project_reporter",
      version: 2,
    });
    await removeScopedMember("project", "project/a", "user/b", 3);
    expect(post).toHaveBeenCalledWith(
      "/organization/org%2Fa/members",
      { userId: "user/b", roleId: "org_member" },
      { silence: true, redactErrors: true },
    );
    expect(put).toHaveBeenCalledWith(
      "/project/project%2Fa/members/user%2Fb",
      { roleId: "project_reporter", version: 2 },
      { silence: true, redactErrors: true },
    );
    expect(del).toHaveBeenCalledWith("/project/project%2Fa/members/user%2Fb", {
      data: { version: 3 },
      silence: true,
      redactErrors: true,
    });
  });
});
