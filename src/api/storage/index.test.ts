import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, post, put } from "../client";
import {
  createStorageConfiguration,
  endpointIsSafe,
  listStorageConfigurations,
  setDefaultStorageConfiguration,
  updateStorageConfiguration,
} from "./index";
vi.mock("../client", () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const readRow = {
  storageId: "store-one",
  name: "Artifacts",
  description: "",
  storageType: "minio",
  isEnabled: 1,
  isDefault: 0,
  config: {
    endpoint: "minio.example:9000",
    bucket: "artifacts",
    region: "",
    basePath: "",
    useTLS: false,
    accessKey: "READ-ACCESS-CANARY",
    secretKey: "READ-SECRET-CANARY",
    futureCredential: "PRIVATE-CANARY",
  },
  configuredFields: ["accessKey", "secretKey", "futureCredential"],
};
const decode = (value: string) =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(value), (char) => char.charCodeAt(0)),
    ),
  );
beforeEach(() => vi.clearAllMocks());
describe("storage wire and privacy contract", () => {
  it("projects safe list data without retaining secrets or arbitrary configured fields", async () => {
    vi.mocked(get).mockResolvedValue([readRow]);
    const result = await listStorageConfigurations();
    expect(result[0].credentials).toEqual({ accessKey: true, secretKey: true });
    expect(result[0].target?.endpoint).toBe("minio.example:9000");
    expect(JSON.stringify(result)).not.toMatch(/CANARY|futureCredential/);
    expect(get).toHaveBeenCalledWith(
      "/storage/configs",
      expect.objectContaining({ silence: true, sensitive: true }),
    );
  });
  it("treats other providers as read-only without projecting their config", async () => {
    vi.mocked(get).mockResolvedValue([{ ...readRow, storageType: "gcs" }]);
    expect((await listStorageConfigurations())[0].target).toBeNull();
  });
  it("does not display credential-bearing endpoints even from an unsafe server response", async () => {
    vi.mocked(get).mockResolvedValue([
      {
        ...readRow,
        config: {
          ...readRow.config,
          endpoint: "https://secret:CANARY@storage.example?token=CANARY",
        },
      },
    ]);
    const result = await listStorageConfigurations();
    expect(result[0].target).toBeNull();
    expect(JSON.stringify(result)).not.toContain("CANARY");
  });
  it("rejects invalid response shapes instead of inventing a saved/default state", async () => {
    vi.mocked(get).mockResolvedValue([{ ...readRow, isDefault: true }]);
    await expect(listStorageConfigurations()).rejects.toThrow("unavailable");
  });
  it("creates a Unicode-safe base64 config without default or enabled flags", async () => {
    await createStorageConfiguration({
      storageId: "store-one",
      name: "存储",
      description: "测试",
      storageType: "minio",
      endpoint: "minio.example:9000",
      bucket: "artifacts",
      region: "",
      basePath: "目录",
      useTLS: false,
      accessKey: "access-é",
      secretKey: "synthetic-密钥",
    });
    const [url, payload, config] = vi.mocked(post).mock.calls[0];
    expect(url).toBe("/storage/configs");
    expect(config).toMatchObject({ silence: true, sensitive: true });
    expect(payload).not.toHaveProperty("isDefault");
    expect(payload).not.toHaveProperty("isEnabled");
    expect(decode((payload as { config: string }).config)).toMatchObject({
      useTLS: false,
      basePath: "目录",
      secretKey: "synthetic-密钥",
      accessKey: "access-é",
    });
  });
  it("omits blank credentials and all locked fields in a metadata-only edit", async () => {
    await updateStorageConfiguration("store/one", {
      name: "Renamed",
      description: "",
      accessKey: "",
      secretKey: "",
    });
    expect(put).toHaveBeenCalledWith(
      "/storage/configs/store%2Fone",
      { name: "Renamed", description: "" },
      { silence: true, sensitive: true },
    );
  });
  it("sends only explicitly provided replacement credentials", async () => {
    await updateStorageConfiguration("store-one", {
      secretKey: "synthetic-new-secret",
    });
    const payload = vi.mocked(put).mock.calls[0][1] as { config: string };
    expect(Object.keys(payload)).toEqual(["config"]);
    expect(decode(payload.config)).toEqual({
      secretKey: "synthetic-new-secret",
    });
  });
  it.each(["[redacted]", "configured", "********", "••••••••"])(
    "rejects the %s credential placeholder without a request",
    async (value) => {
      await expect(
        updateStorageConfiguration("store-one", { secretKey: value }),
      ).rejects.toThrow("new credential");
      expect(put).not.toHaveBeenCalled();
    },
  );
  it("chooses default with a dedicated explicit request and no credential payload", async () => {
    await setDefaultStorageConfiguration("store-one");
    expect(post).toHaveBeenCalledWith(
      "/storage/configs/store-one/default",
      undefined,
      { silence: true, sensitive: true },
    );
  });
  it.each([
    "https://user:password@storage.test",
    "storage.test?token=secret",
    "storage.test#secret",
    "storage.test?",
  ])("rejects unsafe endpoint %s", (endpoint) => {
    expect(endpointIsSafe(endpoint)).toBe(false);
  });
});
