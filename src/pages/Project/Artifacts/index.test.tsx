import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Apis } from "@/api";
import {
  downloadProjectArtifact,
  listProjectArtifacts,
  saveArtifactDownload,
  type ArtifactPage,
  type ProjectArtifact,
} from "@/api/artifact";
import Artifacts from "./index";
import { ApiError } from "@/lib/api-error";

vi.mock("@/api", () => ({ Apis: { me: { getEffectiveActions: vi.fn() } } }));
vi.mock("@/api/artifact", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/artifact")>()),
  listProjectArtifacts: vi.fn(),
  downloadProjectArtifact: vi.fn(),
  saveArtifactDownload: vi.fn(),
}));

const artifact: ProjectArtifact = {
  artifactId: "artifact-1",
  projectId: "project-1",
  pipelineId: "pipeline-1",
  pipelineRunId: "run-1",
  jobRunId: "job-1",
  stepRunId: "step-1",
  name: "actual-report.json",
  size: 2048,
  mediaType: "application/json",
  storageType: "local",
  createdAt: "2026-10-12T00:00:00Z",
  status: "available",
  downloadAvailable: true,
};
const page = (
  list = [artifact],
  total = list.length,
  number = 1,
): ArtifactPage => ({ list, total, page: number, pageSize: 20 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function renderPage(initial = "/projects/project-1/artifacts") {
  let navigate!: ReturnType<typeof useNavigate>;
  let location!: ReturnType<typeof useLocation>;
  function TestRoutes() {
    navigate = useNavigate();
    location = useLocation();
    return (
      <Routes>
        <Route path="/projects/:projectId/artifacts" element={<Artifacts />} />
        <Route path="*" element={<p>Another page</p>} />
      </Routes>
    );
  }
  const rendered = render(
    <MemoryRouter initialEntries={[initial]}>
      <TestRoutes />
    </MemoryRouter>,
  );
  return {
    ...rendered,
    router: {
      get state() {
        return { location };
      },
      navigate: (to: string | number) =>
        typeof to === "number" ? navigate(to) : navigate(to),
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue(["pipeline:read"]);
  vi.mocked(listProjectArtifacts).mockResolvedValue(page());
  vi.mocked(downloadProjectArtifact).mockResolvedValue({
    blob: new Blob(["actual bytes"]),
    filename: artifact.name,
  });
});
afterEach(cleanup);

describe("project artifact workspace", () => {
  it("loads project-scoped real metadata and links the source run", async () => {
    const pending = deferred<ArtifactPage>();
    vi.mocked(listProjectArtifacts).mockReturnValue(pending.promise);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading artifacts");
    await screen.findByText("Loading artifacts…");
    await act(async () => pending.resolve(page()));
    expect(
      screen.getByRole("table", { name: "Project artifacts" }),
    ).toHaveTextContent("2.0 KB");
    expect(screen.getByRole("link", { name: "run-1" })).toHaveAttribute(
      "href",
      "/projects/project-1/pipelines/pipeline-1?run=run-1",
    );
    expect(listProjectArtifacts).toHaveBeenCalledWith(
      "project-1",
      {
        page: 1,
        pageSize: 20,
        name: undefined,
        runId: undefined,
        status: undefined,
      },
      expect.any(AbortSignal),
    );
    expect(screen.queryByText("a4f9c2")).not.toBeInTheDocument();
  });

  it("allows a pipeline-only grant even when project effective actions lack pipeline:read", async () => {
    vi.mocked(Apis.me.getEffectiveActions).mockResolvedValue(["project:read"]);
    // The authenticated list endpoint returns only this granted pipeline's row.
    vi.mocked(listProjectArtifacts).mockResolvedValue(page([artifact]));
    renderPage();
    const button = await screen.findByRole("button", {
      name: `Download ${artifact.name}`,
    });
    expect(button).not.toBeDisabled();
    expect(Apis.me.getEffectiveActions).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(saveArtifactDownload).toHaveBeenCalledOnce());
    expect(downloadProjectArtifact).toHaveBeenCalledWith(
      "project-1",
      artifact.artifactId,
      artifact.name,
      expect.any(AbortSignal),
    );
  });

  it("honors endpoint authorization errors and can retry access", async () => {
    vi.mocked(listProjectArtifacts).mockRejectedValueOnce(
      new ApiError({ status: 403, message: "Artifact access denied" }),
    );
    renderPage();
    await screen.findByText("Artifact access restricted");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(downloadProjectArtifact).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    await screen.findByText(artifact.name);
  });

  it("refreshes once while pending and hides stale rows on errors", async () => {
    const refresh = deferred<ArtifactPage>();
    vi.mocked(listProjectArtifacts)
      .mockResolvedValueOnce(page())
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(page([{ ...artifact, name: "recovered.zip" }]));
    renderPage();
    await screen.findByText(artifact.name);
    const button = screen.getByRole("button", { name: "Refresh artifacts" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Download ${artifact.name}` }),
    ).toBeDisabled();
    expect(listProjectArtifacts).toHaveBeenCalledTimes(2);
    await act(async () =>
      refresh.reject(new Error("Missing pipeline:read permission")),
    );
    await screen.findByText("Missing pipeline:read permission");
    expect(screen.queryByText(artifact.name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("recovered.zip");
  });

  it("keeps filters and pagination in history and resets pages when filters change", async () => {
    vi.mocked(listProjectArtifacts).mockImplementation(
      async (_projectId, query) => page([artifact], 41, query?.page),
    );
    const { router } = renderPage();
    await screen.findByText(artifact.name);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    expect(router.state.location.search).toBe("?page=2");
    fireEvent.change(screen.getByRole("textbox", { name: "Artifact name" }), {
      target: { value: "report" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Run ID" }), {
      target: { value: "run-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(listProjectArtifacts).toHaveBeenLastCalledWith(
        "project-1",
        expect.objectContaining({ page: 1, name: "report", runId: "run-2" }),
        expect.any(AbortSignal),
      ),
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Artifact status" }),
      { target: { value: "expired" } },
    );
    await waitFor(() =>
      expect(listProjectArtifacts).toHaveBeenLastCalledWith(
        "project-1",
        expect.objectContaining({ page: 1, status: "expired" }),
        expect.any(AbortSignal),
      ),
    );
    await act(async () => {
      await router.navigate(-1);
    });
    expect(
      screen.getByRole("combobox", { name: "Artifact status" }),
    ).toHaveValue("all");
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByRole("textbox", { name: "Artifact name" })).toHaveValue(
      "",
    );
    await screen.findByText("Page 2 of 3");
    await act(async () => {
      await router.navigate(1);
    });
    expect(screen.getByRole("textbox", { name: "Run ID" })).toHaveValue(
      "run-2",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("aborts obsolete project reads and ignores a late response", async () => {
    const old = deferred<ArtifactPage>();
    vi.mocked(listProjectArtifacts)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page([{ ...artifact, name: "new-project.txt" }]));
    const { router } = renderPage();
    await screen.findByText("Loading artifacts…");
    const signal = vi.mocked(listProjectArtifacts).mock.calls[0][2]!;
    await act(async () => {
      await router.navigate("/projects/project-2/artifacts");
    });
    await screen.findByText("new-project.txt");
    expect(signal.aborted).toBe(true);
    await act(async () => old.resolve(page()));
    expect(screen.queryByText(artifact.name)).not.toBeInTheDocument();
    expect(screen.getByText("new-project.txt")).toBeInTheDocument();
  });

  it("distinguishes empty lists, unavailable outputs and unknown sizes", async () => {
    vi.mocked(listProjectArtifacts)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(
        page([
          {
            ...artifact,
            artifactId: "expired",
            name: "old.zip",
            status: "expired",
            downloadAvailable: false,
            unavailableReason: "Retention period ended",
          },
          {
            ...artifact,
            artifactId: "missing",
            name: "missing.zip",
            status: "unavailable",
            downloadAvailable: false,
            sizeKnown: false,
            createdAt: "invalid",
            unavailableReason: "Storage unavailable",
          },
        ]),
      );
    renderPage();
    await screen.findByText(
      "No artifacts yet. Artifacts uploaded by pipeline runs will appear here.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh artifacts" }));
    await screen.findByText("Retention period ended");
    expect(
      screen.getByRole("button", { name: "Download old.zip" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download missing.zip" }),
    ).toBeDisabled();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it("recovers an empty page after artifacts are removed", async () => {
    vi.mocked(listProjectArtifacts)
      .mockResolvedValueOnce(page([], 1, 2))
      .mockResolvedValueOnce(page());
    const { router } = renderPage("/projects/project-1/artifacts?page=2");
    await screen.findByText("No artifacts on this page.");
    fireEvent.click(screen.getByRole("button", { name: "Back to first page" }));
    await screen.findByText(artifact.name);
    expect(router.state.location.search).toBe("");
  });

  it("deduplicates download clicks and saves actual response bytes once", async () => {
    const pending = deferred<{ blob: Blob; filename: string }>();
    vi.mocked(downloadProjectArtifact).mockReturnValue(pending.promise);
    renderPage();
    const button = await screen.findByRole("button", {
      name: `Download ${artifact.name}`,
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(within(button).getByText("Downloading…")).toBeInTheDocument();
    expect(downloadProjectArtifact).toHaveBeenCalledTimes(1);
    const result = {
      blob: new Blob(["verified bytes"]),
      filename: "report.json",
    };
    await act(async () => pending.resolve(result));
    expect(saveArtifactDownload).toHaveBeenCalledOnce();
    expect(saveArtifactDownload).toHaveBeenCalledWith(result);
    expect(button).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Download started for report.json.",
    );
  });

  it("shows download failure and permits retry", async () => {
    vi.mocked(downloadProjectArtifact).mockRejectedValueOnce(
      new Error("Artifact expired"),
    );
    renderPage();
    const button = await screen.findByRole("button", {
      name: `Download ${artifact.name}`,
    });
    fireEvent.click(button);
    await screen.findByText("Download failed: Artifact expired");
    expect(saveArtifactDownload).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(saveArtifactDownload).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["project", "filter", "page", "leave"])(
    "cancels downloads on %s navigation without saving a late response",
    async (destination) => {
      const pending = deferred<{ blob: Blob; filename: string }>();
      vi.mocked(downloadProjectArtifact).mockReturnValue(pending.promise);
      const { router } = renderPage();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Download ${artifact.name}`,
        }),
      );
      const signal = vi.mocked(downloadProjectArtifact).mock.calls[0][3]!;
      await act(async () => {
        await router.navigate(
          destination === "project"
            ? "/projects/project-2/artifacts"
            : destination === "filter"
              ? "/projects/project-1/artifacts?status=expired"
              : destination === "page"
                ? "/projects/project-1/artifacts?page=2"
                : "/build",
        );
      });
      expect(signal.aborted).toBe(true);
      await act(async () =>
        pending.resolve({
          blob: new Blob(["obsolete"]),
          filename: "obsolete.json",
        }),
      );
      expect(saveArtifactDownload).not.toHaveBeenCalled();
      expect(screen.queryByText(/Download started/)).not.toBeInTheDocument();
    },
  );
});
