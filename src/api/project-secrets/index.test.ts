import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, patch, post } from "../client";
import {
  createProjectSecret,
  disableProjectSecret,
  listProjectSecrets,
  rotateProjectSecret,
  updateProjectSecret,
  validSecretValue,
} from ".";
vi.mock("../client", () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
export const secret = {
  projectId: "project-1",
  secretId: "secret-1",
  name: "CI_TOKEN",
  secretType: "token",
  description: "Synthetic build credential metadata",
  version: "opaque-v1",
  isEnabled: 1,
  configured: true,
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  canUpdate: true,
  canRotate: true,
  canDisable: true,
};
const inventory = {
  projectId: "project-1",
  list: [secret],
  total: 1,
  canCreate: true,
  canWrite: true,
  canDisable: true,
  projectActive: true,
  encryptionConfigured: true,
};
beforeEach(() => vi.resetAllMocks());
describe("project secret metadata boundary", () => {
  it("reads only the encoded routed project and projects exact metadata", async () => {
    vi.mocked(get).mockResolvedValue(inventory);
    expect(await listProjectSecrets("project-1")).toEqual(inventory);
    expect(get).toHaveBeenCalledWith("/project/project-1/secrets", {
      signal: undefined,
      silence: true,
      redactErrors: true,
    });
  });
  it.each([
    { ...inventory, projectId: "foreign" },
    { ...inventory, total: 2 },
    { ...inventory, canCreate: false },
    { ...inventory, canWrite: "true" },
    { ...inventory, list: [{ ...secret, projectId: "foreign" }] },
    {
      ...inventory,
      list: [{ ...secret, value: "synthetic-unexpected-value" }],
    },
    {
      ...inventory,
      list: [{ ...secret, encryptedValue: "synthetic-ciphertext" }],
    },
    { ...inventory, list: [{ ...secret, version: 1 }] },
    { ...inventory, list: [{ ...secret, createdAt: "invalid" }] },
    { ...inventory, list: [{ ...secret, secretType: "unknown" }] },
    { ...inventory, list: [{ ...secret, isEnabled: 0 }] },
    { ...inventory, list: [secret, secret], total: 2 },
  ])(
    "rejects unverified or potentially value-bearing metadata",
    async (value) => {
      vi.mocked(get).mockResolvedValue(value);
      await expect(listProjectSecrets("project-1")).rejects.toThrow(
        "metadata could not be verified",
      );
    },
  );
  it("recognizes a complete empty inventory without inventing records", async () => {
    vi.mocked(get).mockResolvedValue({ ...inventory, list: null, total: 0 });
    expect((await listProjectSecrets("project-1")).list).toEqual([]);
  });
  it("uses live capabilities with missing encryption while retaining metadata operations", async () => {
    vi.mocked(get).mockResolvedValue({
      ...inventory,
      encryptionConfigured: false,
      canCreate: false,
      list: [{ ...secret, canRotate: false }],
    });
    const result = await listProjectSecrets("project-1");
    expect(result.list[0].canUpdate).toBe(true);
    expect(result.canCreate).toBe(false);
  });
});
describe("write-only scoped secret operations", () => {
  it("creates an exact payload without injecting scope or identifiers", async () => {
    vi.mocked(post).mockResolvedValue(secret);
    await createProjectSecret("project-1", {
      name: "CI_TOKEN",
      secretType: "token",
      description: "",
      value: "synthetic-ci-secret-initial001",
      projectId: "foreign",
    } as never);
    expect(post).toHaveBeenCalledWith(
      "/project/project-1/secrets",
      {
        name: "CI_TOKEN",
        secretType: "token",
        description: "",
        value: "synthetic-ci-secret-initial001",
      },
      { silence: true, redactErrors: true },
    );
  });
  it("metadata PATCH never includes values or immutable fields", async () => {
    vi.mocked(patch).mockResolvedValue({
      ...secret,
      version: "opaque-v2",
      description: "Updated",
    });
    await updateProjectSecret("project-1", "secret-1", {
      version: "opaque-v1",
      description: "Updated",
      value: "synthetic-unwanted-value",
      name: "CHANGED",
    } as never);
    expect(patch).toHaveBeenCalledWith(
      "/project/project-1/secrets/secret-1",
      { version: "opaque-v1", description: "Updated" },
      { silence: true, redactErrors: true },
    );
  });
  it("rotates and disables with the exact opaque version", async () => {
    vi.mocked(post)
      .mockResolvedValueOnce({ ...secret, version: "opaque-v2" })
      .mockResolvedValueOnce({
        ...secret,
        version: "opaque-v3",
        isEnabled: 0,
        canUpdate: false,
        canRotate: false,
        canDisable: false,
      });
    await rotateProjectSecret("project-1", "secret-1", {
      version: "opaque-v1",
      value: "synthetic-ci-secret-rotated001",
    });
    await disableProjectSecret("project-1", "secret-1", "opaque-v2");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/project/project-1/secrets/secret-1/rotate",
      { version: "opaque-v1", value: "synthetic-ci-secret-rotated001" },
      { silence: true, redactErrors: true },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/project/project-1/secrets/secret-1/disable",
      { version: "opaque-v2" },
      { silence: true, redactErrors: true },
    );
  });
  it.each([
    "",
    " ",
    "********",
    "••••••••",
    "[REDACTED]",
    "configured",
    "a".repeat(65537),
    "界".repeat(21846),
  ])(
    "rejects blank, mask, and oversized input without sending",
    async (value) => {
      expect(validSecretValue(value)).toBe(false);
      await expect(
        rotateProjectSecret("project-1", "secret-1", {
          version: "opaque-v1",
          value,
        }),
      ).rejects.toThrow("Enter a new secret value");
      expect(post).not.toHaveBeenCalled();
    },
  );
});

