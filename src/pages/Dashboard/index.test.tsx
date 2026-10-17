import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Apis } from "@/api";
import { listAgentHealth } from "@/api/observe";
import type { ListAgentsResponse } from "@/api/agent/types";
import { ApiError } from "@/lib/api-error";
import userStore from "@/store/user";
import Dashboard from "./index";

const { auth } = vi.hoisted(() => ({
  auth: { initialized: true, accessToken: "session-one" },
}));
vi.mock("@/store/auth", () => ({ default: { useState: () => auth } }));
vi.mock("@/api", () => ({ Apis: { me: { getEffectiveActions: vi.fn() } } }));
vi.mock("@/api/observe", () => ({ listAgentHealth: vi.fn() }));

const agents = (pageNum = 1): ListAgentsResponse => ({
  agents: [
    {
      id: 1,
      agentId: `runner-${pageNum}`,
      agentName: `Recorded runner ${pageNum}`,
      address: "",
      port: "",
      os: "linux",
      arch: "amd64",
      version: "v1",
      status: 3,
      isEnabled: 1,
      labels: {},
      metrics: "",
      lastHeartbeat: null,
    },
  ],
  count: 42,
  pageNum,
  pageSize: 20,
});
function setCookieUser(userId: string) {
  userStore.updateState((state) => {
    state.userinfo = {
      userId,
      username: userId,
      fullName: userId,
      email: "",
      phone: "",
      avatar: "",
    };
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function show(initial = "/") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Harness() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/build" element={<p>Build destination</p>} />
        <Route path="/deploy" element={<p>Deploy destination</p>} />
        <Route path="/observe" element={<p>Observe destination</p>} />
        <Route path="/projects" element={<p>Projects destination</p>} />
      </Routes>
    );
  }
  const tree = () => (
    <MemoryRouter initialEntries={[initial]}>
      <Harness />
    </MemoryRouter>
  );
  const view = render(tree());
  return {
    ...view,
    rerenderSession: () => view.rerender(tree()),
    navigate: (delta: number) => act(() => navigate(delta)),
    get search() {
      return location.search;
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.initialized = true;
  auth.accessToken = "session-one";
  userStore.updateState((state) => {
    state.userinfo = null;
  });
  vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue(["agent:read"]);
  vi.mocked(listAgentHealth).mockImplementation(async (page) => agents(page));
});
afterEach(cleanup);

describe("truthful control-plane dashboard", () => {
  it("shows the reused server snapshot with only page-scoped agent counts and real navigation", async () => {
    show();
    expect(await screen.findByText("Recorded runner 1")).toBeInTheDocument();
    expect(
      screen.getByText("42 registered agents · 1 loaded on this page"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "0 available · 1 busy · 0 offline · 0 disabled on this page",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not reported")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Build" })).toHaveAttribute(
      "href",
      "/build",
    );
    expect(screen.getByRole("link", { name: "Open Deploy" })).toHaveAttribute(
      "href",
      "/deploy",
    );
    expect(screen.getByRole("link", { name: "Open Observe" })).toHaveAttribute(
      "href",
      "/observe",
    );
    expect(screen.getByRole("link", { name: "View projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(document.body).not.toHaveTextContent(
      /cluster · running|94.2%|8m 42s|2.4h|MTTR|Queue Length|capacity available|web-app|api-service|Recent runs|Healthy/,
    );
  });

  it("does not request data before sign-in", () => {
    auth.initialized = false;
    show();
    expect(
      screen.getByText("Sign in to view the control plane."),
    ).toBeInTheDocument();
    expect(Apis.me.getEffectiveActions).not.toHaveBeenCalled();
    expect(listAgentHealth).not.toHaveBeenCalled();
  });

  it("checks platform permission before any fleet read and does not infer it from pipeline grants", async () => {
    const pending = deferred<string[]>();
    vi.mocked(Apis.me.getEffectiveActions).mockReturnValue(pending.promise);
    show();
    expect(screen.getByText("Checking agent access…")).toBeInTheDocument();
    expect(listAgentHealth).not.toHaveBeenCalled();
    await act(async () => pending.resolve(["pipeline:read", "project:read"]));
    expect(
      await screen.findByText(/Agent health requires platform agent:read/),
    ).toBeInTheDocument();
    expect(listAgentHealth).not.toHaveBeenCalled();
    expect(Apis.me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "platform" },
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole("link", { name: "Open Build" }),
    ).toBeInTheDocument();
  });

  it("shows permission errors and retries the access check before reading data", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockRejectedValueOnce(
      new Error("Permission check failed"),
    );
    show();
    expect(
      await screen.findByText("Agent permission check unavailable"),
    ).toBeInTheDocument();
    expect(listAgentHealth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recorded runner 1")).toBeInTheDocument();
  });

  it("shows real read loading and empty state instead of fallback metrics", async () => {
    const pending = deferred<ListAgentsResponse>();
    vi.mocked(listAgentHealth).mockReturnValue(pending.promise);
    show();
    expect(await screen.findByText("Loading agents…")).toBeInTheDocument();
    expect(screen.queryByText(/registered agents ·/)).not.toBeInTheDocument();
    await act(async () =>
      pending.resolve({ agents: [], count: 0, pageNum: 1, pageSize: 20 }),
    );
    expect(
      await screen.findByText("No registered agents yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([403, 500])(
    "removes old snapshot metrics when refreshed reads fail (%i)",
    async (status) => {
      show();
      await screen.findByText("Recorded runner 1");
      vi.mocked(listAgentHealth).mockRejectedValueOnce(
        new ApiError({ status, message: "Fleet read failed" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Refresh snapshot" }));
      expect(screen.queryByText("Recorded runner 1")).not.toBeInTheDocument();
      expect(
        await screen.findByText(
          status === 403
            ? "Agent health access restricted"
            : "Agent health unavailable",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/registered agents ·/)).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", {
          name: status === 403 ? "Check access again" : "Retry",
        }),
      );
      expect(await screen.findByText("Recorded runner 1")).toBeInTheDocument();
    },
  );

  it("aborts pending agent reads and discards results after permission revocation", async () => {
    const pending = deferred<ListAgentsResponse>();
    let signal!: AbortSignal;
    vi.mocked(listAgentHealth).mockImplementation((_page, nextSignal) => {
      signal = nextSignal!;
      return pending.promise;
    });
    show();
    await waitFor(() => expect(signal).toBeDefined());
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh snapshot" }));
    expect(
      await screen.findByText(/Agent health requires platform agent:read/),
    ).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(agents()));
    expect(screen.queryByText("Recorded runner 1")).not.toBeInTheDocument();
  });

  it("isolates prior agent reads on account changes and sign-out", async () => {
    const pending = deferred<ListAgentsResponse>();
    let signal!: AbortSignal;
    vi.mocked(listAgentHealth).mockImplementation((_page, nextSignal) => {
      signal = nextSignal!;
      return pending.promise;
    });
    const view = show();
    await waitFor(() => expect(signal).toBeDefined());
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    auth.accessToken = "session-two";
    view.rerenderSession();
    expect(
      await screen.findByText(/Agent health requires platform agent:read/),
    ).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(agents()));
    expect(screen.queryByText("Recorded runner 1")).not.toBeInTheDocument();
    expect(listAgentHealth).toHaveBeenCalledTimes(1);
    auth.initialized = false;
    view.rerenderSession();
    expect(
      screen.getByText("Sign in to view the control plane."),
    ).toBeInTheDocument();
  });

  it("preserves page query state and Back/Forward navigation to real workspaces", async () => {
    const view = show("/?keep=original");
    await screen.findByText("Recorded runner 1");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Agent pages" })).getByRole(
        "button",
        { name: "Next" },
      ),
    );
    expect(await screen.findByText("Recorded runner 2")).toBeInTheDocument();
    expect(view.search).toBe("?keep=original&agentPage=2");
    view.navigate(-1);
    expect(await screen.findByText("Recorded runner 1")).toBeInTheDocument();
    view.navigate(1);
    expect(await screen.findByText("Recorded runner 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Open Build" }));
    expect(screen.getByText("Build destination")).toBeInTheDocument();
    view.navigate(-1);
    expect(await screen.findByText("Recorded runner 2")).toBeInTheDocument();
    view.navigate(1);
    expect(screen.getByText("Build destination")).toBeInTheDocument();
  });
  it.each(["loaded", "pending"])(
    "isolates %s data when a cookie-only user identity changes without a navigation or forced render",
    async (state) => {
      auth.accessToken = "";
      setCookieUser("cookie-user-one");
      const pending = deferred<ListAgentsResponse>();
      let signal!: AbortSignal;
      vi.mocked(listAgentHealth).mockImplementation((_page, nextSignal) => {
        signal = nextSignal!;
        return state === "pending"
          ? pending.promise
          : Promise.resolve(agents());
      });
      show();
      await waitFor(() => expect(signal).toBeDefined());
      if (state === "loaded") await screen.findByText("Recorded runner 1");
      vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
      await act(async () => setCookieUser("cookie-user-two"));
      expect(signal.aborted).toBe(true);
      expect(screen.queryByText("Recorded runner 1")).not.toBeInTheDocument();
      expect(
        await screen.findByText(/Agent health requires platform agent:read/),
      ).toBeInTheDocument();
      expect(Apis.me.getEffectiveActions).toHaveBeenCalledTimes(2);
      await act(async () => pending.resolve(agents()));
      expect(screen.queryByText("Recorded runner 1")).not.toBeInTheDocument();
      expect(listAgentHealth).toHaveBeenCalledTimes(1);
    },
  );
});
