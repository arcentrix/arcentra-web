import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { get, post, put, del } from "@/api/client";
import { ApiError } from "@/lib/api-error";
import userStore from "@/store/user";
import Members from "./index";

const { auth } = vi.hoisted(() => ({
  auth: { initialized: true, accessToken: "session-one" },
}));
vi.mock("@/store/auth", () => ({ default: { useState: () => auth } }));
vi.mock("@/api", () => ({ Apis: { me: { getEffectiveActions: vi.fn() } } }));
vi.mock("@/api/client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

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
const associations = (projectId = "project-a", userId = "server-user") => ({
  list: [
    {
      projectId,
      userId,
      username: "",
      displayName: "",
      roleId: "",
      version: 1,
      hasOtherAccess: true,
      isProtectedOwner: false,
    },
  ],
  total: 1,
  canManageMembers: true,
  canAssignOwner: false,
  assignableRoleIds: ["project_developer", "project_reporter", "project_guest"],
});
function show(initial = "/projects/project-a/members") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function Harness() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <Routes>
        <Route path="/projects/:projectId/members" element={<Members />} />
        <Route path="/members" element={<Members />} />
        <Route
          path="/projects/:projectId"
          element={<p>Project destination</p>}
        />
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
    navigate: (to: string | number) =>
      act(() => {
        if (typeof to === "number") navigate(to);
        else navigate(to);
      }),
    get pathname() {
      return location.pathname;
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
  vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([
    "project:manage_member",
  ]);
  vi.mocked(get).mockResolvedValue(associations());
});
afterEach(cleanup);

