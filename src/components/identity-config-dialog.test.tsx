import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityConfigDialog } from "./identity-config-dialog";
import type { IdentityProvider } from "@/api/identity/types";

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const provider: IdentityProvider = {
  id: 1,
  name: "ci-identity",
  providerType: "oauth",
  priority: 0,
  isEnabled: 1,
  createdAt: "",
  updatedAt: "",
  config: { clientId: "synthetic-id" },
  configuredFields: ["clientSecret"],
};

describe("write-only provider credentials", () => {
  it("shows configured credentials as blank password inputs and omits untouched values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IdentityConfigDialog
        open
        onOpenChange={() => {}}
        provider={provider}
        onSubmit={onSubmit}
      />,
    );
    const secret = screen.getByLabelText("Configuration clientSecret");
    expect(secret).toHaveValue("");
    expect(secret).toHaveAttribute("type", "password");
    expect(
      screen.getByText("Configured; leave blank to keep the existing value."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ config: { clientId: "synthetic-id" } }),
      ),
    );
  });
  it("sends an explicit credential replacement as a string", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IdentityConfigDialog
        open
        onOpenChange={() => {}}
        provider={provider}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText("Configuration clientSecret"), {
      target: { value: "123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { clientId: "synthetic-id", clientSecret: "123456789" },
        }),
      ),
    );
  });
  it("keeps nested credential configuration status-only", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IdentityConfigDialog
        open
        onOpenChange={() => {}}
        provider={{
          ...provider,
          config: { ldap: { host: "ldap.test" } },
          configuredFields: ["ldap.bindPassword"],
        }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByLabelText("Configuration ldap")).toHaveAttribute(
      "readonly",
    );
    expect(
      screen.getByText("ldap.bindPassword: Configured (write-only)"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ config: {} }),
      ),
    );
  });
});
