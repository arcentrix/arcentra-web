import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, put } from "../client";
import { listUsersByRole, resetPassword, resetUserPassword } from "./index";

vi.mock("../client", () => ({
  get: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  put: vi.fn().mockResolvedValue(undefined),
  post: vi.fn(),
  generateRequestKey: (url: string) => url,
  dedupeRequest: (_key: string, callback: () => unknown) => callback(),
}));
beforeEach(() => vi.clearAllMocks());

describe("user management backend contract", () => {
  it("uses the backend's roleID query parameter", async () => {
    await listUsersByRole("role/test", 2, 10, { silence: true });
    expect(get).toHaveBeenCalledWith(
      "/users/by-role?roleID=role%2Ftest&page=2&pageSize=10",
      { silence: true },
    );
  });
  it("uses newPassword for an administrator password reset", async () => {
    await resetUserPassword("user/test", "synthetic-new-password");
    expect(put).toHaveBeenCalledWith("/users/user%2Ftest/password", {
      newPassword: btoa("synthetic-new-password"),
    });
  });
  it("retains the authenticated me alias and self-service password fields", async () => {
    await resetPassword("synthetic-old", "synthetic-new");
    expect(put).toHaveBeenCalledWith("/users/me/password", {
      oldPassword: btoa("synthetic-old"),
      newPassword: btoa("synthetic-new"),
    });
  });
});