describe("verified mutation receipts", () => {
  it("rejects unchanged versions instead of announcing a successful update", async () => {
    vi.mocked(patch).mockResolvedValue({ ...secret, description: "Updated" });
    await expect(
      updateProjectSecret("project-1", "secret-1", {
        version: "opaque-v1",
        description: "Updated",
      }),
    ).rejects.toThrow("metadata could not be verified");
  });
  it("rejects a rotation receipt without a new version", async () => {
    vi.mocked(post).mockResolvedValue(secret);
    await expect(
      rotateProjectSecret("project-1", "secret-1", {
        version: "opaque-v1",
        value: "synthetic-ci-secret-rotated001",
      }),
    ).rejects.toThrow("metadata could not be verified");
  });
  it("rejects a disable receipt that leaves the secret enabled", async () => {
    vi.mocked(post).mockResolvedValue({ ...secret, version: "opaque-v2" });
    await expect(
      disableProjectSecret("project-1", "secret-1", "opaque-v1"),
    ).rejects.toThrow("metadata could not be verified");
  });
});

describe("backend-aligned secret boundaries", () => {
  it.each([999, 1000])(
    "accepts a complete %s-row inventory with exact creation capability",
    async (total) => {
      const list = Array.from({ length: total }, (_, index) => ({
        ...secret,
        secretId: `secret-${index}`,
        name: `CI_TOKEN_${index}`,
      }));
      vi.mocked(get).mockResolvedValue({
        ...inventory,
        list,
        total,
        canCreate: total < 1000,
      });
      const result = await listProjectSecrets("project-1");
      expect(result.total).toBe(total);
      expect(result.canCreate).toBe(total < 1000);
      expect(result.list[0].canUpdate).toBe(true);
    },
  );
  it("rejects overflow and an inconsistent create capability at the limit", async () => {
    const list = Array.from({ length: 1000 }, (_, index) => ({
      ...secret,
      secretId: `secret-${index}`,
      name: `CI_TOKEN_${index}`,
    }));
    vi.mocked(get).mockResolvedValue({ ...inventory, list, total: 1000 });
    await expect(listProjectSecrets("project-1")).rejects.toThrow(
      "metadata could not be verified",
    );
    vi.mocked(get).mockResolvedValue({
      ...inventory,
      list,
      total: 1001,
      canCreate: false,
    });
    await expect(listProjectSecrets("project-1")).rejects.toThrow(
      "metadata could not be verified",
    );
  });
  it("accepts 4,096 supplementary Unicode characters in read and write descriptions", async () => {
    const description = "😀".repeat(4096);
    vi.mocked(get).mockResolvedValue({
      ...inventory,
      list: [{ ...secret, description }],
    });
    expect((await listProjectSecrets("project-1")).list[0].description).toBe(
      description,
    );
    vi.mocked(patch).mockResolvedValue({
      ...secret,
      version: "opaque-v2",
      description,
    });
    await expect(
      updateProjectSecret("project-1", "secret-1", {
        version: "opaque-v1",
        description,
      }),
    ).resolves.toMatchObject({ description });
    await expect(
      updateProjectSecret("project-1", "secret-1", {
        version: "opaque-v1",
        description: description + "😀",
      }),
    ).rejects.toThrow("metadata could not be verified");
  });
  it.each([
    "a\0b",
    "***MASKED***",
    "[masked]",
    "_<MASKED>_",
    "●●●",
    "*•●",
    "\u0085",
    "\u2003",
    "\ud800",
    "configured",
    "[configured]",
  ])("rejects the backend's invalid or placeholder input %#", async (value) => {
    expect(validSecretValue(value)).toBe(false);
    await expect(
      rotateProjectSecret("project-1", "secret-1", {
        version: "opaque-v1",
        value,
      }),
    ).rejects.toThrow("Enter a new secret value");
    expect(post).not.toHaveBeenCalled();
  });
  it.each([
    "legitimate-masked-word",
    "masked-value",
    "\ufeff",
    "a".repeat(65536),
    "😀".repeat(16384),
  ])(
    "accepts valid backend boundaries without broad mask-word filtering %#",
    (value) => {
      expect(validSecretValue(value)).toBe(true);
    },
  );
});
