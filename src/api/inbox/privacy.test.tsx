import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { get } from "../client";
import Inbox from "@/pages/Inbox";
import authStore from "@/store/auth";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn() }));
beforeEach(() =>
  authStore.setTokens({
    accessToken: "test-token",
    refreshToken: "test-refresh",
  }),
);
afterEach(() => {
  cleanup();
  authStore.clearTokens();
  vi.resetAllMocks();
});
it.each(["2026-10-18 (Provider secret)", "2026-02-30T00:00:00Z", "0"])(
  "never renders rejected timestamp payload in text or datetime: %s",
  async (occurredAt) => {
    vi.mocked(get).mockImplementation(async (path) =>
      path === "/inbox/unread-count"
        ? { count: 1, capped: false, incomplete: false }
        : {
            list: [
              {
                id: "notice-1",
                kind: "run_result",
                status: "success",
                occurredAt,
                deliveredAt: "2026-10-18T00:00:00Z",
                readAt: null,
                target: null,
                availability: "unavailable",
              },
            ],
            nextCursor: null,
            scanIncomplete: false,
          },
    );
    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>,
    );
    await screen.findByText(
      "Inbox could not be verified. Refresh to check current data.",
    );
    expect(document.querySelector("time")).toBeNull();
    expect(document.querySelector("[data-inbox-id]")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Provider secret");
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
  },
);
