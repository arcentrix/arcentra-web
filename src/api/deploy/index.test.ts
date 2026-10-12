import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post } from "../client";
import {
  advanceRelease,
  cancelRelease,
  createEnvironment,
  createRelease,
  listEnvironments,
  listReleases,
  getRelease,
  inspectRelease,
  recoverRelease,
} from ".";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(get).mockResolvedValue({
    list: null,
    total: 0,
    page: 1,
    pageSize: 20,
  });
});
describe("deployment API scope", () => {
  it("encodes project and release identities, normalizes empty lists, and preserves abort", async () => {
    const controller = new AbortController();
    expect(
      (await listEnvironments("project / one", 2, controller.signal)).list,
    ).toEqual([]);
    expect(get).toHaveBeenCalledWith(
      "/projects/project%20%2F%20one/environments",
      {
        params: { page: 2, pageSize: 20 },
        signal: controller.signal,
        silence: true,
      },
    );
    await listReleases("one");
    await advanceRelease("one", "release/a");
    await cancelRelease("one", "release/a");
    expect(post).toHaveBeenCalledWith(
      "/projects/one/releases/release%2Fa/advance",
      {},
      { silence: true },
    );
    expect(post).toHaveBeenCalledWith(
      "/projects/one/releases/release%2Fa/cancel",
      {},
      { silence: true },
    );
  });
  it("sends immutable source selection without an arbitrary image or cluster address", async () => {
    const source = {
      requestId: "req",
      environmentId: "env",
      pipelineId: "pipe",
      pipelineRunId: "run",
      artifactId: "artifact",
    };
    await createRelease("one", source);
    expect(post).toHaveBeenCalledWith("/projects/one/releases", source, {
      silence: true,
    });
    const target = {
      name: "Staging",
      targetRef: "operator-ref",
      namespace: "stage",
      deployment: "web",
      container: "app",
    };
    await createEnvironment("one", target);
    expect(post).toHaveBeenCalledWith("/projects/one/environments", target, {
      silence: true,
    });
  });
});

it("reads release status only within the exact project and release scope", async () => {
  const controller = new AbortController();
  vi.mocked(get).mockResolvedValue({
    projectId: "one/a",
    releaseId: "release/a",
    status: "applying",
  });
  expect(
    await getRelease("one/a", "release/a", controller.signal),
  ).toMatchObject({ status: "applying" });
  expect(get).toHaveBeenCalledWith("/projects/one%2Fa/releases/release%2Fa", {
    signal: controller.signal,
    silence: true,
  });
  vi.mocked(get).mockResolvedValue({
    projectId: "other",
    releaseId: "release/a",
  });
  await expect(getRelease("one/a", "release/a")).rejects.toThrow(
    "does not match",
  );
});

it("keeps read-only inspection separate from explicit same-release recovery payload", async () => {
  vi.mocked(get).mockResolvedValue({
    releaseId: "release/a",
    persistedStatus: "applying",
    status: "observing",
  });
  await inspectRelease("one/a", "release/a");
  expect(get).toHaveBeenCalledWith(
    "/projects/one%2Fa/releases/release%2Fa/inspect",
    { silence: true },
  );
  expect(post).not.toHaveBeenCalled();
  await recoverRelease("one/a", "release/a");
  expect(post).toHaveBeenCalledWith(
    "/projects/one%2Fa/releases/release%2Fa/recover",
    { confirmRecovery: true },
    { silence: true },
  );
});
