import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as client from "@/api/client";
import Secrets from ".";

vi.mock("@/api/client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
afterEach(cleanup);

describe("unconnected project secrets", () => {
  it("explicitly distinguishes unavailable inventory from an empty secrets list", () => {
    render(<Secrets />);
    expect(
      screen.getByRole("heading", { name: "Project secrets" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Project secret management is not connected."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No secret inventory has been loaded/),
    ).toHaveTextContent("cannot show whether the project has any secrets");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /API_KEY|DATABASE_URL|SECRET_TOKEN|AWS_ACCESS_KEY|GITHUB_TOKEN|SLACK_WEBHOOK|all envs|2024-01|0 keys|No secrets match/,
    );
    for (const request of Object.values(client))
      expect(request).not.toHaveBeenCalled();
  });

  it("keeps project navigation from fetching platform secrets or showing invented scope", async () => {
    let navigate!: ReturnType<typeof useNavigate>;
    function TestRoutes() {
      navigate = useNavigate();
      return (
        <Routes>
          <Route path="/projects/:projectId/secrets" element={<Secrets />} />
        </Routes>
      );
    }
    render(
      <MemoryRouter initialEntries={["/projects/project-1/secrets"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await act(async () => navigate("/projects/project-2/secrets"));
    expect(
      screen.getByText(/No secret inventory has been loaded/),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /scoped to this project|production|all envs/,
    );
    for (const request of Object.values(client))
      expect(request).not.toHaveBeenCalled();
  });
});
