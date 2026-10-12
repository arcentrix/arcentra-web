import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiResource } from "./use-api-resource";

describe("useApiResource", () => {
  it("does not leak stale data or late responses across navigation", async () => {
    let resolveOld!: (value: string) => void;
    let oldSignal!: AbortSignal;
    const loader = vi.fn((key: string, signal: AbortSignal) => {
      if (key === "old") {
        oldSignal = signal;
        return new Promise<string>((resolve) => {
          resolveOld = resolve;
        });
      }
      return Promise.resolve("new data");
    });
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useApiResource(id, (signal) => loader(id, signal)),
      { initialProps: { id: "old" } },
    );
    rerender({ id: "new" });
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("new data"));
    await act(async () => resolveOld("stale data"));
    expect(result.current.data).toBe("new data");
    unmount();
  });
  it("exposes errors, supports retry, and does not fetch disabled resources", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("recovered");
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useApiResource(id, loader),
      { initialProps: { id: null as string | null } },
    );
    expect(loader).not.toHaveBeenCalled();
    rerender({ id: "active" });
    await waitFor(() => expect(result.current.error?.message).toBe("offline"));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data).toBe("recovered"));
    expect(result.current.error).toBeUndefined();
  });
});
