import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "./index";
import { clearLocalAuth } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({ clearLocalAuth: vi.fn() }));
afterEach(() => vi.clearAllMocks());
describe("API authorization failures", () => {
  it("keeps a valid session on forbidden resources", async () => {
    await expect(
      get("/pipelines/restricted", {
        adapter: async () => {
          throw Object.assign(new Error("Forbidden"), {
            response: {
              status: 403,
              data: { errMsg: "Missing pipeline:read" },
            },
          });
        },
      }),
    ).rejects.toMatchObject({ status: 403, message: "Missing pipeline:read" });
    expect(clearLocalAuth).not.toHaveBeenCalled();
  });
});
