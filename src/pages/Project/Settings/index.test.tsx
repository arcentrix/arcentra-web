import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProject, type Project } from "@/api/project";
import { ApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import ProjectSettings from ".";

vi.mock("@/api/project", () => ({ getProject: vi.fn() }));

const project: Project = {
  projectId: "project-1",
  orgId: "scope-actual",
  name: "worker-service",
  displayName: "Build workers",
  description: "Runs our build workers",
  repoUrl: "https://example.test/team/workers.git",
  defaultBranch: "release",
  status: 0,
  isEnabled: 1,
  totalPipelines: 2,
  totalBuilds: 3,
  successBuilds: 2,
  failedBuilds: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function renderPage(initial = "/projects/project-1/settings") {
  let navigate!: ReturnType<typeof useNavigate>;
  function TestRoutes() {
    navigate = useNavigate();
    return (
      <Routes>
        <Route
          path="/projects/:projectId/settings"
          element={<ProjectSettings />}
        />
        <Route path="/settings" element={<ProjectSettings />} />
      </Routes>
    );
  }
  render(
    <MemoryRouter initialEntries={[initial]}>
      <TestRoutes />
    </MemoryRouter>,
  );
  return {
    navigate: (to: string | number) =>
      typeof to === "number" ? navigate(to) : navigate(to),
  };
}

function details() {
  return within(screen.getByLabelText("Project details"));
}

beforeEach(() => {
  vi.resetAllMocks();
  authStore.updateState((state) => {
    state.initialized = true;
    state.accessToken = "synthetic-session-one";
  });
  userStore.updateState((state) => {
    state.userinfo = null;
  });
  vi.mocked(getProject).mockResolvedValue(project);
});
afterEach(() => {
  cleanup();
  authStore.updateState((state) => {
    state.initialized = false;
    state.accessToken = "";
  });
  userStore.updateState((state) => {
    state.userinfo = null;
  });
});

describe("read-only project settings", () => {
  it("shows loading without fabricated fields, then reads the routed project snapshot", async () => {
    const request = deferred<Project>();
    vi.mocked(getProject).mockReturnValueOnce(request.promise);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading project settings",
    );
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh settings" }),
    ).toBeDisabled();
    expect(document.body).not.toHaveTextContent("github.com/arcentrix/project");
    expect(document.body).not.toHaveTextContent("Project description");
    await act(async () => request.resolve(project));
    expect(getProject).toHaveBeenCalledOnce();
    expect(getProject).toHaveBeenCalledWith(
      "project-1",
      expect.any(AbortSignal),
    );
    for (const value of [
      project.projectId,
      project.orgId,
      project.name,
      project.displayName,
      project.description,
      project.repoUrl,
      project.defaultBranch,
    ])
      expect(details().getByText(value)).toBeInTheDocument();
    expect(details().getByText("Scope ID")).toBeInTheDocument();
    expect(details().queryByText(/organization/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(document.body).not.toHaveTextContent(
      /Save changes|7 days|Danger zone/,
    );
    for (const name of ["Archive project", "Delete project", "Save changes"])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("renders only allowed text fields and never unknown credential fields", async () => {
    vi.mocked(getProject).mockResolvedValue({
      ...project,
      token: "UNEXPECTED-TOKEN-CANARY",
      sshPrivateKey: "PRIVATE-KEY-CANARY",
      visibility: "INVENTED-VISIBILITY",
      authConfig: { password: "PASSWORD-CANARY" },
    } as Project);
    renderPage();
    await screen.findByText(project.displayName);
    expect(document.body.innerHTML).not.toMatch(/CANARY|INVENTED-VISIBILITY/);
    expect(details().queryByText("Visibility")).not.toBeInTheDocument();
  });

  it("marks missing or malformed optional fields without making up values", async () => {
    vi.mocked(getProject).mockResolvedValue({
      projectId: "project-1",
      orgId: "",
      name: " ",
      displayName: undefined,
      description: null,
      defaultBranch: { token: "OBJECT-SECRET-CANARY" },
      repoUrl: "",
    } as unknown as Project);
    renderPage();
    await screen.findByText("project-1");
    expect(details().getAllByText("Not provided")).toHaveLength(6);
    expect(document.body).not.toHaveTextContent(/main|internal|CANARY/);
  });

  it.each([
    [
      "https://TOKEN-CANARY:PASSWORD-CANARY@example.test/team/repo.git?token=QUERY-CANARY#FRAGMENT-CANARY",
      "https://example.test/team/repo.git",
    ],
    [
      "ssh://TOKEN-CANARY@example.test:2222/team/repo.git?secret=QUERY-CANARY",
      "ssh://example.test:2222/team/repo.git",
    ],
    [
      "TOKEN-CANARY@example.test:team/repo.git?token=QUERY-CANARY",
      "example.test:team/repo.git",
    ],
    ["javascript:alert('SCRIPT-CANARY')", "Unsupported repository address"],
    ["data:text/html,DATA-CANARY", "Unsupported repository address"],
    ["invalid-ADDRESS-CANARY", "Unsupported repository address"],
  ])(
    "keeps repository addresses non-actionable and removes credentials: %s",
    async (repoUrl, visible) => {
      vi.mocked(getProject).mockResolvedValue({ ...project, repoUrl });
      renderPage();
      expect(await screen.findByText(visible)).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain("CANARY");
    },
  );

  it.each([{ status: 401 }, { status: 403 }, { status: 200, code: 403 }])(
    "hides the old snapshot on a denied refresh (%j) and can retry",
    async (errorCode) => {
      const refresh = deferred<Project>();
      const retry = deferred<Project>();
      vi.mocked(getProject)
        .mockResolvedValueOnce(project)
        .mockReturnValueOnce(refresh.promise)
        .mockReturnValueOnce(retry.promise);
      renderPage();
      await screen.findByText(project.name);
      const button = screen.getByRole("button", { name: "Refresh settings" });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(button).toBeDisabled();
      expect(getProject).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(project.name)).not.toBeInTheDocument();
      await act(async () =>
        refresh.reject(
          new ApiError({ ...errorCode, message: "PRIVATE-ERROR-CANARY" }),
        ),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("access restricted");
      expect(
        screen.queryByLabelText("Project details"),
      ).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain("PRIVATE-ERROR-CANARY");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(screen.getByRole("status")).toHaveTextContent("Loading");
      expect(screen.queryByText(project.name)).not.toBeInTheDocument();
      await act(async () =>
        retry.resolve({ ...project, name: "recovered-project" }),
      );
      expect(screen.getByText("recovered-project")).toBeInTheDocument();
    },
  );

  it("hides the snapshot on transport failures without exposing raw server errors", async () => {
    vi.mocked(getProject)
      .mockResolvedValueOnce(project)
      .mockRejectedValueOnce(new Error("RAW-PAYLOAD-CANARY"));
    renderPage();
    await screen.findByText(project.name);
    fireEvent.click(screen.getByRole("button", { name: "Refresh settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Project settings unavailable",
    );
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("RAW-PAYLOAD-CANARY");
  });

  it("clears loaded project data on route changes and ignores late responses across back navigation", async () => {
    const second = deferred<Project>();
    const back = deferred<Project>();
    vi.mocked(getProject)
      .mockResolvedValueOnce(project)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(back.promise);
    const router = renderPage();
    await screen.findByText(project.name);
    const firstSignal = vi.mocked(getProject).mock.calls[0][1]!;
    await act(async () => router.navigate("/projects/project-2/settings"));
    expect(firstSignal.aborted).toBe(true);
    expect(getProject).toHaveBeenLastCalledWith(
      "project-2",
      expect.any(AbortSignal),
    );
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    const secondSignal = vi.mocked(getProject).mock.calls[1][1]!;
    await act(async () => router.navigate(-1));
    expect(secondSignal.aborted).toBe(true);
    await act(async () =>
      back.resolve({ ...project, name: "fresh-first-project" }),
    );
    expect(screen.getByText("fresh-first-project")).toBeInTheDocument();
    await act(async () =>
      second.resolve({
        ...project,
        projectId: "project-2",
        name: "late-second-project",
      }),
    );
    expect(screen.queryByText("late-second-project")).not.toBeInTheDocument();
    expect(screen.getByText("fresh-first-project")).toBeInTheDocument();
  });

  it("discards an initial request that completes after a newer project route", async () => {
    const first = deferred<Project>();
    vi.mocked(getProject)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        ...project,
        projectId: "project-2",
        name: "second-project",
      });
    const router = renderPage();
    await act(async () => router.navigate("/projects/project-2/settings"));
    expect(screen.getByText("second-project")).toBeInTheDocument();
    await act(async () => first.resolve(project));
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.getByText("second-project")).toBeInTheDocument();
  });

  it.each([null, { ...project, projectId: "another-project" }])(
    "does not present an empty or different-project response as a valid snapshot",
    async (response) => {
      vi.mocked(getProject).mockResolvedValue(response as Project);
      renderPage();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No settings snapshot was returned for this project",
      );
      expect(
        screen.queryByLabelText("Project details"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    },
  );

  it.each([
    { initialized: false, accessToken: "synthetic-session-one" },
    { initialized: false, accessToken: "" },
  ])(
    "does not read settings before authentication is ready (%j)",
    (session) => {
      authStore.updateState((state) => Object.assign(state, session));
      renderPage();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sign in to view project settings",
      );
      expect(getProject).not.toHaveBeenCalled();
      expect(
        screen.queryByLabelText("Project details"),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("preserves initialized cookie sessions and rebuilds when their user identity changes", async () => {
    const nextAccount = deferred<Project>();
    authStore.updateState((state) => {
      state.accessToken = "";
    });
    userStore.updateState((state) => {
      state.userinfo = {
        userId: "cookie-user-one",
        username: "first-user",
        fullName: "First user",
        email: "",
        phone: "",
        avatar: "",
      };
    });
    vi.mocked(getProject)
      .mockResolvedValueOnce(project)
      .mockReturnValueOnce(nextAccount.promise);
    renderPage();
    await screen.findByText(project.name);
    const oldSignal = vi.mocked(getProject).mock.calls[0][1]!;
    await act(async () => {
      userStore.updateState((state) => {
        state.userinfo = { ...state.userinfo!, userId: "cookie-user-two" };
      });
    });
    expect(oldSignal.aborted).toBe(true);
    expect(getProject).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    await act(async () =>
      nextAccount.resolve({ ...project, name: "cookie-account-project" }),
    );
    expect(screen.getByText("cookie-account-project")).toBeInTheDocument();
  });

  it("subscribes to same-route account changes and discards the previous account snapshot", async () => {
    const nextAccount = deferred<Project>();
    vi.mocked(getProject)
      .mockResolvedValueOnce(project)
      .mockReturnValueOnce(nextAccount.promise);
    renderPage();
    await screen.findByText(project.name);
    const oldSignal = vi.mocked(getProject).mock.calls[0][1]!;
    // Update the real auth store without navigating or manually rerendering.
    await act(async () => {
      authStore.updateState((state) => {
        state.accessToken = "synthetic-session-two";
      });
    });
    expect(oldSignal.aborted).toBe(true);
    expect(getProject).toHaveBeenCalledTimes(2);
    expect(getProject).toHaveBeenLastCalledWith(
      "project-1",
      expect.any(AbortSignal),
    );
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    await act(async () =>
      nextAccount.resolve({ ...project, name: "new-account-project" }),
    );
    expect(screen.getByText("new-account-project")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("synthetic-session");
  });

  it("aborts the old account's in-flight request and ignores its late response", async () => {
    const oldAccount = deferred<Project>();
    vi.mocked(getProject)
      .mockReturnValueOnce(oldAccount.promise)
      .mockResolvedValueOnce({ ...project, name: "new-account-project" });
    renderPage();
    const oldSignal = vi.mocked(getProject).mock.calls[0][1]!;
    await act(async () => {
      authStore.updateState((state) => {
        state.accessToken = "synthetic-session-two";
      });
    });
    expect(oldSignal.aborted).toBe(true);
    expect(screen.getByText("new-account-project")).toBeInTheDocument();
    await act(async () => oldAccount.resolve(project));
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.getByText("new-account-project")).toBeInTheDocument();
  });

  it("drops loaded details on sign-out, aborts refresh, and reloads even when the same token returns", async () => {
    const refresh = deferred<Project>();
    const signedBackIn = deferred<Project>();
    vi.mocked(getProject)
      .mockResolvedValueOnce(project)
      .mockReturnValueOnce(refresh.promise)
      .mockReturnValueOnce(signedBackIn.promise);
    renderPage();
    await screen.findByText(project.name);
    fireEvent.click(screen.getByRole("button", { name: "Refresh settings" }));
    const refreshSignal = vi.mocked(getProject).mock.calls[1][1]!;
    await act(async () => {
      authStore.updateState((state) => {
        state.initialized = false;
        state.accessToken = "";
      });
    });
    expect(refreshSignal.aborted).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Sign in");
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await act(async () =>
      refresh.resolve({ ...project, name: "late-refresh-project" }),
    );
    expect(document.body).not.toHaveTextContent("late-refresh-project");
    expect(getProject).toHaveBeenCalledTimes(2);
    await act(async () => {
      authStore.updateState((state) => {
        state.initialized = true;
        state.accessToken = "synthetic-session-one";
      });
    });
    expect(getProject).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    await act(async () =>
      signedBackIn.resolve({ ...project, name: "fresh-sign-in-project" }),
    );
    expect(screen.getByText("fresh-sign-in-project")).toBeInTheDocument();
  });

  it("clears displayed details if the session becomes uninitialized without changing the token", async () => {
    renderPage();
    await screen.findByText(project.name);
    const signal = vi.mocked(getProject).mock.calls[0][1]!;
    await act(async () => {
      authStore.updateState((state) => {
        state.initialized = false;
      });
    });
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Sign in");
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(getProject).toHaveBeenCalledOnce();
  });

  it("does not request or invent settings without a project route identity", () => {
    renderPage("/settings");
    expect(screen.getByRole("alert")).toHaveTextContent("Select a project");
    expect(getProject).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
