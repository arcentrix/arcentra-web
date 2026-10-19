import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inboxCountLabel,
  unreadInboxCount,
  type InboxCount,
} from "@/api/inbox";
import { refreshInbox, useInboxCount } from "./use-inbox";
import authStore from "@/store/auth";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/inbox", async (original) => ({
  ...(await original<typeof import("@/api/inbox")>()),
  unreadInboxCount: vi.fn(),
}));
function Badge() {
  return <span>{inboxCountLabel(useInboxCount())}</span>;
}
beforeEach(() => {
  vi.resetAllMocks();
  authStore.setTokens({ accessToken: "first-token", refreshToken: "refresh" });
});
afterEach(() => {
  cleanup();
  authStore.clearTokens();
});
describe("session scoped inbox count", () => {
  it("drops old count immediately during refresh and never reuses it on failure", async () => {
    vi.mocked(unreadInboxCount)
      .mockResolvedValueOnce({ count: 7, capped: false, incomplete: false })
      .mockRejectedValue(new Error("unavailable"));
    render(<Badge />);
    await screen.findByText("7 unread");
    act(refreshInbox);
    expect(screen.queryByText("7 unread")).not.toBeInTheDocument();
    await screen.findByText("Unread count unavailable");
  });
  it("discards late previous-token counts", async () => {
    let resolve!: (value: InboxCount) => void;
    vi.mocked(unreadInboxCount)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValue({ count: 2, capped: false, incomplete: true });
    render(<Badge />);
    await act(async () =>
      authStore.setTokens({
        accessToken: "new-token",
        refreshToken: "refresh",
      }),
    );
    await screen.findByText("At least 2 unread");
    await act(async () =>
      resolve({ count: 99, capped: true, incomplete: false }),
    );
    expect(screen.queryByText("99+ unread")).not.toBeInTheDocument();
  });
  it("clears count when signed out without unauthenticated fetches", async () => {
    vi.mocked(unreadInboxCount).mockResolvedValue({
      count: 4,
      capped: false,
      incomplete: false,
    });
    render(<Badge />);
    await screen.findByText("4 unread");
    await act(async () => authStore.clearTokens());
    expect(screen.getByText("Unread count unavailable")).toBeInTheDocument();
    expect(unreadInboxCount).toHaveBeenCalledTimes(1);
  });
  it("forbidden count clears every count consumer and rejects concurrent late success", async () => {
    let resolve!: (value: InboxCount) => void;
    vi.mocked(unreadInboxCount)
      .mockRejectedValueOnce(new ApiError({ status: 403, message: "denied" }))
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
    render(
      <>
        <Badge />
        <Badge />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByText("Unread count unavailable")).toHaveLength(2),
    );
    await act(async () =>
      resolve({ count: 8, capped: false, incomplete: false }),
    );
    expect(screen.queryByText("8 unread")).not.toBeInTheDocument();
    expect(unreadInboxCount).toHaveBeenCalledTimes(2);
  });
});
