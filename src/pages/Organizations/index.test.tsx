import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getOrganizations,
  getOrganization,
  type Organization,
} from "@/api/organization";
import { ApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import Organizations from ".";
import OrganizationDetail from "./Detail";
vi.mock("@/api/organization", () => ({
  getOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
}));
const org: Organization = {
  orgId: "org-one",
  name: "sample",
  displayName: "Sample organization",
  description: "Synthetic organization",
  website: "",
  email: "",
  ownerUserId: "owner-one",
  status: 1,
  isEnabled: 1,
  version: 3,
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  isMember: false,
  canUpdate: false,
  canManageMembers: false,
  canArchive: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  authStore.updateState((state) => {
    state.initialized = true;
    state.accessToken = "synthetic-one";
  });
  userStore.updateState((state) => {
    state.userinfo = null;
  });
  vi.mocked(getOrganizations).mockResolvedValue({
    list: [org],
    total: 1,
    page: 1,
    pageSize: 20,
    canCreate: false,
  });
  vi.mocked(getOrganization).mockResolvedValue(org);
});
afterEach(cleanup);
function show(initial = "/organizations") {
  let navigate!: ReturnType<typeof useNavigate>;
  function App() {
    navigate = useNavigate();
    return (
      <Routes>
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/:orgId" element={<OrganizationDetail />} />
      </Routes>
    );
  }
  render(
    <MemoryRouter initialEntries={[initial]}>
      <App />
    </MemoryRouter>,
  );
  return { navigate: (path: string) => act(() => navigate(path)) };
}
it("does not infer membership from an accessible record or expose ungranted changes", async () => {
  show();
  await screen.findByText("Sample organization");
  expect(
    screen.getByText("Accessible through permissions"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create organization" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: /Sample organization/ }));
  await screen.findByRole("heading", { name: "Sample organization" });
  expect(
    screen.queryByRole("button", { name: "Edit organization" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Archive organization" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/Member management requires org:manage_member/),
  ).toBeInTheDocument();
});
it("hides directory rows on a failed refresh and never replaces errors with an empty directory", async () => {
  show();
  await screen.findByText("Sample organization");
  vi.mocked(getOrganizations).mockRejectedValue(
    new ApiError({ status: 403, message: "PRIVATE-CANARY" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh organizations" }),
  );
  await screen.findByText("Organizations access restricted");
  expect(screen.queryByText("Sample organization")).not.toBeInTheDocument();
  expect(screen.queryByText("0 organizations")).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("PRIVATE-CANARY");
});
it("aborts reads and drops details on same-route account changes and signout", async () => {
  const pending = new Promise<Organization>(() => {});
  show("/organizations/org-one");
  await screen.findByRole("heading", { name: "Sample organization" });
  const signal = vi.mocked(getOrganization).mock.calls[0][1]!;
  vi.mocked(getOrganization).mockReturnValue(pending);
  await act(async () =>
    authStore.updateState((state) => {
      state.accessToken = "synthetic-two";
    }),
  );
  expect(signal.aborted).toBe(true);
  expect(screen.queryByText("Sample organization")).not.toBeInTheDocument();
  await waitFor(() => expect(getOrganization).toHaveBeenCalledTimes(2));
  await act(async () =>
    authStore.updateState((state) => {
      state.initialized = false;
    }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Sign in");
});
it("does not allow a late response to repopulate another organization route", async () => {
  let resolve!: (org: Organization) => void;
  vi.mocked(getOrganization)
    .mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes;
      }),
    )
    .mockResolvedValueOnce({
      ...org,
      orgId: "org-two",
      displayName: "Second organization",
    });
  const view = show("/organizations/org-one");
  view.navigate("/organizations/org-two");
  await screen.findByRole("heading", { name: "Second organization" });
  await act(async () => resolve(org));
  expect(screen.queryByText("Sample organization")).not.toBeInTheDocument();
});
