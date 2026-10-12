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

describe("binary API responses", () => {
  it("retains binary bytes and attachment headers", async () => {
    const { getBlob } = await import("./index");
    const blob = new Blob(['{"artifact":true}'], { type: "application/json" });
    const result = await getBlob("/projects/p/artifacts/a/download", {
      adapter: async (config) => ({
        config,
        status: 200,
        statusText: "OK",
        data: blob,
        headers: {
          "content-disposition": 'attachment; filename="report.json"',
        },
      }),
    });
    expect(result.data).toBe(blob);
    expect(result.headers["content-disposition"]).toContain("report.json");
    expect(result.config.withCredentials).toBe(true);
  });
  it("decodes binary error responses without clearing a valid session", async () => {
    const { getBlob } = await import("./index");
    const body = '{"errMsg":"Artifact expired"}';
    const blob = Object.assign(new Blob([body], { type: "application/json" }), {
      text: async () => body,
    });
    await expect(
      getBlob("/projects/p/artifacts/a/download", {
        adapter: async () => {
          throw Object.assign(new Error("Request failed"), {
            response: {
              status: 410,
              data: blob,
              headers: { "x-request-id": "artifact-request" },
            },
          });
        },
      }),
    ).rejects.toMatchObject({
      status: 410,
      message: "Artifact expired",
      requestId: "artifact-request",
    });
    expect(clearLocalAuth).not.toHaveBeenCalled();
  });
});
