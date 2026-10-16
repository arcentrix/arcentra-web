import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Inbox from "./index";

function show(initial = "/inbox") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Harness() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <Routes>
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/build" element={<p>Build destination</p>} />
        <Route path="/deploy" element={<p>Deploy destination</p>} />
      </Routes>
    );
  }
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Harness />
    </MemoryRouter>,
  );
  return {
    navigate: (delta: number) => act(() => navigate(delta)),
    get search() {
      return location.search;
    },
  };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("unconnected notification inbox", () => {
  it("discloses unavailable notifications without invented alerts, counts, approvals or read/delete actions", () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const view = show("/inbox?filter=unread");
    act(() => vi.advanceTimersByTime(10_000));
    expect(
      screen.getByRole("heading", { name: "Inbox is not connected" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(
      screen.getByText(/does not indicate whether you have pending approvals/),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /mark.weber|ml-inference|STRIPE_SECRET|runner-29|j.park|All caught up|No notifications|Approved|Declined|marked as read|unread notifications/,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(view.search).toBe("?filter=unread");
  });

  it("navigates to real Build and Deploy approval contexts and preserves Back/Forward history", () => {
    const view = show("/inbox?filter=approval");
    expect(screen.getByRole("link", { name: "Open Build" })).toHaveAttribute(
      "href",
      "/build",
    );
    expect(screen.getByRole("link", { name: "Open Deploy" })).toHaveAttribute(
      "href",
      "/deploy",
    );
    fireEvent.click(screen.getByRole("link", { name: "Open Build" }));
    expect(screen.getByText("Build destination")).toBeInTheDocument();
    view.navigate(-1);
    expect(view.search).toBe("?filter=approval");
    expect(
      screen.getByRole("heading", { name: "Inbox is not connected" }),
    ).toBeInTheDocument();
    view.navigate(1);
    expect(screen.getByText("Build destination")).toBeInTheDocument();
    view.navigate(-1);
    fireEvent.click(screen.getByRole("link", { name: "Open Deploy" }));
    expect(screen.getByText("Deploy destination")).toBeInTheDocument();
    view.navigate(-1);
    expect(
      screen.getByRole("heading", { name: "Inbox is not connected" }),
    ).toBeInTheDocument();
  });
});
