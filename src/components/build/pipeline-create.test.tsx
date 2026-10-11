import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePipelineDialog } from "./pipeline-dialogs";
import { createPipeline } from "@/api/pipeline";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/hooks/use-scoped-permission", () => ({
  useScopedPermission: vi.fn(() => ({
    has: () => access.allowed,
    loading: false,
    data: access.allowed ? ["pipeline:create"] : [],
    refresh: vi.fn(),
  })),
}));
vi.mock("@/api/pipeline", () => ({ createPipeline: vi.fn() }));
vi.mock("@/api/project", () => ({
  getProject: vi.fn(async () => ({
    projectId: "project-1",
    repoUrl: "https://example.com/api.git",
    defaultBranch: "main",
  })),
  listProjects: vi.fn(),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  access.allowed = true;
});
describe("project-scoped pipeline creation", () => {
  it("permits project-level creators without needing a platform grant", async () => {
    vi.mocked(createPipeline).mockResolvedValue({ pipelineID: "new-pipeline" });
    const created = vi.fn();
    render(
      <CreatePipelineDialog
        projectId="project-1"
        onClose={vi.fn()}
        onCreated={created}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Repository URL")).toHaveValue(
        "https://example.com/api.git",
      ),
    );
    fireEvent.change(screen.getByLabelText("Pipeline name"), {
      target: { value: "Build" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create pipeline" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith("new-pipeline"));
    expect(useScopedPermission).toHaveBeenCalledWith("project", "project-1");
    expect(createPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1", name: "Build" }),
    );
  });
  it("blocks submission for a project where create permission is absent", async () => {
    access.allowed = false;
    render(
      <CreatePipelineDialog
        projectId="project-1"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Repository URL")).toHaveValue(
        "https://example.com/api.git",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Create pipeline" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "You do not have permission to create pipelines in this project.",
      ),
    ).toBeInTheDocument();
    expect(createPipeline).not.toHaveBeenCalled();
  });
});
