import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getProject } from "@/api/project";
import { getProjectSettings } from "@/api/project/settings";
import { ApiError } from "@/lib/api-error";
import ProjectDetail from ".";
import ProjectSettings from "@/pages/Project/Settings";
vi.mock("@/store/auth", () => ({
  default: {
    useState: () => ({ initialized: true, accessToken: "synthetic-session" }),
  },
}));
vi.mock("@/api/project", () => ({ getProject: vi.fn() }));
vi.mock("@/api/project/settings", () => ({ getProjectSettings: vi.fn() }));
const project = {
  projectId: "project-one",
  orgId: "org-one",
  name: "PRIVATE-NAME-CANARY",
  displayName: "PRIVATE-DISPLAY-CANARY",
  description: "PRIVATE-DESCRIPTION-CANARY",
  repoUrl: "https://example.test/PRIVATE-REPO-CANARY",
  defaultBranch: "main",
  status: 1,
  isEnabled: 1,
  totalPipelines: 0,
  totalBuilds: 0,
  successBuilds: 0,
  failedBuilds: 0,
};
const settings = {
  ...project,
  version: "version-one",
  tags: "",
  language: "",
  framework: "",
  visibility: 0,
  canUpdate: true,
  canArchive: true,
  canRestore: false,
};
const show = () =>
  render(
    <MemoryRouter initialEntries={["/projects/project-one/settings"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetail />}>
          <Route path="settings" element={<ProjectSettings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProject).mockResolvedValue(project);
  vi.mocked(getProjectSettings).mockResolvedValue(settings);
});
afterEach(cleanup);
it("hides the surrounding project shell when the settings read loses project access", async () => {
  show();
  await screen.findByRole("button", { name: "Edit settings" });
  expect(document.body).toHaveTextContent("PRIVATE-DISPLAY-CANARY");
  vi.mocked(getProjectSettings).mockRejectedValue(
    new ApiError({ status: 403, message: "RAW-ERROR-CANARY" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh settings" }));
  await screen.findByRole("heading", { name: "Project access restricted" });
  expect(document.body).not.toHaveTextContent("CANARY");
  expect(
    screen.queryByRole("button", { name: "Edit settings" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
  vi.mocked(getProjectSettings).mockResolvedValue(settings);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("button", { name: "Edit settings" });
  expect(
    screen.getByRole("heading", { name: "PRIVATE-DISPLAY-CANARY" }),
  ).toBeInTheDocument();
});
it("never displays a raw project-shell error body", async () => {
  vi.mocked(getProject).mockRejectedValue(new Error("RAW-SERVER-CANARY"));
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Project unavailable",
  );
  expect(document.body).not.toHaveTextContent("CANARY");
});
