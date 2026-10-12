import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "@/pages/Settings/Notifications";
import SettingsPage from "@/pages/Settings";
import { toast } from "@/lib/toast";

vi.mock("@/pages/GeneralSettings", () => ({
  default: () => <p>General settings destination</p>,
}));
vi.mock("@/pages/Identity", () => ({
  default: () => <p>Identity settings</p>,
}));
vi.mock("@/pages/Settings/SystemInfo", () => ({
  default: () => <p>System info</p>,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderSettings(initial = "/settings/notifications") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Workspace() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <Routes>
        <Route path="/settings/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    );
  }
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Workspace />
    </MemoryRouter>,
  );
  return {
    get location() {
      return location;
    },
    navigate: (delta: number) => navigate(delta),
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("notification settings integration boundary", () => {
  it("shows unavailability without fabricated configuration, save actions, or delayed success", () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    const save = vi.spyOn(Storage.prototype, "setItem");
    renderSettings();
    act(() => vi.advanceTimersByTime(5000));

    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Notification settings unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not integrated")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Existing configuration cannot be loaded or changed here/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No notification settings are saved from this page/),
    ).toBeInTheDocument();
    for (const role of [
      "button",
      "textbox",
      "combobox",
      "switch",
      "table",
      "dialog",
    ]) {
      expect(screen.queryByRole(role)).not.toBeInTheDocument();
    }
    expect(document.body).not.toHaveTextContent(
      /Email Channel|Slack Channel|Webhook Channel|Pipeline Success|Pipeline Failure|Deployment Notification|smtp\.example\.com|hooks\.slack\.com|No notification channels configured|No routing rules yet|successfully/,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps standalone settings navigation and browser Back/Forward usable", () => {
    const original = "/settings/notifications?source=legacy";
    const router = renderSettings(original);
    fireEvent.click(
      screen.getByRole("link", { name: "Open general settings" }),
    );
    expect(router.location.pathname).toBe("/settings");
    expect(
      screen.getByText("General settings destination"),
    ).toBeInTheDocument();
    act(() => router.navigate(-1));
    expect(`${router.location.pathname}${router.location.search}`).toBe(
      original,
    );
    expect(
      screen.getByRole("heading", {
        name: "Notification settings unavailable",
      }),
    ).toBeInTheDocument();
    act(() => router.navigate(1));
    expect(
      screen.getByText("General settings destination"),
    ).toBeInTheDocument();
  });

  it("preserves the headless layout without a duplicate page header", () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <NotificationsPage headless />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("heading", { name: "Notifications" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Notification settings unavailable",
      }),
    ).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(
      "flex",
      "flex-col",
      "gap-4",
    );
    expect(container.firstElementChild).not.toHaveClass("p-4", "md:p-8");
    rerender(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("retains Settings section navigation on repeated visits without manufacturing state", () => {
    const router = renderSettings(
      "/settings?section=notifications&source=test",
    );
    const navigation = screen.getByRole("navigation", {
      name: "Settings sections",
    });
    const notifications = within(navigation).getByRole("button", {
      name: "Notifications",
    });
    expect(notifications).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("heading", { name: "Notifications" }),
    ).not.toBeInTheDocument();

    for (let visit = 0; visit < 2; visit += 1) {
      fireEvent.click(
        within(navigation).getByRole("button", { name: "General" }),
      );
      expect(
        screen.getByText("General settings destination"),
      ).toBeInTheDocument();
      fireEvent.click(notifications);
      expect(
        screen.getByRole("heading", {
          name: "Notification settings unavailable",
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    }
    expect(new URLSearchParams(router.location.search).get("source")).toBe(
      "test",
    );
    expect(new URLSearchParams(router.location.search).get("section")).toBe(
      "notifications",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
