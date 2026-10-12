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

const deployRoutes = [
  { path: "/deploy", title: "Deployment integration unavailable" },
  { path: "/projects/project-1/deployments", title: "Deployments unavailable" },
  {
    path: "/projects/project-1/environments",
    title: "Environments unavailable",
  },
];

describe("unavailable deployment integration", () => {
  it.each(deployRoutes)(
    "makes $path unavailable without fabricated records or actions",
    ({ path, title }) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      renderWorkspace(path);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText("Not integrated")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Environment health, rollout progress, and release history cannot be loaded/,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(
        /v2\.|eu-west-1|us-east-2|rolling 4\/8|4\/8 pods|e\.chen|prod\.example\.com|Last \d+ releases/,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("keeps Build and Agents navigation working", () => {
    const router = renderWorkspace("/deploy");
    fireEvent.click(screen.getByRole("link", { name: "Open Build" }));
    expect(router.location.pathname).toBe("/build");
    expect(screen.getByText("Build destination")).toBeInTheDocument();
    act(() => router.navigate(-1));
    fireEvent.click(screen.getByRole("link", { name: "View Agents" }));
    expect(router.location.pathname).toBe("/agents");
    expect(screen.getByText("Agents destination")).toBeInTheDocument();
  });

  it.each(["deployments", "environments"])(
    "keeps %s links scoped to the current project after navigation",
    (tab) => {
      const router = renderWorkspace(`/projects/project-1/${tab}`);
      expect(
        screen.getByRole("link", { name: "View project pipelines" }),
      ).toHaveAttribute("href", "/projects/project-1/pipelines");
      act(() => router.navigate(`/projects/project%20two/${tab}`));
      expect(
        screen.getByRole("link", { name: "View project pipelines" }),
      ).toHaveAttribute("href", "/projects/project%20two/pipelines");
      fireEvent.click(
        screen.getByRole("link", { name: "View project artifacts" }),
      );
      expect(router.location.pathname).toBe(
        "/projects/project%20two/artifacts",
      );
      expect(
        screen.getByText("Project artifacts destination"),
      ).toBeInTheDocument();
      act(() => router.navigate(-1));
      fireEvent.click(
        screen.getByRole("link", { name: "View project pipelines" }),
      );
      expect(router.location.pathname).toBe(
        "/projects/project%20two/pipelines",
      );
      expect(
        screen.getByText("Project pipelines destination"),
      ).toBeInTheDocument();
    },
  );
});

describe("unavailable Copilot integration", () => {
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
      screen.getByRole("heading", { name: "AI chat is unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not integrated")).toBeInTheDocument();
    expect(screen.getByText("Integration status")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
      screen.getByRole("heading", { name: "AI chat is unavailable" }),
    ).toBeInTheDocument();
    act(() => router.navigate(1));
    expect(screen.getByText("Build destination")).toBeInTheDocument();
  });
});

describe("Copilot status drawer and entry points", () => {
  it("opens an honest status panel and can be closed, reopened, and dismissed with Escape", async () => {
    const router = renderWorkspace("/build", <CopilotPanel />);
    const trigger = screen.getByRole("button", { name: "Copilot status" });
    await act(async () => {
      fireEvent.click(trigger);
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Copilot status",
    });
    expect(
      within(dialog).getByText("AI chat is not integrated in this build."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
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
    { label: "View Agents", path: "/agents" },
    { label: "View Copilot status", path: "/workspace/Copilot/chat" },
  ])(
    "closes the drawer when navigating with $label and leaves it closed on Back",
    async ({ label, path }) => {
      const router = renderWorkspace("/deploy", <CopilotPanel />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copilot status" }));
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

  it("labels the palette's Deploy and Copilot entries as unavailable and opens status", async () => {
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
        name: /Deploy Deployment integration status · Not integrated/,
      }),
    ).toBeInTheDocument();
    expect(
      within(palette).queryByRole("button", { name: /Ask AI/ }),
    ).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(palette).getByRole("button", {
          name: /Copilot status AI chat is not integrated/,
        }),
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Command Palette" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("dialog", { name: "Copilot status" }),
    ).toHaveTextContent("Not integrated");
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
        name: "Copilot status · Not integrated",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "Deploy status · Not integrated",
      }),
    );
    expect(router.location.pathname).toBe("/deploy");
    expect(
      screen.getByRole("heading", {
        name: "Deployment integration unavailable",
      }),
    ).toBeInTheDocument();
  });
});
