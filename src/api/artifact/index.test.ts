import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";
import { get, getBlob } from "../client";
import {
  downloadProjectArtifact,
  listProjectArtifacts,
  safeDownloadName,
  saveArtifactDownload,
} from "./index";
vi.mock("../client", () => ({ get: vi.fn(), getBlob: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("project artifact API", () => {
  it("encodes project paths and forwards server-side pagination and filters", async () => {
    vi.mocked(get).mockResolvedValue({
      list: null,
      total: 0,
      page: 2,
      pageSize: 20,
    });
    const signal = new AbortController().signal;
    expect(
      await listProjectArtifacts(
        "project/a",
        { page: 2, name: "report", runId: "run/a", status: "expired" },
        signal,
      ),
    ).toEqual({ list: [], total: 0, page: 2, pageSize: 20 });
    expect(get).toHaveBeenCalledWith("/projects/project%2Fa/artifacts", {
      params: {
        page: 2,
        pageSize: 20,
        name: "report",
        runId: "run/a",
        status: "expired",
      },
      signal,
      silence: true,
    });
  });
  it("downloads actual bytes with encoded IDs and prefers RFC 5987 filenames", async () => {
    const blob = new Blob(['{"report":true}'], { type: "application/json" });
    vi.mocked(getBlob).mockResolvedValue({
      data: blob,
      headers: {
        "content-disposition":
          "attachment; filename=report.json; filename*=UTF-8''%E6%8A%A5%E5%91%8A.json",
      },
      status: 200,
      statusText: "OK",
      config: { headers: new AxiosHeaders() },
    });
    const signal = new AbortController().signal;
    expect(
      await downloadProjectArtifact("pr/a", "art/a", "fallback", signal),
    ).toEqual({ blob, filename: "报告.json" });
    expect(getBlob).toHaveBeenCalledWith(
      "/projects/pr%2Fa/artifacts/art%2Fa/download",
      { signal, silence: true },
    );
  });
  it("rejects login pages/error envelopes instead of saving them", async () => {
    vi.mocked(getBlob).mockResolvedValue({
      data: new Blob(["login"]),
      headers: { "content-type": "text/html" },
      status: 200,
      statusText: "OK",
      config: { headers: new AxiosHeaders() },
    });
    await expect(
      downloadProjectArtifact("pr", "art", "fallback"),
    ).rejects.toThrow("did not return an artifact attachment");
  });
  it("sanitizes filenames and malformed encoded headers", async () => {
    expect(safeDownloadName("../../hidden/..\\report\n\u202e.json")).toBe(
      "report.json",
    );
    expect(safeDownloadName("...")).toBe("artifact");
    const blob = new Blob(["ok"]);
    vi.mocked(getBlob).mockResolvedValue({
      data: blob,
      headers: {
        "content-disposition":
          "attachment; filename=\"../fallback.txt\"; filename*=UTF-8''%INVALID",
      },
      status: 200,
      statusText: "OK",
      config: { headers: new AxiosHeaders() },
    });
    expect(
      (await downloadProjectArtifact("pr", "art", "fallback")).filename,
    ).toBe("fallback.txt");
  });
  it("creates an object URL for response bytes and releases it after clicking", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:artifact-test");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.href).toBe("blob:artifact-test");
        expect(this.download).toBe("report.txt");
        expect(this.isConnected).toBe(true);
      });
    const blob = new Blob(["real bytes"]);
    saveArtifactDownload({ blob, filename: "../report.txt" });
    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:artifact-test");
  });
});
