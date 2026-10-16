import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getFirstBuildReadiness,
  type FirstBuildReadiness,
} from "@/api/first-build";
import { useFirstBuild } from "./use-first-build";

const session = vi.hoisted(() => ({
  initialized: false,
  accessToken: "",
  userId: "",
}));
vi.mock("@/api/first-build", () => ({ getFirstBuildReadiness: vi.fn() }));
vi.mock("@/store/auth", () => ({ default: { useState: () => session } }));
vi.mock("@/store/user", () => ({
  default: {
    useState: () => ({
      userinfo: session.userId ? { userId: session.userId } : null,
    }),
  },
}));
const snapshot: FirstBuildReadiness = {
  scopeOptions: [],
  scopeOptionsTruncated: false,
  canEnterScope: false,
  configuration: { access: "restricted" },
  agent: { access: "restricted" },
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(session, { initialized: false, accessToken: "", userId: "" });
});

it("does not request first-build details anonymously; supports initialized cookie sessions", async () => {
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(snapshot);
  const { result, rerender } = renderHook(() => useFirstBuild());
  expect(result.current.signedIn).toBe(false);
  expect(getFirstBuildReadiness).not.toHaveBeenCalled();
  Object.assign(session, { initialized: true, userId: "cookie-user" });
  rerender();
  await waitFor(() => expect(result.current.data).toEqual(snapshot));
  expect(result.current.signedIn).toBe(true);
});

it("clears private snapshots when signed out or the signed-in identity changes", async () => {
  Object.assign(session, { initialized: true, accessToken: "one" });
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(snapshot);
  const { result, rerender } = renderHook(() => useFirstBuild());
  await waitFor(() => expect(result.current.data).toEqual(snapshot));
  Object.assign(session, { initialized: false, accessToken: "" });
  rerender();
  expect(result.current.data).toBeUndefined();
  Object.assign(session, { initialized: true, accessToken: "two" });
  vi.mocked(getFirstBuildReadiness).mockReturnValue(new Promise(() => {}));
  rerender();
  expect(result.current.data).toBeUndefined();
  expect(result.current.loading).toBe(true);
});

it("refreshes explicitly and ignores older responses even when they disregard cancellation", async () => {
  session.initialized = true;
  session.accessToken = "session";
  let resolveOld!: (value: FirstBuildReadiness) => void;
  let oldSignal!: AbortSignal;
  vi.mocked(getFirstBuildReadiness)
    .mockImplementationOnce((signal) => {
      oldSignal = signal!;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    })
    .mockResolvedValueOnce(snapshot);
  const { result } = renderHook(() => useFirstBuild());
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.data).toEqual(snapshot));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => resolveOld({ ...snapshot, canEnterScope: true }));
  expect(result.current.data?.canEnterScope).toBe(false);
});
