import { beforeEach, expect, it, vi } from "vitest";
import { get, post, put, del } from "../client";
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from ".";
vi.mock("../client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
const org = {
  orgId: "org-one",
  name: "sample",
  displayName: "Sample",
  description: "",
  website: "",
  email: "",
  ownerUserId: "creator",
  status: 1,
  isEnabled: 1,
  version: 1,
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  isMember: false,
  canUpdate: false,
  canManageMembers: false,
  canArchive: false,
};
beforeEach(() => vi.resetAllMocks());
it("lists only verified directory records and preserves explicit non-membership", async () => {
  vi.mocked(get).mockResolvedValue({
    list: [{ ...org, scopeId: "legacy", password: "CANARY" }],
    total: 1,
    page: 1,
    pageSize: 20,
    canCreate: false,
  });
  const signal = new AbortController().signal;
  expect(await getOrganizations({}, signal)).toEqual({
    list: [org],
    total: 1,
    page: 1,
    pageSize: 20,
    canCreate: false,
  });
  expect(get).toHaveBeenCalledWith("/organization", {
    params: { page: 1, pageSize: 20 },
    signal,
    silence: true,
    redactErrors: true,
  });
});
it.each([
  { ...org, orgId: "foreign" },
  { ...org, version: 0 },
  { ...org, isMember: "true" },
  { scopeId: "org-one", name: "legacy scope" },
])("rejects foreign/unverifiable directory data %j", async (row) => {
  vi.mocked(get).mockResolvedValue(row);
  await expect(getOrganization("org-one")).rejects.toThrow(
    "could not be verified",
  );
});
it("creates only new records and version-checks update/archive without implicit adoption", async () => {
  vi.mocked(post).mockResolvedValue(org);
  vi.mocked(put).mockResolvedValue(org);
  const data = {
    name: "sample",
    displayName: "Sample",
    description: "",
    website: "",
    email: "",
  };
  await createOrganization(data);
  const { name: _name, ...metadata } = data;
  await updateOrganization("org-one", { ...metadata, version: 1 });
  await deleteOrganization("org-one", 2);
  expect(post).toHaveBeenCalledWith("/organization", data, {
    silence: true,
    redactErrors: true,
  });
  expect(put).toHaveBeenCalledWith(
    "/organization/org-one",
    { ...metadata, version: 1 },
    { silence: true, redactErrors: true },
  );
  expect(del).toHaveBeenCalledWith("/organization/org-one", {
    data: { version: 2 },
    silence: true,
    redactErrors: true,
  });
});
