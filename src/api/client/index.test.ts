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

describe("sensitive API requests", () => {
  it("never logs or toasts raw envelope failures and preserves only safe error metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { post } = await import("./index");
    let caught: unknown;
    try {
      await post(
        "/storage/configs",
        { config: "REQUEST-SECRET-CANARY" },
        {
          silence: true,
          sensitive: true,
          adapter: async (config) => ({
            config,
            status: 200,
            statusText: "OK",
            headers: {},
            data: {
              code: 400,
              errMsg: "RESPONSE-SECRET-CANARY",
              path: "PATH-SECRET-CANARY",
            },
          }),
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      message: "Storage request failed",
      code: 400,
    });
    expect(JSON.stringify(caught)).not.toContain("CANARY");
    expect(caught).not.toHaveProperty("cause");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it("drops transport causes containing request bodies while retaining 403 status", async () => {
    const { post } = await import("./index");
    let caught: unknown;
    try {
      await post(
        "/storage/configs",
        { config: "REQUEST-SECRET-CANARY" },
        {
          silence: true,
          sensitive: true,
          adapter: async (config) => {
            throw Object.assign(new Error("TRANSPORT-SECRET-CANARY"), {
              config,
              response: {
                config,
                status: 403,
                data: {
                  errMsg: "RESPONSE-SECRET-CANARY",
                  path: "PATH-SECRET-CANARY",
                },
              },
            });
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      message: "Storage request failed",
      status: 403,
    });
    expect(caught).not.toHaveProperty("cause");
    expect(JSON.stringify(caught)).not.toContain("CANARY");
    expect(clearLocalAuth).not.toHaveBeenCalled();
  });
});

describe("scoped API error redaction", () => {
  it.each(["envelope", "transport"] as const)(
    "suppresses untrusted %s diagnostics while keeping actionable status",
    async (mode) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      let caught: unknown;
      try {
        await get("/organization/synthetic", {
          silence: true,
          redactErrors: true,
          adapter: async (config) => {
            const response = {
              config,
              status: mode === "transport" ? 403 : 200,
              statusText: "Forbidden",
              headers: { "x-request-id": "synthetic-trace" },
              data: {
                code: 403,
                errMsg: "RESPONSE-PRIVATE-CANARY",
                path: "PATH-PRIVATE-CANARY",
              },
            };
            if (mode === "transport")
              throw Object.assign(new Error("TRANSPORT-CANARY"), {
                config,
                response,
              });
            return response;
          },
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({
        message: "Scoped request failed",
        requestId: "synthetic-trace",
      });
      expect(JSON.stringify(caught)).not.toContain("CANARY");
      expect(caught).not.toHaveProperty("cause");
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    },
  );
});
