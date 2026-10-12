import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Deploy from "@/pages/Deploy";
import Deployments from "@/pages/Project/Deployments";
import Environments from "@/pages/Project/Environments";
import Copilot from "@/pages/Copilot";
import { Breadcrumb } from "@/components/breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { CopilotPanel } from "@/components/copilot-panel";
import { TopCommandBar } from "@/components/top-command-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { uiShellStore } from "@/store/ui-shell";

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("@/api", () => ({ Apis: { agent: { getAgentById: vi.fn() } } }));

vi.mock("@/api/project", () => ({
  listProjects: vi
    .fn()
    .mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 }),
}));
vi.mock("@/api/deploy", () => ({
  listEnvironments: vi
    .fn()
    .mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  listReleases: vi
    .fn()
    .mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  createEnvironment: vi.fn(),
  createRelease: vi.fn(),
  cancelRelease: vi.fn(),
  advanceRelease: vi.fn(),
}));

function renderWorkspace(initial: string, shell?: ReactNode) {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Workspace() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <TooltipProvider>
        {shell}
        <Routes>
          <Route path="/deploy" element={<Deploy />} />
          <Route
            path="/projects/:projectId/deployments"
            element={<Deployments />}
          />
          <Route
            path="/projects/:projectId/environments"
            element={<Environments />}
          />
          <Route path="/workspace/:workspaceName/chat" element={<Copilot />} />
          <Route path="/build" element={<p>Build destination</p>} />
          <Route path="/agents" element={<p>Agents destination</p>} />
          <Route
            path="/projects/:projectId/pipelines"
            element={<p>Project pipelines destination</p>}
          />
          <Route
            path="/projects/:projectId/artifacts"
            element={<p>Project artifacts destination</p>}
          />
        </Routes>
      </TooltipProvider>
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
    navigate: (to: string | number) =>
      typeof to === "number" ? navigate(to) : navigate(to),
  };
}

beforeEach(() => {
  uiShellStore.closeCopilot();
  uiShellStore.closePalette();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("read-only Copilot integration", () => {
  it("does not manufacture conversations, models, connected state, or delayed replies for legacy URLs", () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const originalSearch = "?historyId=c1&title=Invented%20conversation";
    const router = renderWorkspace(
      `/workspace/Copilot/chat${originalSearch}`,
      <Breadcrumb />,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { name: "Copilot" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Read-only analysis").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Project ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load context choices" }),
    ).toBeDisabled();
    expect(document.body).not.toHaveTextContent(
      /Invented conversation|New chat|connected ·|14 tools|14 tool calls|GPT-4o|Claude Sonnet|模拟的 AI 回复|Why is the api/,
    );
    expect(router.location.search).toBe(originalSearch);
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps legacy URLs unchanged across Build navigation and Back/Forward", () => {
    const original = "/workspace/Copilot/chat?historyId=old&title=Legacy";
    const router = renderWorkspace(original);
    fireEvent.click(screen.getByRole("link", { name: "Open Build" }));
    expect(screen.getByText("Build destination")).toBeInTheDocument();
    act(() => router.navigate(-1));
    expect(`${router.location.pathname}${router.location.search}`).toBe(
      original,
    );
    expect(
      screen.getByRole("heading", { name: "Copilot" }),
    ).toBeInTheDocument();
    act(() => router.navigate(1));
    expect(screen.getByText("Build destination")).toBeInTheDocument();
  });
});

describe("Copilot status drawer and entry points", () => {
  it("opens an honest status panel and can be closed, reopened, and dismissed with Escape", async () => {
    const router = renderWorkspace("/build", <CopilotPanel />);
    const trigger = screen.getByRole("button", { name: "Open Copilot" });
    await act(async () => {
      fireEvent.click(trigger);
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Copilot",
    });
    expect(within(dialog).getByText("Read-only analysis")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Project ID")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: /send|attach|new conversation/i,
      }),
    ).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(
      /Suggested prompts|keeps context across sessions|connected ·/,
    );
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(trigger);
    });
    await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.location.pathname).toBe("/build");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(uiShellStore.state.copilotOpen).toBe(false);
  });

  it.each([
    { label: "Open Build", path: "/build" },
    { label: "Open full Copilot", path: "/workspace/Copilot/chat" },
  ])(
    "closes the drawer when navigating with $label and leaves it closed on Back",
    async ({ label, path }) => {
      const router = renderWorkspace("/deploy", <CopilotPanel />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Open Copilot" }));
      });
      const dialog = await screen.findByRole("dialog");
      await act(async () => {
        fireEvent.click(within(dialog).getByRole("link", { name: label }));
      });
      expect(router.location.pathname).toBe(path);
      expect(router.location.search).toBe("");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(uiShellStore.state.copilotOpen).toBe(false);
      await act(async () => router.navigate(-1));
      expect(router.location.pathname).toBe("/deploy");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("labels the palette entries accurately and opens Copilot", async () => {
    renderWorkspace(
      "/build",
      <>
        <CommandPalette />
        <CopilotPanel />
      </>,
    );
    await act(async () => uiShellStore.openPalette());
    const palette = await screen.findByRole("dialog", {
      name: "Command Palette",
    });
    expect(
      within(palette).getByRole("button", {
        name: /Deploy Pipeline Kubernetes releases/,
      }),
    ).toBeInTheDocument();
    expect(
      within(palette).queryByRole("button", { name: /Ask AI/ }),
    ).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(palette).getByRole("button", {
          name: /Copilot Read-only run analysis/,
        }),
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Command Palette" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("dialog", { name: "Copilot" }),
    ).toHaveTextContent("Read-only analysis");
  });

  it("uses honest quick-action labels and links deployment status without creating anything", async () => {
    const router = renderWorkspace("/build", <TopCommandBar />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Create new" }), {
      key: "Enter",
    });
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).queryByRole("menuitem", { name: /New deployment|Ask AI/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", {
        name: "Copilot · Read-only analysis",
      }),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(menu).getByRole("menuitem", {
          name: "View Deploy",
        }),
      );
    });
    expect(router.location.pathname).toBe("/deploy");
    expect(
      screen.getByRole("heading", {
        name: "Deploy",
      }),
    ).toBeInTheDocument();
  });
});
