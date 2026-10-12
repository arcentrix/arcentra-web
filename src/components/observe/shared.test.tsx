import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "@/api/client";
import { ApiError } from "@/lib/api-error";
import { SnapshotError } from "./shared";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Observe permission errors", () => {
  it.each([4030, 4031])(
    "recognizes HTTP 200 business denial %s through the real API envelope",
    async (code) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      let denied!: Error;
      try {
        await get("/agent", {
          silence: true,
          adapter: async (config) => ({
            config,
            status: 200,
            statusText: "OK",
            headers: { "x-request-id": "real-envelope" },
            data: {
              code,
              errCode: code,
              errMsg: "Permission denied",
              path: "/api/v1/agent",
            },
          }),
        });
      } catch (error) {
        denied = error as Error;
      }
      expect(denied).toBeInstanceOf(ApiError);
      expect(denied).toMatchObject({
        code,
        status: 200,
        requestId: "real-envelope",
      });
      render(
        <SnapshotError
          error={denied}
          subject="Agent health"
          permission="platform agent:read"
          retry={vi.fn()}
          loading={false}
        />,
      );
      expect(
        screen.getByText("Agent health access restricted"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/requires platform agent:read/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Check access again" }),
      ).toBeInTheDocument();
    },
  );

  it("keeps non-permission business errors actionable as service failures", () => {
    render(
      <SnapshotError
        error={
          new ApiError({ status: 200, code: 5000, message: "Storage failed" })
        }
        subject="Run history"
        permission="pipeline:read"
        retry={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByText("Run history unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
