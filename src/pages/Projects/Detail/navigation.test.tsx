import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectDetail from "./index";
import ProjectOverview from "./Overview";

vi.mock("@/api/project", () => ({
  getProject: vi.fn().mockResolvedValue({
    projectId: "project-1",
    name: "api-service",
    displayName: "API service",
    repoUrl: "https://example.test/api.git",
    defaultBranch: "main",
  }),
}));
vi.mock("@/api/pipeline", () => ({
  listPipelines: vi.fn().mockResolvedValue({
    list: [
      {
        pipelineId: "pipeline-1",
        name: "Build API",
        defaultBranch: "main",
        pipelineFilePath: ".arcentra/pipeline.yaml",
        totalRuns: 1,
      },
    ],
    total: 1,
  }),
}));
vi.mock("@/components/build/agent-readiness", () => ({
  AgentReadiness: () => null,
}));
afterEach(cleanup);

function NavigationFixture() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Current route">
        {location.pathname}
        {location.search}
      </output>
      <button onClick={() => navigate(-1)}>Browser back</button>
      <button onClick={() => navigate(1)}>Browser forward</button>
      <Routes>
        <Route
          path="/projects"
          element={<Link to="/projects/project-1">Open API service</Link>}
        />
        <Route path="/projects/:projectId" element={<ProjectDetail />}>
          <Route index element={<ProjectOverview />} />
          <Route path="pipelines" element={<h2>Pipeline workspace</h2>} />
        </Route>
      </Routes>
    </>
  );
}

describe("project overview navigation semantics", () => {
  it("exposes its panel title as a heading and preserves exact Back/Forward history", async () => {
    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <NavigationFixture />
      </MemoryRouter>,
    );
    const assertOverview = async () => {
      expect(
        await screen.findByRole("heading", {
          name: "Pipeline definitions",
          level: 2,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "API service", level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        /^\/projects\/project-1$/,
      );
      expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(
        screen.queryByRole("heading", { name: "Pipeline workspace" }),
      ).not.toBeInTheDocument();
    };
    const assertPipelines = async () => {
      expect(
        await screen.findByRole("heading", { name: "Pipeline workspace" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        /^\/projects\/project-1\/pipelines$/,
      );
      expect(screen.getByRole("tab", { name: "Pipelines" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(
        screen.queryByRole("heading", { name: "Pipeline definitions" }),
      ).not.toBeInTheDocument();
    };
    fireEvent.click(screen.getByRole("link", { name: "Open API service" }));
    await assertOverview();
    fireEvent.click(screen.getByRole("button", { name: "View pipelines" }));
    await assertPipelines();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    await assertOverview();
    fireEvent.click(screen.getByRole("button", { name: "Browser forward" }));
    await assertPipelines();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    await assertOverview();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        /^\/projects$/,
      ),
    );
    expect(
      screen.getByRole("link", { name: "Open API service" }),
    ).toBeInTheDocument();
  });
});
