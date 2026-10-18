import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrgSettingsDialog } from "./org-settings-dialog";
import {
  createOrganization,
  updateOrganization,
  type Organization,
} from "@/api/organization";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/organization", () => ({
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));
const organization: Organization = {
  orgId: "org-one",
  name: "sample",
  displayName: "Sample",
  description: "Synthetic organization",
  website: "",
  email: "",
  ownerUserId: "owner-one",
  status: 1,
  isEnabled: 1,
  version: 3,
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  isMember: true,
  canUpdate: true,
  canManageMembers: true,
  canArchive: true,
};
const callbacks = {
  onClose: vi.fn(),
  onSaved: vi.fn(),
  onReload: vi.fn(),
  onDenied: vi.fn(),
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("creates a new real organization without supplying legacy scope IDs or grants", async () => {
  vi.mocked(createOrganization).mockResolvedValue(organization);
  render(<OrgSettingsDialog {...callbacks} />);
  fireEvent.change(screen.getByLabelText("Organization name"), {
    target: { value: "sample" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
  await waitFor(() =>
    expect(callbacks.onSaved).toHaveBeenCalledWith(organization),
  );
  expect(createOrganization).toHaveBeenCalledOnce();
  expect(createOrganization).toHaveBeenCalledWith({
    name: "sample",
    displayName: "",
    description: "",
    website: "",
    email: "",
  });
});
it("keeps immutable name read-only and excludes it from versioned updates", async () => {
  vi.mocked(updateOrganization).mockResolvedValue(organization);
  render(<OrgSettingsDialog organization={organization} {...callbacks} />);
  expect(screen.getByLabelText("Organization name")).toHaveAttribute(
    "readonly",
  );
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Renamed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save organization" }));
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalled());
  expect(updateOrganization).toHaveBeenCalledWith("org-one", {
    displayName: "Renamed",
    description: "Synthetic organization",
    website: "",
    email: "",
    version: 3,
  });
});
it("does not submit twice or close while pending and ignores a completion after unmount", async () => {
  let resolve!: (value: Organization) => void;
  vi.mocked(updateOrganization).mockReturnValue(
    new Promise((yes) => {
      resolve = yes;
    }),
  );
  const view = render(
    <OrgSettingsDialog organization={organization} {...callbacks} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save organization" }));
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(updateOrganization).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(callbacks.onClose).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => resolve(organization));
  expect(callbacks.onSaved).not.toHaveBeenCalled();
});
it("preserves conflicts without blind resubmission and reports live denial separately", async () => {
  vi.mocked(updateOrganization).mockRejectedValueOnce(
    new ApiError({ status: 409, message: "RAW-CANARY" }),
  );
  const view = render(
    <OrgSettingsDialog organization={organization} {...callbacks} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save organization" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("record changed");
  expect(screen.getByLabelText("Display name")).toHaveValue("Sample");
  expect(
    screen.getByRole("button", { name: "Save organization" }),
  ).toBeDisabled();
  view.unmount();
  vi.mocked(updateOrganization).mockRejectedValueOnce(
    new ApiError({ status: 403, message: "RAW-CANARY" }),
  );
  render(<OrgSettingsDialog organization={organization} {...callbacks} />);
  fireEvent.click(screen.getByRole("button", { name: "Save organization" }));
  await waitFor(() =>
    expect(callbacks.onDenied).toHaveBeenCalledWith(
      expect.stringContaining("Access changed"),
    ),
  );
  expect(document.body).not.toHaveTextContent("RAW-CANARY");
});
