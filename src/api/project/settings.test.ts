import { beforeEach, expect, it, vi } from "vitest";
import { get, patch, post } from "../client";
import {
  getProjectSettings,
  updateProjectSettings,
  archiveProject,
  restoreProject,
} from "./settings";
vi.mock("../client", () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
const settings = {
  projectId: "project/a",
  orgId: "legacy-scope",
  name: "sample",
  displayName: "Sample",
  description: "",
  defaultBranch: "main",
  tags: "",
  language: "",
  framework: "",
  visibility: 0,
  status: 1,
  isEnabled: 1,
  version: "opaque-version",
  canUpdate: true,
  canArchive: true,
  canRestore: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  for (const mock of [get, patch, post])
    vi.mocked(mock).mockResolvedValue(settings);
});
it("uses the narrow project endpoint, binds identity, and strips unknown credential fields", async () => {
  vi.mocked(get).mockResolvedValue({
    ...settings,
    repoUrl: "SECRET-CANARY",
    authConfig: { password: "CANARY" },
  });
  const signal = new AbortController().signal;
  expect(await getProjectSettings("project/a", signal)).toEqual(settings);
  expect(get).toHaveBeenCalledWith("/project/project%2Fa/settings", {
    signal,
    silence: true,
    redactErrors: true,
  });
});
it.each([
  { ...settings, projectId: "other" },
  { ...settings, visibility: 9 },
  { ...settings, version: "" },
  { ...settings, canUpdate: "true" },
])("rejects malformed settings %j", async (value) => {
  vi.mocked(get).mockResolvedValue(value);
  await expect(getProjectSettings("project/a")).rejects.toThrow(
    "could not be verified",
  );
});
it("updates via PATCH and archives/restores only with explicit versioned actions", async () => {
  const draft = {
    displayName: "Updated",
    description: "",
    defaultBranch: "release",
    tags: "one,two",
    language: "Go",
    framework: "",
    visibility: 1,
    version: settings.version,
  };
  await updateProjectSettings("project/a", draft);
  await archiveProject("project/a", settings.version);
  await restoreProject("project/a", "latest-version");
  expect(patch).toHaveBeenCalledOnce();
  expect(patch).toHaveBeenCalledWith("/project/project%2Fa/settings", draft, {
    silence: true,
    redactErrors: true,
  });
  expect(post).toHaveBeenNthCalledWith(
    1,
    "/project/project%2Fa/settings/archive",
    { version: settings.version },
    { silence: true, redactErrors: true },
  );
  expect(post).toHaveBeenNthCalledWith(
    2,
    "/project/project%2Fa/settings/restore",
    { version: "latest-version" },
    { silence: true, redactErrors: true },
  );
});
