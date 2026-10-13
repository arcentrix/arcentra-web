import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupEditSheet } from "./GroupEditSheet";
import { GeneralSettingsSheet } from "@/components/general-settings-sheet";
import type { SettingItem } from "@/api/general-settings/types";
import type { SettingsGroup } from "./groups";

afterEach(cleanup);
const secret: SettingItem = {
  name: "AGENT_SECRET_KEY",
  value: {},
  configuredFields: ["secret_key", "salt"],
};
const group: SettingsGroup = {
  id: "agents",
  title: "Agents",
  description: "Write-only settings",
  fields: [
    { settingName: secret.name, path: "secret_key", label: "Agent secret key" },
    { settingName: secret.name, path: "salt", label: "Agent salt" },
  ],
};

describe("write-only configured settings", () => {
  it("keeps grouped fields blank and omits untouched stored secrets", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupEditSheet
        open
        onOpenChange={() => {}}
        group={group}
        settingsByName={new Map([[secret.name, secret]])}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByLabelText(/Agent secret key/)).toHaveValue("");
    expect(
      screen.getAllByText(
        "Configured; leave blank to keep the existing value.",
      ),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([{ name: secret.name, value: {} }]),
    );
  });

  it("preserves both explicitly replaced grouped secrets", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupEditSheet
        open
        onOpenChange={() => {}}
        group={group}
        settingsByName={new Map([[secret.name, secret]])}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Agent secret key/), {
      target: { value: "new-test-key" },
    });
    fireEvent.change(screen.getByLabelText(/Agent salt/), {
      target: { value: "new-test-salt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([
        {
          name: secret.name,
          value: { secret_key: "new-test-key", salt: "new-test-salt" },
        },
      ]),
    );
  });

  it("shows omitted advanced secret fields without inserting a mask into updates", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <GeneralSettingsSheet
        open
        onOpenChange={() => {}}
        setting={{ ...secret, value: { enabled: true } }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByLabelText(/secret_key/)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/salt/), {
      target: { value: "replacement-test-salt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        enabled: true,
        salt: "replacement-test-salt",
      }),
    );
  });
  it("treats nested configured paths as status-only and never submits dotted keys", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <GeneralSettingsSheet
        open
        onOpenChange={() => {}}
        setting={{
          name: "EMAIL",
          value: { enabled: true, smtp: { host: "smtp.test" } },
          configuredFields: ["smtp.password"],
        }}
        onSubmit={onSubmit}
      />,
    );
    expect(
      screen.getByText("smtp.password: Configured (write-only)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^smtp/)).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ enabled: true }),
    );
  });
});
