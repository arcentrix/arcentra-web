import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectSettingsEditor } from "./project-settings-editor";
import {
  updateProjectSettings,
  archiveProject,
  restoreProject,
} from "@/api/project/settings";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/project/settings", () => ({
  updateProjectSettings: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
}));
const settings = {
  projectId: "project-one",
  orgId: "scope-one",
  name: "sample",
  displayName: "Sample",
  description: "A service",
  defaultBranch: "main",
  tags: "",
  language: "",
  framework: "",
  visibility: 0,
  status: 1,
  isEnabled: 1,
  version: "opaque-version",
  canUpdate: true,
  canArchive: true,
  canRestore: false,
};
const callbacks = {
  onClose: vi.fn(),
  onSaved: vi.fn(),
  onReload: vi.fn(),
  onDenied: vi.fn(),
};
function deferred() {
  let resolve!: (value: typeof settings) => void;
  const promise = new Promise<typeof settings>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const show = (mode: "edit" | "archive" | "restore" = "edit") =>
  render(
    <ProjectSettingsEditor settings={settings} mode={mode} {...callbacks} />,
  );
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("submits only allowed fields/version once and prevents Cancel/Close during a pending write", async () => {
  const pending = deferred();
  vi.mocked(updateProjectSettings).mockReturnValue(pending.promise);
  show();
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Updated sample" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(updateProjectSettings).toHaveBeenCalledOnce();
  expect(updateProjectSettings).toHaveBeenCalledWith("project-one", {
    displayName: "Updated sample",
    description: "A service",
    defaultBranch: "main",
    tags: "",
    language: "",
    framework: "",
    visibility: 0,
    version: "opaque-version",
  });
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(callbacks.onClose).not.toHaveBeenCalled();
  await act(async () => pending.resolve(settings));
  expect(callbacks.onSaved).toHaveBeenCalledOnce();
});
it("preserves a conflict draft, prevents blind retry, and reloads only explicitly", async () => {
  vi.mocked(updateProjectSettings).mockRejectedValue(
    new ApiError({ status: 409, message: "RAW-CANARY" }),
  );
  show();
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Conflict draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("record changed");
  expect(screen.getByLabelText("Display name")).toHaveValue("Conflict draft");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(document.body).not.toHaveTextContent("RAW-CANARY");
  fireEvent.click(
    screen.getByRole("button", { name: "Reload latest settings" }),
  );
  expect(callbacks.onReload).toHaveBeenCalledOnce();
  expect(updateProjectSettings).toHaveBeenCalledOnce();
});
it("hands live denial to the parent to hide stale snapshots", async () => {
  vi.mocked(updateProjectSettings).mockRejectedValue(
    new ApiError({ status: 403, message: "PRIVATE-CANARY" }),
  );
  show();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(callbacks.onDenied).toHaveBeenCalledWith(
      expect.stringContaining("Access changed"),
    ),
  );
  expect(callbacks.onSaved).not.toHaveBeenCalled();
});
it("ignores a write response after navigation unmounts the editor", async () => {
  const pending = deferred();
  vi.mocked(updateProjectSettings).mockReturnValue(pending.promise);
  const view = show();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  view.unmount();
  await act(async () => pending.resolve(settings));
  expect(callbacks.onSaved).not.toHaveBeenCalled();
});
it.each(["archive", "restore"] as const)(
  "requires explicit typed confirmation for %s and sends the current version",
  async (mode) => {
    vi.mocked(archiveProject).mockResolvedValue(settings);
    vi.mocked(restoreProject).mockResolvedValue(settings);
    show(mode);
    const button = screen.getByRole("button", {
      name: mode === "archive" ? "Confirm archive" : "Confirm restore",
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type sample to confirm"), {
      target: { value: "sample" },
    });
    fireEvent.click(button);
    await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
    expect(
      mode === "archive" ? archiveProject : restoreProject,
    ).toHaveBeenCalledOnce();
    expect(
      mode === "archive" ? archiveProject : restoreProject,
    ).toHaveBeenCalledWith("project-one", "opaque-version");
  },
);
it("Cancel leaves without any mutation", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(callbacks.onClose).toHaveBeenCalledOnce();
  expect(updateProjectSettings).not.toHaveBeenCalled();
});

it("gives the visibility select an exact standalone label with real options", () => {
  show();
  const select = screen.getByLabelText("Visibility metadata", {
    exact: true,
  }) as HTMLSelectElement;
  expect(select).toHaveAccessibleName("Visibility metadata");
  expect(select.labels).toHaveLength(1);
  expect(select.labels![0].textContent).toBe("Visibility metadata");
  expect(select.labels![0].htmlFor).toBe(select.id);
  expect(select.labels![0].contains(select)).toBe(false);
  expect(Array.from(select.options, (option) => option.textContent)).toEqual([
    "Private",
    "Internal",
    "Public",
  ]);
  fireEvent.change(select, { target: { value: "1" } });
  expect(select).toHaveValue("1");
});
