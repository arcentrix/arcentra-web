import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProject, listProjects, type Project } from "@/api/project";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import Projects from ".";

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/api/project", () => ({
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));
vi.mock("@/hooks/use-scoped-permission", () => ({
  useScopedPermission: vi.fn((_scope: string, id: string) => ({
    has: (action: string) =>
      access.allowed && !!id && action === "org:create_project",
    loading: false,
    data: id ? (access.allowed ? ["org:create_project"] : []) : undefined,
    refresh: vi.fn(),
  })),
}));

const help =
  "Enter a stable organization scope ID approved by your administrator. Creating a project does not create an organization. Organization and member management are not available yet.";
const project: Project = {
  projectId: "project-new",
  orgId: "team-build",
  name: "service",
  displayName: "service",
  description: "",
  repoUrl: "https://example.com/repo.git",
  defaultBranch: "main",
  status: 1,
  isEnabled: 1,
  totalPipelines: 0,
  totalBuilds: 0,
  successBuilds: 0,
  failedBuilds: 0,
};

async function openForm() {
  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/projects" element={<Projects />} />
        <Route
          path="/projects/:id/pipelines"
          element={<p>Created project pipelines</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Connect your first project");
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  return screen.getByRole("textbox", { name: "Organization ID" });
}

function fillForm() {
  for (const [label, value] of [
    ["Organization ID", "  team-build  "],
    ["Project name", " service "],
    ["Repository URL", " https://example.com/repo.git "],
    ["Default branch", " main "],
  ])
    fireEvent.change(screen.getByRole("textbox", { name: label }), {
      target: { value },
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  access.allowed = true;
  vi.mocked(listProjects).mockResolvedValue({
    list: [],
    total: 0,
    pageNum: 1,
    pageSize: 20,
  });
  vi.mocked(createProject).mockResolvedValue(project);
});
afterEach(cleanup);

it("describes the administrator-provided scope without a default or changing the field name", async () => {
  const scope = await openForm();
  expect(scope).toHaveValue("");
  expect(scope).toHaveAccessibleName("Organization ID");
  expect(scope).toHaveAccessibleDescription(help);
  const description = screen.getByText(help);
  expect(description.closest("label")).toBeNull();
  expect(useScopedPermission).toHaveBeenCalledWith("org", "");
  expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
  expect(createProject).not.toHaveBeenCalled();
});

it("preserves the exact project payload and permission check for the entered scope", async () => {
  await openForm();
  fillForm();
  expect(useScopedPermission).toHaveBeenCalledWith("org", "team-build");
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await screen.findByText("Created project pipelines");
  expect(createProject).toHaveBeenCalledOnce();
  expect(createProject).toHaveBeenCalledWith({
    orgId: "team-build",
    name: "service",
    repoUrl: "https://example.com/repo.git",
    defaultBranch: "main",
    description: "",
  });
});

it("keeps missing organization permission blocked even on a forced form submit", async () => {
  access.allowed = false;
  const scope = await openForm();
  fillForm();
  expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "You do not have permission to create projects in this organization.",
  );
  fireEvent.submit(scope.closest("form")!);
  await waitFor(() => expect(createProject).not.toHaveBeenCalled());
});

it("discards the entered scope on Cancel and does not create a project", async () => {
  await openForm();
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByRole("textbox", { name: "Organization ID" })).toHaveValue(
    "",
  );
  expect(createProject).not.toHaveBeenCalled();
});
