import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FirstBuildGuidance } from "./first-build-guidance";
import type { FirstBuildResource } from "@/hooks/use-first-build";

const { hasPermission } = vi.hoisted(() => ({
  hasPermission: vi.fn(() => false),
}));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ has: hasPermission }),
}));

const readiness: FirstBuildResource = {
  signedIn: true,
  loading: false,
  error: undefined,
  refresh: vi.fn(),
  data: {
    scopeOptions: [],
    scopeOptionsTruncated: false,
    canEnterScope: true,
    configuration: {
      access: "visible",
      defaultStorageConfigured: false,
      agentSigningConfigured: false,
    },
    agent: { access: "visible", enabledRecentlySeen: false },
  },
};
afterEach(() => {
  cleanup();
  hasPermission.mockReturnValue(false);
});

it("does not render private guidance for an anonymous session", () => {
  const { container } = render(
    <FirstBuildGuidance readiness={{ ...readiness, signedIn: false }} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("guides a fresh admin with no invented scopes and explicitly separates setup from successful execution", () => {
  render(<FirstBuildGuidance readiness={readiness} />);
  expect(
    screen.getByText(/No authorized organization scopes were returned/),
  ).toHaveTextContent("enter an existing administrator-approved scope ID");
  expect(
    screen.getByText(/Default artifact storage:/).closest("li"),
  ).toHaveTextContent("Not configured");
  expect(screen.getByText(/Agent signing:/).closest("li")).toHaveTextContent(
    "Not configured",
  );
  expect(screen.getByText(/Agent heartbeat:/).closest("li")).toHaveTextContent(
    "No enabled Agent was seen recently",
  );
  expect(screen.getByText(/Configured means saved/)).toHaveTextContent(
    "not connectivity tested",
  );
  expect(screen.getByText(/Configured means saved/)).toHaveTextContent(
    "restarting",
  );
  expect(
    screen.getByText(/Start with the trusted bare-metal sample/),
  ).toHaveTextContent("does not grant pipeline creation or run permission");
  expect(
    screen.getByRole("link", { name: "First-build setup API/CLI guide" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/arcentrix/arcentra/blob/main/scripts/acceptance/FIRST_BUILD.md",
  );
});

it("shows permission-restricted observations without implying unconfigured infrastructure", () => {
  render(
    <FirstBuildGuidance
      readiness={{
        ...readiness,
        data: {
          ...readiness.data!,
          canEnterScope: false,
          configuration: { access: "restricted" },
          agent: { access: "restricted" },
        },
      }}
    />,
  );
  expect(screen.getByText(/Configuration:/).closest("li")).toHaveTextContent(
    "Restricted",
  );
  expect(screen.getByText(/Agent heartbeat:/).closest("li")).toHaveTextContent(
    "Restricted",
  );
  expect(screen.queryByText(/Not configured/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Your platform permission/),
  ).not.toBeInTheDocument();
});

it("supports collapse and explicit refresh, keeping previous observations labelled stale on failure", () => {
  const { rerender } = render(<FirstBuildGuidance readiness={readiness} />);
  fireEvent.click(screen.getByRole("button", { name: "First build setup" }));
  expect(
    screen.queryByRole("list", { name: "Setup snapshot" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh first-build status" }),
  );
  expect(readiness.refresh).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "First build setup" }));
  rerender(<FirstBuildGuidance readiness={{ ...readiness, loading: true }} />);
  expect(
    screen.getByRole("list", { name: "Previous setup snapshot" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Previous snapshot shown/)).toBeInTheDocument();
  rerender(
    <FirstBuildGuidance
      readiness={{ ...readiness, error: new Error("secret diagnostic") }}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No current setup or scope information could be verified",
  );
  expect(screen.queryByText(/secret diagnostic/)).not.toBeInTheDocument();
});

it("shows refreshed configured observations with no overall ready or success claim", () => {
  render(
    <FirstBuildGuidance
      readiness={{
        ...readiness,
        data: {
          ...readiness.data!,
          configuration: {
            access: "visible",
            defaultStorageConfigured: true,
            agentSigningConfigured: true,
          },
          agent: { access: "visible", enabledRecentlySeen: true },
        },
      }}
    />,
  );
  expect(
    screen.getByText(/Default artifact storage:/).closest("li"),
  ).toHaveTextContent("Configured (persisted record)");
  expect(screen.getByText(/Agent signing:/).closest("li")).toHaveTextContent(
    "Configured (persisted values)",
  );
  expect(screen.getByText(/Agent heartbeat:/).closest("li")).toHaveTextContent(
    "does not guarantee job capacity or build success",
  );
});

it("links current visible setup to Storage only with the platform permission hint", () => {
  hasPermission.mockReturnValue(true);
  const { rerender } = render(<FirstBuildGuidance readiness={readiness} />);
  expect(
    screen.getByRole("link", { name: "Open storage settings" }),
  ).toHaveAttribute("href", "/settings?section=storage");
  rerender(<FirstBuildGuidance readiness={{ ...readiness, loading: true }} />);
  expect(
    screen.queryByRole("link", { name: "Open storage settings" }),
  ).not.toBeInTheDocument();
  rerender(
    <FirstBuildGuidance
      readiness={{
        ...readiness,
        data: { ...readiness.data!, configuration: { access: "restricted" } },
      }}
    />,
  );
  expect(
    screen.queryByRole("link", { name: "Open storage settings" }),
  ).not.toBeInTheDocument();
  hasPermission.mockReturnValue(false);
  rerender(<FirstBuildGuidance readiness={readiness} />);
  expect(
    screen.queryByRole("link", { name: "Open storage settings" }),
  ).not.toBeInTheDocument();
});
