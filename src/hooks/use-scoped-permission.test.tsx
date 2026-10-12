import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScopedPermission } from "./use-scoped-permission";
import { Apis } from "@/api";
vi.mock("@/api", () => ({ Apis: { me: { getEffectiveActions: vi.fn() } } }));
beforeEach(() => vi.clearAllMocks());
describe("scoped mutation permissions", () => {
  it("resolves project grants rather than assuming platform grants", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([
      "pipeline:create",
      "pipeline:trigger",
    ]);
    const { result } = renderHook(() =>
      useScopedPermission("project", "project-1"),
    );
    expect(result.current.has("pipeline:create")).toBe(false);
    await waitFor(() =>
      expect(result.current.has("pipeline:create")).toBe(true),
    );
    expect(Apis.me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "project", scopeId: "project-1" },
      expect.any(AbortSignal),
    );
    expect(result.current.has("pipeline:cancel")).toBe(false);
  });
  it("clears the previous project's grants immediately when selection changes", async () => {
    vi.mocked(Apis.me.getEffectiveActions)
      .mockResolvedValueOnce(["pipeline:create"])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ id }) => useScopedPermission("project", id),
      { initialProps: { id: "allowed" } },
    );
    await waitFor(() =>
      expect(result.current.has("pipeline:create")).toBe(true),
    );
    rerender({ id: "denied" });
    expect(result.current.has("pipeline:create")).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.has("pipeline:create")).toBe(false);
  });
  it("checks organization scope before project creation and fails closed on errors", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockRejectedValue(
      new Error("Permission service unavailable"),
    );
    const { result } = renderHook(() => useScopedPermission("org", "org-1"));
    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        "Permission service unavailable",
      ),
    );
    expect(result.current.has("org:create_project")).toBe(false);
    expect(Apis.me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "org", scopeId: "org-1" },
      expect.any(AbortSignal),
    );
  });
});