describe("scoped project memberships", () => {
  it("shows only verified scoped identity and managed roles, with capability-gated controls", async () => {
    vi.mocked(get).mockResolvedValue({
      ...associations("project/a", "user/one"),
      list: [
        {
          ...associations("project/a", "user/one").list[0],
          name: "Unverified user",
          email: "not-trusted@example.test",
          role: "Owner",
        },
      ],
    });
    show("/projects/project%2Fa/members");
    expect(await screen.findByText("user/one")).toBeInTheDocument();
    expect(screen.getByText("1 recorded memberships")).toBeInTheDocument();
    expect(screen.getByText("No managed role")).toBeInTheDocument();
    expect(
      screen.getByText(/Other direct, team, or inherited grants/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to project" }),
    ).toHaveAttribute("href", "/projects/project%2Fa");
    expect(Apis.me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "project", scopeId: "project/a" },
      expect.any(AbortSignal),
    );
    expect(get).toHaveBeenCalledWith("/project/project%2Fa/members", {
      signal: expect.any(AbortSignal),
      silence: true,
      redactErrors: true,
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(
      /John Doe|Jane Smith|john@example|Owner|Unverified user|not-trusted@example/,
    );
    expect(screen.getByRole("button", { name: "Add member" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Edit role for user/one" }),
    ).toBeEnabled();
  });

  it("does not read permission or member data before sign-in or without a project", () => {
    auth.initialized = false;
    const view = show();
    expect(
      screen.getByText("Sign in to view project members."),
    ).toBeInTheDocument();
    expect(Apis.me.getEffectiveActions).not.toHaveBeenCalled();
    auth.initialized = true;
    view.rerenderSession();
    view.navigate("/members");
    expect(
      screen.getByText("Choose a project to view members."),
    ).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("waits for project-scoped permission and fails closed for read-only grants", async () => {
    const pending = deferred<string[]>();
    vi.mocked(Apis.me.getEffectiveActions).mockReturnValue(pending.promise);
    show();
    expect(
      screen.getByText("Checking project member access…"),
    ).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    await act(async () =>
      pending.resolve(["project:read", "org:manage_member"]),
    );
    expect(
      await screen.findByText("Members access restricted"),
    ).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue(["*:*"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Check member access again" }),
    );
    expect(await screen.findByText("server-user")).toBeInTheDocument();
  });

  it("shows permission failures with retry and does not read associations until access is verified", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockRejectedValueOnce(
      new Error("Permission service down"),
    );
    show();
    expect(
      await screen.findByText("Member access check unavailable"),
    ).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("server-user")).toBeInTheDocument();
  });

  it("shows real loading and an empty association state without implying nobody has access", async () => {
    const pending = deferred<unknown>();
    vi.mocked(get).mockReturnValue(pending.promise as ReturnType<typeof get>);
    show();
    expect(await screen.findByText("Loading members…")).toBeInTheDocument();
    expect(screen.queryByText(/recorded memberships$/)).not.toBeInTheDocument();
    await act(async () =>
      pending.resolve({
        list: null,
        total: 0,
        canManageMembers: true,
        canAssignOwner: false,
        assignableRoleIds: [
          "project_developer",
          "project_reporter",
          "project_guest",
        ],
      }),
    );
    expect(
      await screen.findByText("0 recorded memberships"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Other grants may still provide access/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Project members" }),
    ).not.toBeInTheDocument();
  });

  it.each([403, 500])(
    "hides prior rows after read failure (%i), and retries through permission checks",
    async (status) => {
      show();
      await screen.findByText("server-user");
      vi.mocked(get).mockRejectedValueOnce(
        new ApiError({
          status,
          message: "Member request failed",
          requestId: "member-trace",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
      expect(screen.queryByText("server-user")).not.toBeInTheDocument();
      expect(
        await screen.findByText(
          status === 403 ? "Members access restricted" : "Members unavailable",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("list", { name: "Project members" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("1 recorded memberships"),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "View diagnostics" }));
      expect(screen.getByText("member-trace")).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", {
          name: status === 403 ? "Check access again" : "Retry",
        }),
      );
      expect(await screen.findByText("server-user")).toBeInTheDocument();
      expect(Apis.me.getEffectiveActions).toHaveBeenCalledTimes(3);
    },
  );

  it("rejects the whole response when a row belongs to another project", async () => {
    vi.mocked(get).mockResolvedValue({
      list: [
        associations().list[0],
        { projectId: "other", userId: "private-other-user" },
      ],
      total: 2,
    });
    show();
    expect(await screen.findByText("Members unavailable")).toBeInTheDocument();
    expect(screen.queryByText("server-user")).not.toBeInTheDocument();
    expect(screen.queryByText("private-other-user")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Project members" }),
    ).not.toBeInTheDocument();
  });

  it("revokes displayed data and aborts a pending read when refreshed membership permission is denied", async () => {
    const pending = deferred<unknown>();
    let signal!: AbortSignal;
    vi.mocked(get).mockImplementation((_url, config) => {
      signal = config!.signal as AbortSignal;
      return pending.promise as ReturnType<typeof get>;
    });
    show();
    await waitFor(() => expect(signal).toBeDefined());
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
    expect(
      await screen.findByText("Members access restricted"),
    ).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(associations()));
    expect(screen.queryByText("server-user")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("discards rows and cached permissions on project navigation, including Back/Forward", async () => {
    const old = deferred<unknown>();
    let oldSignal!: AbortSignal;
    vi.mocked(get).mockImplementation((url, config) => {
      if (url === "/project/project-a/members") {
        oldSignal = config!.signal as AbortSignal;
        return old.promise as ReturnType<typeof get>;
      }
      return Promise.resolve(
        associations("project-b", "current-user"),
      ) as ReturnType<typeof get>;
    });
    const view = show();
    await waitFor(() => expect(oldSignal).toBeDefined());
    view.navigate("/projects/project-b/members");
    expect(await screen.findByText("current-user")).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => old.resolve(associations()));
    expect(screen.queryByText("server-user")).not.toBeInTheDocument();
    expect(Apis.me.getEffectiveActions).toHaveBeenLastCalledWith(
      { scopeType: "project", scopeId: "project-b" },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("link", { name: "Back to project" }));
    expect(screen.getByText("Project destination")).toBeInTheDocument();
    expect(view.pathname).toBe("/projects/project-b");
    view.navigate(-1);
    expect(await screen.findByText("current-user")).toBeInTheDocument();
    view.navigate(1);
    expect(screen.getByText("Project destination")).toBeInTheDocument();
  });

  it("isolates account changes and sign-out from late member reads", async () => {
    const old = deferred<unknown>();
    let signal!: AbortSignal;
    vi.mocked(get).mockImplementation((_url, config) => {
      signal = config!.signal as AbortSignal;
      return old.promise as ReturnType<typeof get>;
    });
    const view = show();
    await waitFor(() => expect(signal).toBeDefined());
    auth.accessToken = "session-two";
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    view.rerenderSession();
    expect(
      await screen.findByText("Members access restricted"),
    ).toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => old.resolve(associations()));
    expect(screen.queryByText("server-user")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    auth.initialized = false;
    view.rerenderSession();
    expect(
      screen.getByText("Sign in to view project members."),
    ).toBeInTheDocument();
  });

  it("does not start a member read from a stale permission response after navigation or unmount", async () => {
    const pending = deferred<string[]>();
    let signal!: AbortSignal;
    vi.mocked(Apis.me.getEffectiveActions).mockImplementation(
      (_scope, nextSignal) => {
        signal = nextSignal!;
        return pending.promise;
      },
    );
    const view = show();
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(["project:manage_member"]));
    expect(get).not.toHaveBeenCalled();
  });
  it.each(["loaded", "pending"])(
    "isolates %s associations when a cookie-only user identity changes without a navigation or forced render",
    async (state) => {
      auth.accessToken = "";
      setCookieUser("cookie-user-one");
      const pending = deferred<unknown>();
      let signal!: AbortSignal;
      vi.mocked(get).mockImplementation((_url, config) => {
        signal = config!.signal as AbortSignal;
        return (
          state === "pending"
            ? pending.promise
            : Promise.resolve(associations())
        ) as ReturnType<typeof get>;
      });
      show();
      await waitFor(() => expect(signal).toBeDefined());
      if (state === "loaded") await screen.findByText("server-user");
      vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
      await act(async () => setCookieUser("cookie-user-two"));
      expect(signal.aborted).toBe(true);
      expect(screen.queryByText("server-user")).not.toBeInTheDocument();
      expect(
        await screen.findByText("Members access restricted"),
      ).toBeInTheDocument();
      expect(Apis.me.getEffectiveActions).toHaveBeenCalledTimes(2);
      await act(async () => pending.resolve(associations()));
      expect(screen.queryByText("server-user")).not.toBeInTheDocument();
      expect(get).toHaveBeenCalledTimes(1);
    },
  );
});

describe("versioned member changes", () => {
  it("adds an existing user only once and suppresses Cancel/Close while saving", async () => {
    const pending = deferred<unknown>();
    vi.mocked(post).mockReturnValue(pending.promise as ReturnType<typeof post>);
    show();
    await screen.findByText("server-user");
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    fireEvent.change(screen.getByLabelText("User ID"), {
      target: { value: "new-user" },
    });
    expect(
      screen.queryByRole("option", { name: "Owner" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save membership" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      "/project/project-a/members",
      { userId: "new-user", roleId: "project_guest" },
      { silence: true, redactErrors: true },
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => pending.resolve({}));
    expect(await screen.findByText("Membership saved.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("edits roles and removes only the versioned membership, warning about other access", async () => {
    vi.mocked(put).mockResolvedValue({});
    vi.mocked(del).mockResolvedValue({});
    show();
    await screen.findByText("server-user");
    fireEvent.click(
      screen.getByRole("button", { name: "Edit role for server-user" }),
    );
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "project_reporter" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save membership" }));
    await screen.findByText("Membership saved.");
    expect(put).toHaveBeenCalledWith(
      "/project/project-a/members/server-user",
      { roleId: "project_reporter", version: 1 },
      { silence: true, redactErrors: true },
    );
    await screen.findByText("server-user");
    fireEvent.click(screen.getByRole("button", { name: "Remove server-user" }));
    expect(
      screen.getByText(/Separate grants can continue/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove membership" }));
    await screen.findByText(
      "Membership removed. Other grants may still provide access.",
    );
    expect(del).toHaveBeenCalledWith("/project/project-a/members/server-user", {
      data: { version: 1 },
      silence: true,
      redactErrors: true,
    });
  });
  it("does not expose edit/remove for protected owners", async () => {
    vi.mocked(get).mockResolvedValue({
      ...associations(),
      list: [
        {
          ...associations().list[0],
          isProtectedOwner: true,
          roleId: "project_owner",
        },
      ],
    });
    show();
    await screen.findByText("Protected owner");
    expect(
      screen.queryByRole("button", { name: "Remove server-user" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit role for server-user" }),
    ).not.toBeInTheDocument();
  });
  it("shows a live mutation denial, refreshes access and hides previously loaded member rows", async () => {
    vi.mocked(post).mockRejectedValue(
      new ApiError({ status: 403, message: "PRIVATE-CANARY" }),
    );
    show();
    await screen.findByText("server-user");
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    fireEvent.change(screen.getByLabelText("User ID"), {
      target: { value: "new-user" },
    });
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Save membership" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Access changed",
    );
    expect(screen.queryByText("server-user")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("PRIVATE-CANARY");
  });
  it("a write completing after route navigation does not reopen or navigate the old scope", async () => {
    const pending = deferred<unknown>();
    vi.mocked(post).mockReturnValue(pending.promise as ReturnType<typeof post>);
    const view = show();
    await screen.findByText("server-user");
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    fireEvent.change(screen.getByLabelText("User ID"), {
      target: { value: "new-user" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save membership" }));
    view.navigate("/projects/project-a");
    await act(async () => pending.resolve({}));
    expect(screen.getByText("Project destination")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Membership saved.")).not.toBeInTheDocument();
  });
});

it("does not offer changes to an additional owner when owner assignment is denied", async () => {
  vi.mocked(get).mockResolvedValue({
    ...associations(),
    list: [
      {
        ...associations().list[0],
        roleId: "project_owner",
        isProtectedOwner: false,
      },
    ],
  });
  show();
  await screen.findByText("Owner");
  expect(
    screen.queryByRole("button", { name: "Edit role for server-user" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Remove server-user" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add member" })).toBeEnabled();
});
