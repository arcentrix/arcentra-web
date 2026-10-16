import { beforeEach, expect, it, vi } from "vitest";
import { get } from "../client";
import { getFirstBuildReadiness } from ".";

vi.mock("../client", () => ({ get: vi.fn() }));
const restricted = {
  scopeOptions: [],
  scopeOptionsTruncated: false,
  canEnterScope: false,
  configuration: { access: "restricted" },
  agent: { access: "restricted" },
};
beforeEach(() => vi.resetAllMocks());

it("requests only the authenticated safe endpoint, with cancellation and no settings reads", async () => {
  const controller = new AbortController();
  vi.mocked(get).mockResolvedValue(restricted);
  expect(await getFirstBuildReadiness(controller.signal)).toEqual(restricted);
  expect(get).toHaveBeenCalledOnce();
  expect(get).toHaveBeenCalledWith("/me/first-build", {
    signal: controller.signal,
    silence: true,
  });
});

it("projects only safe booleans and role-grant IDs, dropping any unintended secret or identity fields", async () => {
  vi.mocked(get).mockResolvedValue({
    ...restricted,
    secret_key: "must-not-survive",
    scopeOptions: [
      { scopeId: "org-alpha", source: "role_grant", name: "not-an-org-record" },
    ],
    configuration: {
      access: "visible",
      defaultStorageConfigured: false,
      agentSigningConfigured: true,
      secret_key: "must-not-survive",
      salt: "must-not-survive",
    },
    agent: {
      access: "visible",
      enabledRecentlySeen: false,
      token: "must-not-survive",
      address: "must-not-survive",
    },
  });
  expect(await getFirstBuildReadiness()).toEqual({
    ...restricted,
    scopeOptions: [{ scopeId: "org-alpha", source: "role_grant" }],
    configuration: {
      access: "visible",
      defaultStorageConfigured: false,
      agentSigningConfigured: true,
    },
    agent: { access: "visible", enabledRecentlySeen: false },
  });
});

it("does not retain booleans or values from restricted observations", async () => {
  vi.mocked(get).mockResolvedValue({
    ...restricted,
    configuration: {
      access: "restricted",
      defaultStorageConfigured: true,
      secret_key: "secret",
    },
    agent: { access: "restricted", enabledRecentlySeen: true },
  });
  expect(await getFirstBuildReadiness()).toEqual(restricted);
});

it.each([
  null,
  { ...restricted, scopeOptions: null },
  { ...restricted, scopeOptions: [{ scopeId: "org", source: "organization" }] },
  { ...restricted, scopeOptions: [{ scopeId: "", source: "role_grant" }] },
  { ...restricted, scopeOptionsTruncated: "false" },
  {
    ...restricted,
    configuration: { access: "visible", defaultStorageConfigured: true },
  },
  { ...restricted, agent: { access: "unknown" } },
])(
  "rejects malformed snapshots instead of inventing choices or readiness: %j",
  async (value) => {
    vi.mocked(get).mockResolvedValue(value);
    await expect(getFirstBuildReadiness()).rejects.toThrow(
      "First-build status is unavailable.",
    );
  },
);

it("preserves request failures for explicit retry", async () => {
  vi.mocked(get).mockRejectedValue(new Error("Unavailable"));
  await expect(getFirstBuildReadiness()).rejects.toThrow("Unavailable");
});
