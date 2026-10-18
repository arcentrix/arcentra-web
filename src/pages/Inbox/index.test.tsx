import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inbox from "./index";
import {
  listInbox,
  markInboxRead,
  unreadInboxCount,
  type InboxItem,
} from "@/api/inbox";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/inbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/inbox")>()),
  listInbox: vi.fn(),
  markInboxRead: vi.fn(),
  unreadInboxCount: vi.fn(),
}));
const row: InboxItem = {
  id: "notice-1",
  kind: "run_result",
  status: "success",
  occurredAt: "2026-10-18T12:00:00Z",
  deliveredAt: "2026-10-18T12:00:01Z",
  readAt: null,
  availability: "available",
  target: {
    type: "run",
    projectId: "project-1",
    pipelineId: "pipeline-1",
    runId: "run-1",
  },
};
const page = (
  list = [row],
  nextCursor: string | null = null,
  scanIncomplete = false,
) => ({ list, nextCursor, scanIncomplete });
function show(url = "/inbox") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Inbox />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  authStore.setTokens({ accessToken: "first-token", refreshToken: "refresh" });
  vi.mocked(listInbox).mockResolvedValue(page());
  vi.mocked(unreadInboxCount).mockResolvedValue({
    count: 1,
    capped: false,
    incomplete: false,
  });
  vi.mocked(markInboxRead).mockResolvedValue({
    id: row.id,
    readAt: "2026-10-18T13:00:00Z",
  });
});
afterEach(() => {
  cleanup();
  authStore.clearTokens();
  userStore.clearUserinfo();
});
describe("personal inbox", () => {
  it("loads real metadata and internal run links without any view side effect", async () => {
    show();
    await screen.findByText("Run succeeded");
    expect(screen.getByRole("link", { name: "View run" })).toHaveAttribute(
      "href",
      "/projects/project-1/pipelines?pipeline=pipeline-1&run=run-1",
    );
    expect(markInboxRead).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Historical and automatic runs/),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("first-token");
  });
  it("marks read explicitly only after server confirmation and refreshes the count", async () => {
    let resolve!: (value: { id: string; readAt: string }) => void;
    vi.mocked(markInboxRead).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    await screen.findByText("Run succeeded");
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(screen.getByText(/Unread · success/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marking read…" }),
    ).toBeDisabled();
    await act(async () =>
      resolve({ id: row.id, readAt: "2026-10-18T13:00:00Z" }),
    );
    expect(screen.getByText(/Read · success/)).toBeInTheDocument();
    expect(markInboxRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(unreadInboxCount).toHaveBeenCalledTimes(2));
  });
  it("keeps mutation failure visible and removes revoked rows and links", async () => {
    vi.mocked(markInboxRead).mockRejectedValue(
      new ApiError({ message: "provider-secret", status: 404 }),
    );
    show();
    await screen.findByText("Run succeeded");
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await screen.findByText(/Read status was not confirmed/);
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("provider-secret");
  });
  it("supports empty bounded scan continuation and explicit expired cursor reload", async () => {
    vi.mocked(listInbox)
      .mockResolvedValueOnce(page([], "opaque-next", true))
      .mockRejectedValueOnce(new ApiError({ message: "expired", status: 400 }))
      .mockResolvedValue(page());
    show("/inbox?filter=unread");
    await screen.findByText(/No visible items on this page/);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText(/page has expired/);
    expect(listInbox).toHaveBeenLastCalledWith(
      "unread",
      "opaque-next",
      expect.any(AbortSignal),
    );
    expect(listInbox).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText("Run succeeded");
    expect(listInbox).toHaveBeenLastCalledWith(
      "unread",
      null,
      expect.any(AbortSignal),
    );
  });
  it("never retains a previous successful page on failed refresh", async () => {
    show();
    await screen.findByText("Run succeeded");
    vi.mocked(listInbox).mockRejectedValue(new Error("private provider error"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
    await screen.findByText(/Inbox could not be verified/);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("discards late list and mutation responses after token changes", async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    vi.mocked(listInbox)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValue(page([]));
    show();
    await act(async () =>
      authStore.setTokens({
        accessToken: "second-token",
        refreshToken: "refresh",
      }),
    );
    await screen.findByText("No items in this inbox yet.");
    await act(async () => resolve(page()));
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
  });
  it("resets loaded data on user changes even with the same token", async () => {
    show();
    await screen.findByText("Run succeeded");
    vi.mocked(listInbox).mockResolvedValue(page([]));
    await act(async () =>
      userStore.updateState((state) => {
        state.userinfo = { userId: "new-user" } as typeof state.userinfo;
      }),
    );
    await screen.findByText("No items in this inbox yet.");
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
  });
  it("shows lower-bound/unavailable count and awaiting-resolution without action links", async () => {
    vi.mocked(unreadInboxCount).mockResolvedValue({
      count: 0,
      capped: false,
      incomplete: true,
    });
    vi.mocked(listInbox).mockResolvedValue(
      page([
        {
          ...row,
          kind: "approval_requested",
          status: "pending",
          availability: "awaiting_resolution",
        },
      ]),
    );
    show();
    await screen.findByText("Approval requested");
    expect(screen.getByText("Unread count unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Awaiting authoritative resolution/),
    ).toBeInTheDocument();
  });
  it("clears visible rows if the count recheck returns forbidden", async () => {
    show();
    await screen.findByText("Run succeeded");
    vi.mocked(unreadInboxCount).mockRejectedValue(
      new ApiError({ message: "denied", status: 403 }),
    );
    act(() => window.dispatchEvent(new Event("inbox-refresh")));
    await screen.findByText(
      "Inbox access changed. Refresh to check current access.",
    );
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
  });
  it("clears read mutations and ignores their late success after auth switch", async () => {
    let resolve!: (value: { id: string; readAt: string }) => void;
    vi.mocked(markInboxRead).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    await screen.findByText("Run succeeded");
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    vi.mocked(listInbox).mockResolvedValue(page([]));
    await act(async () =>
      authStore.setTokens({
        accessToken: "second-token",
        refreshToken: "refresh",
      }),
    );
    await screen.findByText("No items in this inbox yet.");
    await act(async () =>
      resolve({ id: row.id, readAt: "2026-10-18T13:00:00Z" }),
    );
    expect(screen.queryByText("Run succeeded")).not.toBeInTheDocument();
    expect(screen.queryByText(/Read status was/)).not.toBeInTheDocument();
  });
});

it("does not claim global emptiness after marking the last continuation row read", async () => {
  const first = Array.from({ length: 20 }, (_, index) => ({
    ...row,
    id: `first-${index}`,
  }));
  const last = { ...row, id: "last-page-row" };
  vi.mocked(listInbox)
    .mockResolvedValueOnce(page(first, "continuation"))
    .mockResolvedValueOnce(page([last]))
    .mockResolvedValueOnce(page(first, "continuation"));
  vi.mocked(markInboxRead).mockResolvedValue({
    id: last.id,
    readAt: "2026-10-18T13:00:00Z",
  });
  show("/inbox?filter=unread");
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Mark read" })).toHaveLength(
      20,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Mark read" })).toHaveLength(
      1,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
  await screen.findByText("No unread items on this page.");
  expect(
    screen.queryByText("No unread items in this inbox."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to first page" }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Mark read" })).toHaveLength(
      20,
    ),
  );
  expect(listInbox).toHaveBeenLastCalledWith(
    "unread",
    null,
    expect.any(AbortSignal),
  );
});
