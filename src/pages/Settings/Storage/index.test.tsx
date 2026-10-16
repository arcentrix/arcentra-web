import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StoragePage from ".";
import me from "@/api/me";
import * as storage from "@/api/storage";
import { ApiError } from "@/lib/api-error";
const { auth } = vi.hoisted(() => ({
  auth: { initialized: true, accessToken: "test-session" },
}));
vi.mock("@/store/auth", () => ({ default: { useState: () => auth } }));
vi.mock("@/api/me", () => ({ default: { getEffectiveActions: vi.fn() } }));
vi.mock("@/api/storage", async () => ({
  ...(await vi.importActual("@/api/storage")),
  listStorageConfigurations: vi.fn(),
  createStorageConfiguration: vi.fn(),
  updateStorageConfiguration: vi.fn(),
  setDefaultStorageConfiguration: vi.fn(),
}));
const row: storage.StorageConfiguration = {
  storageId: "one",
  name: "Build artifacts",
  description: "Original description",
  storageType: "minio",
  isEnabled: true,
  isDefault: false,
  target: {
    endpoint: "minio.example:9000",
    bucket: "artifacts",
    region: "",
    basePath: "builds",
    useTLS: false,
  },
  credentials: { accessKey: true, secretKey: true },
};
const setValue = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
const start = async () => {
  render(<StoragePage headless />);
  await screen.findByText(row.name);
};
const edit = async () => {
  await start();
  fireEvent.click(
    screen.getByRole("button", { name: `Edit storage ${row.name}` }),
  );
};
const fillCreate = () => {
  setValue("Storage ID", "two");
  setValue("Name", "Second storage");
  setValue("Endpoint", "minio.example:9000");
  setValue("Bucket", "artifacts");
  setValue("Access key", "SYNTHETIC-ACCESS-CANARY");
  setValue("Secret key", "SYNTHETIC-SECRET-CANARY");
};
beforeEach(() => {
  vi.clearAllMocks();
  auth.initialized = true;
  auth.accessToken = "test-session";
  vi.mocked(me.getEffectiveActions).mockResolvedValue([
    "org:update",
    "secret:write",
  ]);
  vi.mocked(storage.listStorageConfigurations).mockResolvedValue([row]);
  vi.mocked(storage.createStorageConfiguration).mockResolvedValue(undefined);
  vi.mocked(storage.updateStorageConfiguration).mockResolvedValue(undefined);
  vi.mocked(storage.setDefaultStorageConfiguration).mockResolvedValue(
    undefined,
  );
});
afterEach(cleanup);
describe("Storage settings", () => {
  it("does not request private storage data before sign in", () => {
    auth.initialized = false;
    render(<StoragePage />);
    expect(me.getEffectiveActions).not.toHaveBeenCalled();
    expect(storage.listStorageConfigurations).not.toHaveBeenCalled();
  });
  it("denies missing platform access without reading storage", async () => {
    vi.mocked(me.getEffectiveActions).mockResolvedValue(["secret:write"]);
    render(<StoragePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("org:update");
    expect(storage.listStorageConfigurations).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "New storage" }),
    ).not.toBeInTheDocument();
    expect(me.getEffectiveActions).toHaveBeenCalledWith(
      { scopeType: "platform" },
      expect.any(AbortSignal),
    );
  });
  it("permits read-only configuration viewing without mutation controls", async () => {
    vi.mocked(me.getEffectiveActions).mockResolvedValue(["org:update"]);
    await start();
    expect(screen.getByText(/Read-only access/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New storage" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit storage/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Connectivity not tested/)).toBeInTheDocument();
  });
  it("keeps unsupported providers visible and read-only", async () => {
    vi.mocked(storage.listStorageConfigurations).mockResolvedValue([
      { ...row, storageType: "gcs", target: null },
    ]);
    await start();
    expect(
      screen.getByText(/This editor supports only MinIO and S3/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit storage/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /as default/ }),
    ).not.toBeInTheDocument();
  });
  it("creates only on explicit submit, closes secret fields, and requires separate default selection", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "New storage" }));
    fillCreate();
    expect(storage.createStorageConfiguration).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("Secret key", { exact: true }),
    ).toHaveAttribute("type", "password");
    expect(screen.getByRole("dialog")).toHaveClass("overflow-y-auto");
    fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
    await screen.findByText(
      "Storage configuration saved. Runtime reload is still required.",
    );
    expect(storage.createStorageConfiguration).toHaveBeenCalledOnce();
    expect(storage.createStorageConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        storageId: "two",
        accessKey: "SYNTHETIC-ACCESS-CANARY",
        secretKey: "SYNTHETIC-SECRET-CANARY",
      }),
    );
    expect(storage.setDefaultStorageConfiguration).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("SYNTHETIC-");
  });
  it.each([64, 65])(
    "enforces the %i-character storage identity boundary before creation",
    async (length) => {
      await start();
      fireEvent.click(screen.getByRole("button", { name: "New storage" }));
      fillCreate();
      const id = "a".repeat(length);
      setValue("Storage ID", id);
      expect(screen.getByLabelText("Storage ID")).toHaveAttribute(
        "maxlength",
        "64",
      );
      fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
      if (length === 64) {
        await waitFor(() =>
          expect(storage.createStorageConfiguration).toHaveBeenCalledWith(
            expect.objectContaining({ storageId: id }),
          ),
        );
      } else {
        expect(screen.getByRole("alert")).toHaveTextContent("1–64");
        expect(storage.createStorageConfiguration).not.toHaveBeenCalled();
      }
    },
  );
  it("locks artifact destination fields and preserves untouched credentials in metadata edits", async () => {
    await edit();
    for (const label of [
      "Storage ID",
      "Endpoint",
      "Bucket",
      "Region",
      "Base path",
    ])
      expect(screen.getByLabelText(label)).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Provider")).toBeDisabled();
    expect(screen.getByLabelText("Use TLS")).toBeDisabled();
    expect(screen.getByLabelText("Access key", { exact: true })).toHaveValue(
      "",
    );
    expect(screen.getByLabelText("Secret key", { exact: true })).toHaveValue(
      "",
    );
    setValue("Name", "Renamed storage");
    setValue("Description", "");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(storage.updateStorageConfiguration).toHaveBeenCalledWith("one", {
        name: "Renamed storage",
        description: "",
      }),
    );
  });
  it("only replaces explicitly selected nonblank credentials", async () => {
    await edit();
    expect(screen.getByLabelText("Secret key", { exact: true })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Replace secret key"));
    setValue("Secret key", "NEW-SECRET-CANARY");
    fireEvent.click(screen.getByLabelText("Replace access key"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(storage.updateStorageConfiguration).toHaveBeenCalledWith("one", {
        secretKey: "NEW-SECRET-CANARY",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(document.body.innerHTML).not.toContain("NEW-SECRET-CANARY");
  });
  it("clears discarded secrets on cancel and reopening", async () => {
    await edit();
    fireEvent.click(screen.getByLabelText("Replace secret key"));
    setValue("Secret key", "DISCARDED-SECRET-CANARY");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: `Edit storage ${row.name}` }),
    );
    expect(screen.getByLabelText("Secret key", { exact: true })).toHaveValue(
      "",
    );
    expect(screen.getByLabelText("Replace secret key")).not.toBeChecked();
    expect(storage.updateStorageConfiguration).not.toHaveBeenCalled();
  });
  it("validates empty names, masks, and provider-specific endpoints before requests", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "New storage" }));
    fillCreate();
    setValue("Name", " ");
    fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
    setValue("Name", "Valid");
    setValue("Secret key", "[redacted]");
    fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Placeholder");
    setValue("Secret key", "new-synthetic-secret");
    setValue("Endpoint", "https://minio.example");
    fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
    expect(screen.getByRole("alert")).toHaveTextContent("without a scheme");
    setValue("Provider", "s3");
    setValue("Endpoint", "s3.example");
    fireEvent.click(screen.getByRole("button", { name: "Create storage" }));
    expect(screen.getByRole("alert")).toHaveTextContent("include an http");
    expect(storage.createStorageConfiguration).not.toHaveBeenCalled();
  });
  it("requires an explicit default confirmation and preserves the choice on cancel", async () => {
    await start();
    fireEvent.click(
      screen.getByRole("button", { name: `Set ${row.name} as default` }),
    );
    expect(storage.setDefaultStorageConfiguration).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "historical artifacts",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(storage.setDefaultStorageConfiguration).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: `Set ${row.name} as default` }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm default" }));
    await screen.findByText(
      "Default storage saved. Runtime reload is still required.",
    );
    expect(storage.setDefaultStorageConfiguration).toHaveBeenCalledOnce();
    expect(storage.setDefaultStorageConfiguration).toHaveBeenCalledWith("one");
  });
  it("clears stale edits and list after a live mutation denial without a success or automatic retry", async () => {
    vi.mocked(storage.updateStorageConfiguration).mockRejectedValue(
      new ApiError({ status: 403, message: "SERVER-SECRET-CANARY" }),
    );
    await edit();
    fireEvent.click(screen.getByLabelText("Replace secret key"));
    setValue("Secret key", "DRAFT-SECRET-CANARY");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage access restricted",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(row.name)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration saved/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("CANARY");
    expect(storage.updateStorageConfiguration).toHaveBeenCalledOnce();
    expect(storage.listStorageConfigurations).toHaveBeenCalledOnce();
  });
  it("hides stale rows on a refresh denial", async () => {
    await start();
    vi.mocked(storage.listStorageConfigurations).mockRejectedValue(
      new ApiError({ status: 403, message: "Denied" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh storage configurations" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage access restricted",
    );
    expect(screen.queryByText(row.name)).not.toBeInTheDocument();
  });
  it("shows a safe uncertain-outcome message and drops secrets on unknown write errors", async () => {
    vi.mocked(storage.updateStorageConfiguration).mockRejectedValue(
      new Error("SERVER-SECRET-CANARY"),
    );
    await edit();
    setValue("Name", "Renamed");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "request may have reached the server",
    );
    expect(document.body.innerHTML).not.toContain("CANARY");
  });
  it("prevents repeated submits and ignores late success after session replacement", async () => {
    let resolve!: () => void;
    vi.mocked(storage.updateStorageConfiguration).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { rerender } = render(<StoragePage headless />);
    await screen.findByText(row.name);
    fireEvent.click(
      screen.getByRole("button", { name: `Edit storage ${row.name}` }),
    );
    setValue("Name", "Renamed");
    const submit = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(storage.updateStorageConfiguration).toHaveBeenCalledOnce();
    auth.accessToken = "replacement-session";
    rerender(<StoragePage headless />);
    await act(async () => resolve());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration saved/)).not.toBeInTheDocument();
  });
  it("keeps storage destination text wrapping within responsive cards", async () => {
    await start();
    const card = screen.getByTestId("storage-one");
    expect(card).toHaveClass("min-w-0");
    expect(within(card).getByText("minio.example:9000")).toHaveClass(
      "break-all",
    );
  });
});
