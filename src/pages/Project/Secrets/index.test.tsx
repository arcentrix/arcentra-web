import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api/project-secrets";
import { ApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import Secrets from ".";
vi.mock("@/api/project-secrets", async (original) => ({
  ...(await original<typeof api>()),
  listProjectSecrets: vi.fn(),
  createProjectSecret: vi.fn(),
  updateProjectSecret: vi.fn(),
  rotateProjectSecret: vi.fn(),
  disableProjectSecret: vi.fn(),
}));
const secret: api.ProjectSecret = {
  projectId: "project-1",
  secretId: "secret-1",
  name: "CI_TOKEN",
  secretType: "token",
  description: "Synthetic metadata",
  version: "opaque-v1",
  isEnabled: 1,
  configured: true,
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  canUpdate: true,
  canRotate: true,
  canDisable: true,
};
const inventory: api.ProjectSecretList = {
  projectId: "project-1",
  list: [secret],
  total: 1,
  canCreate: true,
  canWrite: true,
  canDisable: true,
  projectActive: true,
  encryptionConfigured: true,
};
const syntheticValue = "synthetic-ci-secret-initial001";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function renderPage() {
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
  return { navigate: (path: string) => navigate(path) };
}
const button = (name: string) => screen.getByRole("button", { name });
const fillValue = () =>
  fireEvent.change(screen.getByLabelText("New secret value"), {
    target: { value: syntheticValue },
  });
const expectCleared = () => {
  expect(document.body.textContent).not.toContain(syntheticValue);
  expect(document.body.innerHTML).not.toContain(syntheticValue);
  for (const field of document.querySelectorAll("input,textarea"))
    expect((field as HTMLInputElement).value).not.toContain(syntheticValue);
};
beforeEach(() => {
  vi.resetAllMocks();
  authStore.updateState((s) => {
    s.initialized = true;
    s.accessToken = "synthetic-session-1";
  });
  userStore.updateState((s) => {
    s.userinfo = null;
  });
  vi.mocked(api.listProjectSecrets).mockResolvedValue(inventory);
});
afterEach(() => {
  cleanup();
  authStore.updateState((s) => {
    s.initialized = false;
    s.accessToken = "";
  });
});
describe("project secrets management", () => {
  it("requires sign-in and only reads the exact routed project", async () => {
    authStore.updateState((s) => {
      s.initialized = false;
    });
    renderPage();
    expect(
      screen.getByText("Sign in to view project secrets."),
    ).toBeInTheDocument();
    expect(api.listProjectSecrets).not.toHaveBeenCalled();
    await act(async () =>
      authStore.updateState((s) => {
        s.initialized = true;
      }),
    );
    expect(await screen.findByText("CI_TOKEN")).toBeInTheDocument();
    expect(api.listProjectSecrets).toHaveBeenCalledWith(
      "project-1",
      expect.any(AbortSignal),
    );
    expect(
      screen.queryByRole("button", { name: /copy|reveal/i }),
    ).not.toBeInTheDocument();
  });
  it("distinguishes empty inventory from failure", async () => {
    vi.mocked(api.listProjectSecrets).mockResolvedValueOnce({
      ...inventory,
      total: 0,
      list: [],
    });
    renderPage();
    expect(
      await screen.findByText("No secrets are recorded for this project."),
    ).toBeInTheDocument();
    vi.mocked(api.listProjectSecrets).mockRejectedValue(
      new Error(syntheticValue),
    );
    fireEvent.click(button("Refresh secrets"));
    expect(
      await screen.findByText("Project secrets unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0 recorded/)).not.toBeInTheDocument();
    expectCleared();
  });
  it("creates only after valid input, clears immediately, and prevents double submission", async () => {
    const pending = deferred<api.ProjectSecret>();
    vi.mocked(api.createProjectSecret).mockReturnValue(pending.promise);
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Create secret"));
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByRole("button", { name: "Create secret" }),
    ).toBeDisabled();
    fireEvent.change(dialog.getByLabelText("Secret name"), {
      target: { value: "NEW_CI_TOKEN" },
    });
    fillValue();
    const form = dialog.getByLabelText("Secret name").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.createProjectSecret).toHaveBeenCalledOnce();
    expect(api.createProjectSecret).toHaveBeenCalledWith("project-1", {
      name: "NEW_CI_TOKEN",
      secretType: "token",
      description: "",
      value: syntheticValue,
    });
    expectCleared();
    await act(async () => pending.resolve({ ...secret, name: "NEW_CI_TOKEN" }));
    expect(await screen.findByText("Secret created.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expectCleared();
  });
  it("edits metadata with no value field and the exact opaque version", async () => {
    vi.mocked(api.updateProjectSecret).mockResolvedValue({
      ...secret,
      version: "opaque-v2",
    });
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Edit metadata for CI_TOKEN"));
    expect(screen.queryByLabelText("New secret value")).not.toBeInTheDocument();
    expect(button("Save metadata")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Updated metadata" },
    });
    fireEvent.click(button("Save metadata"));
    await screen.findByText(
      "Secret metadata updated. The stored value was preserved.",
    );
    expect(api.updateProjectSecret).toHaveBeenCalledWith(
      "project-1",
      "secret-1",
      { version: "opaque-v1", description: "Updated metadata" },
    );
  });
  it("rotates explicitly after acknowledging delivery limits", async () => {
    vi.mocked(api.rotateProjectSecret).mockResolvedValue({
      ...secret,
      version: "opaque-v2",
    });
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Rotate CI_TOKEN"));
    expect(screen.getByLabelText("New secret value")).toHaveValue("");
    fillValue();
    expect(button("Rotate secret")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button("Rotate secret"));
    await screen.findByText(
      "Secret rotated. Later resolutions will use the new value.",
    );
    expect(api.rotateProjectSecret).toHaveBeenCalledWith(
      "project-1",
      "secret-1",
      { version: "opaque-v1", value: syntheticValue },
    );
    expectCleared();
  });
  it("disables explicitly without offering enable, delete, or value access", async () => {
    vi.mocked(api.disableProjectSecret).mockResolvedValue({
      ...secret,
      isEnabled: 0,
    });
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Disable CI_TOKEN"));
    expect(screen.queryByLabelText("New secret value")).not.toBeInTheDocument();
    expect(button("Disable secret")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button("Disable secret"));
    await screen.findByText(
      "Secret disabled. Later resolutions will no longer receive this secret.",
    );
    expect(api.disableProjectSecret).toHaveBeenCalledWith(
      "project-1",
      "secret-1",
      "opaque-v1",
    );
  });
  it.each(["Cancel", "Close"])(
    "clears values on %s and on reopening",
    async (action) => {
      renderPage();
      await screen.findByText("CI_TOKEN");
      fireEvent.click(button("Rotate CI_TOKEN"));
      fillValue();
      fireEvent.click(button(action));
      expectCleared();
      fireEvent.click(button("Rotate CI_TOKEN"));
      expect(screen.getByLabelText("New secret value")).toHaveValue("");
      expect(api.rotateProjectSecret).not.toHaveBeenCalled();
    },
  );
  it("Escape clears values without sending", async () => {
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Rotate CI_TOKEN"));
    fillValue();
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expectCleared();
    expect(api.rotateProjectSecret).not.toHaveBeenCalled();
  });
  it.each([403, 409, 503, 400, 500])(
    "clears inputs, hides old metadata, and never retries a %s mutation",
    async (status) => {
      vi.mocked(api.rotateProjectSecret).mockRejectedValue(
        new ApiError({ status, message: syntheticValue }),
      );
      renderPage();
      await screen.findByText("CI_TOKEN");
      fireEvent.click(button("Rotate CI_TOKEN"));
      fillValue();
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(button("Rotate secret"));
      await screen.findByRole("alert");
      expectCleared();
      expect(screen.queryByText("CI_TOKEN")).not.toBeInTheDocument();
      expect(api.rotateProjectSecret).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it("hides stale metadata after a denied refresh", async () => {
    renderPage();
    await screen.findByText("CI_TOKEN");
    vi.mocked(api.listProjectSecrets).mockRejectedValue(
      new ApiError({ status: 403, message: syntheticValue }),
    );
    fireEvent.click(button("Refresh secrets"));
    expect(screen.queryByText("CI_TOKEN")).not.toBeInTheDocument();
    await screen.findByText("Secret access restricted");
    expect(screen.queryByText("Synthetic metadata")).not.toBeInTheDocument();
    expectCleared();
  });
  it("shows precise missing key, permission, lifecycle, and disabled blockers", async () => {
    vi.mocked(api.listProjectSecrets).mockResolvedValue({
      ...inventory,
      encryptionConfigured: false,
      canCreate: false,
      list: [{ ...secret, canRotate: false }],
    });
    const view = renderPage();
    await screen.findByText("CI_TOKEN");
    expect(button("Create secret")).toBeDisabled();
    expect(button("Rotate CI_TOKEN")).toBeDisabled();
    expect(button("Edit metadata for CI_TOKEN")).not.toBeDisabled();
    expect(
      screen.getByText(/server encryption key is unavailable/),
    ).toBeInTheDocument();
    vi.mocked(api.listProjectSecrets).mockResolvedValue({
      ...inventory,
      projectId: "project-2",
      canCreate: false,
      canWrite: false,
      canDisable: false,
      list: [
        {
          ...secret,
          projectId: "project-2",
          canUpdate: false,
          canRotate: false,
          canDisable: false,
        },
      ],
    });
    await act(async () => view.navigate("/projects/project-2/secrets"));
    await screen.findByText("CI_TOKEN");
    expect(
      screen.getByText(/Current access requires secret:write/),
    ).toBeInTheDocument();
    vi.mocked(api.listProjectSecrets).mockResolvedValue({
      ...inventory,
      projectId: "project-2",
      projectActive: false,
      canCreate: false,
      list: [
        {
          ...secret,
          projectId: "project-2",
          isEnabled: 0,
          canUpdate: false,
          canRotate: false,
          canDisable: false,
        },
      ],
    });
    fireEvent.click(button("Refresh secrets"));
    await screen.findByText(/project or its organization is inactive/);
    expect(button("Disable CI_TOKEN")).toBeDisabled();
    expect(
      screen.getByText(/Disabled secrets cannot be changed/),
    ).toBeInTheDocument();
  });
  it.each(["project", "account", "signout", "focus"])(
    "clears inputs and drops stale responses on %s change",
    async (change) => {
      renderPage();
      await screen.findByText("CI_TOKEN");
      fireEvent.click(button("Rotate CI_TOKEN"));
      fillValue();
      const discardedField = screen.getByLabelText(
        "New secret value",
      ) as HTMLInputElement;
      const next = deferred<api.ProjectSecretList>();
      vi.mocked(api.listProjectSecrets).mockReturnValue(next.promise);
      if (change === "project") {
        cleanup();
        render(
          <MemoryRouter initialEntries={["/projects/project-2/secrets"]}>
            <Routes>
              <Route
                path="/projects/:projectId/secrets"
                element={<Secrets />}
              />
            </Routes>
          </MemoryRouter>,
        );
      } else
        await act(async () => {
          if (change === "account")
            authStore.updateState((s) => {
              s.accessToken = "synthetic-session-2";
            });
          else if (change === "signout")
            authStore.updateState((s) => {
              s.initialized = false;
            });
          else window.dispatchEvent(new Event("focus"));
        });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(discardedField.value).toBe("");
      expect(screen.queryByText("CI_TOKEN")).not.toBeInTheDocument();
      expectCleared();
    },
  );
});

describe("masked credential input", () => {
  it("uses a native password control and clears it before changing the secret type", async () => {
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Create secret"));
    fillValue();
    expect(screen.getByLabelText("New secret value")).toHaveAttribute(
      "type",
      "password",
    );
    fireEvent.change(screen.getByLabelText("Secret type"), {
      target: { value: "env" },
    });
    expectCleared();
    expect(screen.getByLabelText("New secret value")).toHaveValue("");
  });
  it("fails closed if the browser cannot mask multiline SSH keys", async () => {
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Create secret"));
    fireEvent.change(screen.getByLabelText("Secret type"), {
      target: { value: "ssh_key" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "cannot mask multiline SSH keys",
    );
    expect(screen.queryByLabelText("New secret value")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create secret",
      }),
    ).toBeDisabled();
  });
  it("does not abandon a submitted mutation when the window regains focus", async () => {
    const pending = deferred<api.ProjectSecret>();
    vi.mocked(api.rotateProjectSecret).mockReturnValue(pending.promise);
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Rotate CI_TOKEN"));
    fillValue();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button("Rotate secret"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expectCleared();
    await act(async () => pending.resolve({ ...secret, version: "opaque-v2" }));
    expect(
      await screen.findByText(
        "Secret rotated. Later resolutions will use the new value.",
      ),
    ).toBeInTheDocument();
  });
});

describe("inventory and Unicode boundaries", () => {
  it("explains the complete inventory creation limit while keeping existing rows manageable", async () => {
    vi.mocked(api.listProjectSecrets).mockResolvedValue({
      ...inventory,
      total: 1000,
      canCreate: false,
      list: Array.from({ length: 1000 }, (_, index) => ({
        ...secret,
        secretId: `secret-${index}`,
        name: `CI_TOKEN_${index}`,
      })),
    });
    renderPage();
    await screen.findByText(/reached the 1,000-secret inventory limit/);
    expect(button("Create secret")).toBeDisabled();
    expect(button("Edit metadata for CI_TOKEN_0")).toBeEnabled();
    expect(button("Rotate CI_TOKEN_0")).toBeEnabled();
    expect(screen.getByText("1000 recorded secrets")).toBeInTheDocument();
  }, 15000);
  it("counts description code points instead of UTF-16 code units", async () => {
    renderPage();
    await screen.findByText("CI_TOKEN");
    fireEvent.click(button("Edit metadata for CI_TOKEN"));
    const field = screen.getByLabelText("Description");
    expect(field).toHaveAttribute("maxlength", "8192");
    fireEvent.change(field, { target: { value: "😀".repeat(4096) } });
    expect(button("Save metadata")).toBeEnabled();
    expect(screen.getByText("4096/4096 characters")).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "😀".repeat(4097) } });
    expect(button("Save metadata")).toBeDisabled();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
