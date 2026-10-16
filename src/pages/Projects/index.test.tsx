import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getFirstBuildReadiness,
  type FirstBuildReadiness,
} from "@/api/first-build";
import { createProject, listProjects, type Project } from "@/api/project";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import Projects from ".";

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/api/first-build", () => ({ getFirstBuildReadiness: vi.fn() }));
vi.mock("@/store/auth", () => ({
  default: {
    useState: () => ({ initialized: true, accessToken: "synthetic-session" }),
  },
}));
vi.mock("@/store/user", () => ({
  default: { useState: () => ({ userinfo: { userId: "viewer" } }) },
}));
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
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
  });
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
  vi.mocked(getFirstBuildReadiness).mockResolvedValue({
    scopeOptions: [],
    scopeOptionsTruncated: false,
    canEnterScope: true,
    configuration: { access: "restricted" },
    agent: { access: "restricted" },
  });
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
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
  });
  expect(screen.getByRole("textbox", { name: "Organization ID" })).toHaveValue(
    "",
  );
  expect(createProject).not.toHaveBeenCalled();
});

const granted: FirstBuildReadiness = {
  scopeOptions: [{ scopeId: "team-build", source: "role_grant" }],
  scopeOptionsTruncated: false,
  canEnterScope: false,
  configuration: { access: "restricted" },
  agent: { access: "restricted" },
};

it("offers only returned role-grant scope IDs without selecting a default", async () => {
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(granted);
  const scope = await openForm();
  const select = screen.getByRole("combobox", {
    name: "Authorized organization scopes",
  });
  await waitFor(() => expect(select).not.toBeDisabled());
  expect(scope).toHaveValue("");
  expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
    "Choose a scope or enter an approved ID below",
    "team-build",
  ]);
  fireEvent.change(select, { target: { value: "team-build" } });
  expect(scope).toHaveValue("team-build");
  expect(useScopedPermission).toHaveBeenCalledWith("org", "team-build");
  expect(
    screen.getByRole("button", { name: "Create project" }),
  ).not.toBeDisabled();
});

it("lets an ordinary user enter an approved scope outside a truncated list, subject to scoped permission", async () => {
  vi.mocked(getFirstBuildReadiness).mockResolvedValue({
    ...granted,
    scopeOptions: [],
    scopeOptionsTruncated: true,
  });
  await openForm();
  await screen.findByText(
    "Scope lookup reached its limit. Other authorized scopes may not be shown; enter an approved ID below.",
  );
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await screen.findByText("Created project pipelines");
  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ orgId: "team-build" }),
  );
});

it("does not fabricate scopes or disable the existing manual flow when readiness fails", async () => {
  vi.mocked(getFirstBuildReadiness).mockRejectedValue(
    new Error("private diagnostics must not render"),
  );
  const scope = await openForm();
  await screen.findByText(/Authorized scopes unavailable/);
  expect(
    screen.getByRole("combobox", { name: "Authorized organization scopes" }),
  ).toBeDisabled();
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(scope).toHaveValue("");
  expect(screen.queryByText(/private diagnostics/)).not.toBeInTheDocument();
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await screen.findByText("Created project pipelines");
});

it("removes revoked grant choices on refresh and reports the authoritative create denial", async () => {
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(granted);
  const scope = await openForm();
  await screen.findByRole("option", { name: "team-build" });
  fillForm();
  vi.mocked(getFirstBuildReadiness).mockResolvedValue({
    ...granted,
    scopeOptions: [],
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh authorized scopes" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("option", { name: "team-build" }),
    ).not.toBeInTheDocument(),
  );
  // A bounded picker is not an authorization gate. The live POST check is authoritative.
  expect(scope).toHaveValue("  team-build  ");
  vi.mocked(createProject).mockRejectedValue(new Error("Permission denied"));
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await screen.findByText("Permission denied");
  expect(
    screen.queryByText("Created project pipelines"),
  ).not.toBeInTheDocument();
  expect(createProject).toHaveBeenCalledOnce();
});

it("refreshes missing setup into configured observations without changing scope inputs", async () => {
  const missing: FirstBuildReadiness = {
    ...granted,
    scopeOptions: [],
    canEnterScope: true,
    configuration: {
      access: "visible",
      defaultStorageConfigured: false,
      agentSigningConfigured: false,
    },
    agent: { access: "visible", enabledRecentlySeen: false },
  };
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(missing);
  await openForm();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByText(/Default artifact storage:/).closest("li"),
  ).toHaveTextContent("Not configured");
  vi.mocked(getFirstBuildReadiness).mockResolvedValue({
    ...missing,
    configuration: {
      access: "visible",
      defaultStorageConfigured: true,
      agentSigningConfigured: true,
    },
    agent: { access: "visible", enabledRecentlySeen: true },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh first-build status" }),
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Default artifact storage:/).closest("li"),
    ).toHaveTextContent("Configured (persisted record)"),
  );
  expect(screen.getByText(/Agent signing:/).closest("li")).toHaveTextContent(
    "Configured (persisted values)",
  );
  expect(screen.getByText(/Agent heartbeat:/).closest("li")).toHaveTextContent(
    "An enabled Agent was seen recently",
  );
  expect(createProject).not.toHaveBeenCalled();
});

it("hides old picker options during a failed refresh while keeping the manual value and labelling old setup stale", async () => {
  vi.mocked(getFirstBuildReadiness).mockResolvedValue(granted);
  const scope = await openForm();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Authorized organization scopes" }),
    { target: { value: "team-build" } },
  );
  let reject!: (error: Error) => void;
  vi.mocked(getFirstBuildReadiness).mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh authorized scopes" }),
  );
  expect(
    screen.queryByRole("option", { name: "team-build" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: "Authorized organization scopes" }),
  ).toBeDisabled();
  expect(scope).toHaveValue("team-build");
  await act(async () => reject(new Error("private debug details")));
  expect(screen.getByText(/Authorized scopes unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/private debug details/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("list", { name: "Previous setup snapshot" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "First-build status unavailable",
  );
});
