import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "../client";
import { listAgentHealth } from "./index";

vi.mock("../client", () => ({ get: vi.fn() }));

describe("Observe agent API", () => {
  beforeEach(() => vi.resetAllMocks());
  it("uses the existing paginated endpoint with independent cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(get).mockResolvedValue({
      agents: [
        {
          agentId: "runner-a",
          status: 3,
          lastHeartbeat: "2026-10-12T04:00:00Z",
        },
      ],
      count: 42,
      pageNum: 2,
      pageSize: 20,
    });
    const result = await listAgentHealth(2, controller.signal);
    expect(get).toHaveBeenCalledWith("/agent", {
      params: { pageNum: 2, pageSize: 20 },
      signal: controller.signal,
      silence: true,
    });
    expect(result).toMatchObject({
      count: 42,
      agents: [{ status: 3, lastHeartbeat: "2026-10-12T04:00:00Z" }],
    });
  });
  it("accepts the backend's null list without inventing agents or global online counts", async () => {
    vi.mocked(get).mockResolvedValue({
      agents: null,
      count: 0,
      pageNum: 1,
      pageSize: 20,
    });
    expect(await listAgentHealth(1)).toEqual({
      agents: [],
      count: 0,
      pageNum: 1,
      pageSize: 20,
    });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("preserves errors for scoped permission and retry handling", async () => {
    const error = new Error("forbidden");
    vi.mocked(get).mockRejectedValue(error);
    await expect(listAgentHealth(1)).rejects.toBe(error);
  });
});
