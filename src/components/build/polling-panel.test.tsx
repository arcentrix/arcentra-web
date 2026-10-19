import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PollingPanel } from "./polling-panel";
import {
  baselinePolling,
  disablePolling,
  enablePolling,
  getPollingCandidates,
  getPollingStatus,
} from "@/api/polling";
import type { PollingCandidate, PollingStatus } from "@/api/polling/types";
import { ApiError } from "@/lib/api-error";
vi.mock("@/api/polling", () => ({
  getPollingStatus: vi.fn(),
  getPollingCandidates: vi.fn(),
  baselinePolling: vi.fn(),
  enablePolling: vi.fn(),
  disablePolling: vi.fn(),
}));
const candidate: PollingCandidate = {
  pipelineId: "p1",
  name: "Build API",
  defaultBranch: "main",
  definitionPath: ".arcentra/build.yaml",
  canEnable: true,
  eligible: true,
  blocker: "",
};
const initial: PollingStatus = {
  supported: true,
  state: "disabled",
  revision: 0,
  selectedPipelines: [],
  blocker: "",
  scope: {
    provider: "gitlab",
    stream: "merge_requests",
    repository: "https://gitlab.example/team/project",
  },
  capabilities: { canBaseline: true, canEnable: false, canDisable: false },
};
const baselined: PollingStatus = {
  ...initial,
  state: "baselined",
  revision: 1,
  baselineId: "baseline-one",
  baselineCompletedAt: "2026-10-16T10:00:00Z",
  baselineObservationCount: 4,
  capabilities: { canBaseline: true, canEnable: true, canDisable: true },
};
const enabled: PollingStatus = {
  ...baselined,
  state: "enabled",
  revision: 2,
  selectedPipelines: [{ pipelineId: "p1", name: "Build API" }],
  capabilities: { canBaseline: false, canEnable: false, canDisable: true },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function ready(status: PollingStatus = initial) {
  vi.mocked(getPollingStatus).mockResolvedValue(status);
  const view = render(<PollingPanel projectId="project-one" />);
  await screen.findByRole("list", { name: "Polling pipeline candidates" });
  return view;
}
function choose() {
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select Build API for polling" }),
  );
}
function reviewEnable() {
  choose();
  fireEvent.click(
    screen.getByRole("button", { name: "Review enable polling" }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPollingCandidates).mockResolvedValue({
    items: [candidate],
    total: 1,
    pageNum: 1,
    pageSize: 25,
  });
});
afterEach(cleanup);
it("opens disabled with source-provenance boundaries and never mutates on reads, refresh or collapse", async () => {
  await ready();
  expect(screen.getByText("Disabled", { exact: true })).toBeInTheDocument();
  expect(screen.getByLabelText("Polling source provenance")).toHaveTextContent(
    "An MR observation is not proof that MR code was tested",
  );
  expect(screen.getByLabelText("Polling source provenance")).toHaveTextContent(
    "Actual Agent checkout",
  );
  expect(screen.getByText(/Snapshot observations can miss/)).toHaveTextContent(
    "duplicate prevention across webhooks and polling is not guaranteed",
  );
  expect(screen.getByRole("checkbox")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() => expect(getPollingStatus).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "GitLab MR polling" }));
  fireEvent.click(screen.getByRole("button", { name: "GitLab MR polling" }));
  expect(baselinePolling).not.toHaveBeenCalled();
  expect(enablePolling).not.toHaveBeenCalled();
  expect(disablePolling).not.toHaveBeenCalled();
});
it("requires reviewed baseline then a separate explicitly named enable action", async () => {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Review baseline" }));
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "creates no runs and does not enable polling",
  );
  expect(baselinePolling).not.toHaveBeenCalled();
  vi.mocked(baselinePolling).mockResolvedValue(baselined);
  vi.mocked(getPollingStatus).mockResolvedValue(baselined);
  fireEvent.click(
    screen.getByRole("button", { name: "Save baseline without runs" }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  expect(baselinePolling).toHaveBeenCalledWith("project-one", {
    expectedRevision: 0,
    acknowledgeDiscard: false,
  });
  expect(enablePolling).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Review enable polling" }),
  ).toBeDisabled();
  reviewEnable();
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Build API");
  expect(dialog).toHaveTextContent("main / .arcentra/build.yaml");
  expect(dialog).toHaveTextContent(
    "interval between baseline and enable is included",
  );
  vi.mocked(enablePolling).mockResolvedValue(enabled);
  vi.mocked(getPollingStatus).mockResolvedValue(enabled);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Enable these pipelines" }),
  );
  await screen.findByText("Enabled", { exact: true });
  expect(enablePolling).toHaveBeenCalledWith("project-one", {
    expectedRevision: 1,
    baselineId: "baseline-one",
    pipelineIds: ["p1"],
  });
});
it("cancel, escape and close never authorize a mutation", async () => {
  await ready(baselined);
  reviewEnable();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Review enable polling" }),
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Review replacement baseline" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Close",
    }),
  );
  expect(enablePolling).not.toHaveBeenCalled();
  expect(baselinePolling).not.toHaveBeenCalled();
});
it("requires discard acknowledgement on a replacement baseline and never implies unresolved runs can be reset", async () => {
  await ready(baselined);
  fireEvent.click(
    screen.getByRole("button", { name: "Review replacement baseline" }),
  );
  const button = screen.getByRole("button", {
    name: "Save baseline without runs",
  });
  expect(button).toBeDisabled();
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("may skip unadmitted observed changes");
  expect(dialog).toHaveTextContent("cannot be discarded or resubmitted");
  vi.mocked(baselinePolling).mockResolvedValue({ ...baselined, revision: 2 });
  fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(button);
  await waitFor(() =>
    expect(baselinePolling).toHaveBeenCalledWith("project-one", {
      expectedRevision: 1,
      acknowledgeDiscard: true,
    }),
  );
});
it("keeps per-pipeline capability authoritative and explains missing permission/ref", async () => {
  vi.mocked(getPollingCandidates).mockResolvedValue({
    items: [
      {
        ...candidate,
        canEnable: false,
        blocker: "insufficient_current_trigger_authority",
      },
      {
        ...candidate,
        pipelineId: "p2",
        name: "Missing ref",
        canEnable: false,
        eligible: false,
        defaultBranch: "",
        blocker: "pipeline_repository_ref_or_state_not_eligible",
      },
    ],
    total: 2,
    pageNum: 1,
    pageSize: 25,
  });
  await ready(baselined);
  expect(
    screen.getByText(/No eligible, authorized pipeline/),
  ).toBeInTheDocument();
  screen.getAllByRole("checkbox").forEach((box) => expect(box).toBeDisabled());
  expect(
    screen.getByText(/Insufficient current permission/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Missing branch/)).toBeInTheDocument();
});
it("paginates beyond 100 without implicit select-all and retains only explicit named choices", async () => {
  vi.mocked(getPollingCandidates).mockImplementation(async (_id, page = 1) => ({
    items: [{ ...candidate, pipelineId: `p${page}`, name: `Build ${page}` }],
    total: 101,
    pageNum: page,
    pageSize: 25,
  }));
  await ready(baselined);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select Build 1 for polling" }),
  );
  for (let page = 2; page <= 5; page++) {
    fireEvent.click(
      screen.getByRole("button", { name: "Next candidate page" }),
    );
    await screen.findByRole("checkbox", {
      name: `Select Build ${page} for polling`,
    });
  }
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select Build 5 for polling" }),
  );
  expect(screen.getByLabelText("Draft pipeline selection")).toHaveTextContent(
    "Build 1, Build 5",
  );
  expect(getPollingCandidates).toHaveBeenLastCalledWith(
    "project-one",
    5,
    expect.any(AbortSignal),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Review enable polling" }),
  );
  vi.mocked(enablePolling).mockResolvedValue(enabled);
  fireEvent.click(
    screen.getByRole("button", { name: "Enable these pipelines" }),
  );
  await waitFor(() =>
    expect(enablePolling).toHaveBeenCalledWith("project-one", {
      expectedRevision: 1,
      baselineId: "baseline-one",
      pipelineIds: ["p1", "p5"],
    }),
  );
});
it("deduplicates repeated submits and allows in-flight close without undo or hidden enable", async () => {
  const pending = deferred<PollingStatus>();
  vi.mocked(enablePolling).mockReturnValue(pending.promise);
  await ready(baselined);
  reviewEnable();
  const button = screen.getByRole("button", { name: "Enable these pipelines" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(enablePolling).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  expect(screen.getByLabelText("Refresh polling status")).toBeDisabled();
  fireEvent.click(
    within(screen.getByRole("dialog")).getAllByRole("button", {
      name: "Close",
    })[0],
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  vi.mocked(getPollingStatus).mockResolvedValue(enabled);
  await act(async () => pending.resolve(enabled));
  await screen.findByText("Enabled", { exact: true });
  expect(enablePolling).toHaveBeenCalledOnce();
});
it.each([403, 409, 422, 503])(
  "blocks write retries after HTTP %s until explicit refresh/review",
  async (status) => {
    vi.mocked(enablePolling).mockRejectedValue(
      new ApiError({ status, message: "private provider response" }),
    );
    await ready(baselined);
    reviewEnable();
    fireEvent.click(
      screen.getByRole("button", { name: "Enable these pipelines" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.queryByText(/private provider response/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review enable polling" }),
    ).not.toBeInTheDocument();
    expect(enablePolling).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh polling status" }),
    );
    await screen.findByRole("checkbox");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(enablePolling).toHaveBeenCalledOnce();
  },
);
it("reports unresolved evidence separately from ordinary revision conflict", async () => {
  vi.mocked(disablePolling).mockRejectedValue(
    new ApiError({
      status: 409,
      message:
        "polling has unresolved execution evidence; operator reconciliation is required",
    }),
  );
  await ready(enabled);
  fireEvent.click(
    screen.getByRole("button", { name: "Review disable polling" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Disable polling" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "replacement baseline cannot discard or resubmit those runs",
  );
});
it("ignores late responses after project navigation and never carries another project's draft", async () => {
  const pending = deferred<PollingStatus>();
  vi.mocked(enablePolling).mockReturnValue(pending.promise);
  const { rerender } = await ready(baselined);
  reviewEnable();
  fireEvent.click(
    screen.getByRole("button", { name: "Enable these pipelines" }),
  );
  vi.mocked(getPollingStatus).mockResolvedValue(initial);
  rerender(<PollingPanel projectId="project-two" />);
  await screen.findByText("Disabled", { exact: true });
  await act(async () => pending.resolve(enabled));
  expect(
    screen.queryByText("Enabled", { exact: true }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getPollingStatus).toHaveBeenLastCalledWith(
    "project-two",
    expect.any(AbortSignal),
  );
});
it("ignores an older read resolving after a newer refresh", async () => {
  const old = deferred<PollingStatus>();
  vi.mocked(getPollingStatus)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue(initial);
  render(<PollingPanel projectId="project-one" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByText("Disabled", { exact: true });
  await act(async () => old.resolve(enabled));
  expect(
    screen.queryByText("Enabled", { exact: true }),
  ).not.toBeInTheDocument();
});
it("shows paused/retry/no-match semantics without success claims", async () => {
  await ready({
    ...enabled,
    state: "paused",
    blocker: "authorization_denied",
    lastPollError: "provider_incomplete",
    lastCompletedAt: "2026-10-16T10:05:00Z",
    nextRetryAt: "2026-10-16T10:06:00Z",
    lastObservationCount: 2,
    lastTargetCount: 0,
    capabilities: { canBaseline: true, canEnable: false, canDisable: true },
  });
  expect(
    screen.getByText(/Polling is paused and will not automatically resume/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Observation completed without a matching/),
  ).toHaveTextContent("this is not build success");
  expect(screen.getByText("Next retry / poll time")).toBeInTheDocument();
  expect(screen.getByText(/provider scan was incomplete/)).toBeInTheDocument();
});
it("renders unsupported/read-only states without inventing provider setup or hidden pipelines", async () => {
  vi.mocked(getPollingStatus).mockResolvedValue({
    ...initial,
    supported: false,
    scope: undefined,
    blocker: "requires_existing_enabled_gitlab_mr_project",
    capabilities: { canBaseline: false, canEnable: false, canDisable: false },
  });
  render(<PollingPanel projectId="generic-git" />);
  await screen.findByText(/Requires an existing enabled GitLab/);
  expect(getPollingCandidates).not.toHaveBeenCalled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review baseline" }),
  ).not.toBeInTheDocument();
});
it("disables only after review and explicitly preserves accepted runs", async () => {
  await ready(enabled);
  fireEvent.click(
    screen.getByRole("button", { name: "Review disable polling" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Runs already accepted are not cancelled",
  );
  expect(disablePolling).not.toHaveBeenCalled();
  vi.mocked(disablePolling).mockResolvedValue({ ...initial, revision: 3 });
  vi.mocked(getPollingStatus).mockResolvedValue({ ...initial, revision: 3 });
  fireEvent.click(screen.getByRole("button", { name: "Disable polling" }));
  await screen.findByText("Disabled", { exact: true });
  expect(disablePolling).toHaveBeenCalledWith("project-one", {
    expectedRevision: 2,
  });
});

it("keeps recovery_required prominent even when stored state is enabled and never retries runs", async () => {
  await ready({ ...enabled, lastPollError: "recovery_required" });
  expect(screen.getByText("Enabled", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByText(/Latest poll: Unresolved execution evidence/),
  ).toHaveTextContent("cannot discard or resubmit existing runs");
  expect(
    screen.queryByRole("button", { name: "Review replacement baseline" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review enable polling" }),
  ).not.toBeInTheDocument();
  expect(enablePolling).not.toHaveBeenCalled();
});
it("does not invent restricted counts or pipeline names for a read-only viewer", async () => {
  await ready({
    ...initial,
    state: "enabled",
    revision: 2,
    capabilities: { canBaseline: false, canEnable: false, canDisable: false },
  });
  expect(screen.getByText(/Read-only polling status/)).toBeInTheDocument();
  expect(screen.queryByText("Baseline observations")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Last completed observation"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Selected pipelines visible to you"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
it("clears a reviewed selection when refreshed server revision changes", async () => {
  await ready(baselined);
  choose();
  vi.mocked(getPollingStatus).mockResolvedValue({
    ...baselined,
    revision: 2,
    baselineId: "new-baseline",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Review enable polling" }),
  ).toBeDisabled();
  expect(enablePolling).not.toHaveBeenCalled();
});

it("keeps a verified stop control available if candidate enumeration fails", async () => {
  vi.mocked(getPollingStatus).mockResolvedValue(enabled);
  vi.mocked(getPollingCandidates).mockRejectedValue(
    new ApiError({ status: 503, message: "private diagnostic" }),
  );
  render(<PollingPanel projectId="project-one" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Pipeline candidates are unavailable",
  );
  expect(screen.getByText("Enabled", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Review disable polling" }),
  ).toBeEnabled();
  expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument();
});

it("preserves a same-scope, same-revision selection through explicit read-only refresh", async () => {
  await ready(baselined);
  choose();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Review enable polling" }),
  ).toBeEnabled();
  expect(enablePolling).not.toHaveBeenCalled();
});
it("preserves a draft through transient status failure while withholding actions until a good read", async () => {
  await ready(baselined);
  choose();
  vi.mocked(getPollingStatus).mockRejectedValueOnce(
    new ApiError({ status: 503, message: "temporary" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Review enable polling" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(enablePolling).not.toHaveBeenCalled();
});
it("retains cross-page drafts on transient candidate failure and revalidates every selected page on refresh", async () => {
  vi.mocked(getPollingCandidates).mockImplementation(async (_id, page = 1) => ({
    items: [{ ...candidate, pipelineId: `p${page}`, name: `Build ${page}` }],
    total: 101,
    pageNum: page,
    pageSize: 25,
  }));
  await ready(baselined);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select Build 1 for polling" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next candidate page" }));
  await screen.findByRole("checkbox", { name: "Select Build 2 for polling" });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select Build 2 for polling" }),
  );
  vi.mocked(getPollingCandidates).mockRejectedValueOnce(
    new ApiError({ status: 503, message: "temporary" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Review enable polling" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Draft pipeline selection")).toHaveTextContent(
    "Build 1, Build 2",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review enable polling" }),
    ).toBeEnabled(),
  );
  expect(getPollingCandidates).toHaveBeenLastCalledWith(
    "project-one",
    2,
    expect.any(AbortSignal),
  );
  expect(screen.getByLabelText("Draft pipeline selection")).toHaveTextContent(
    "Build 1, Build 2",
  );
});
it("drops a refreshed choice that lost its current pipeline authority, even on the same revision", async () => {
  await ready(baselined);
  choose();
  vi.mocked(getPollingCandidates).mockResolvedValue({
    items: [
      {
        ...candidate,
        canEnable: false,
        blocker: "insufficient_current_trigger_authority",
      },
    ],
    total: 1,
    pageNum: 1,
    pageSize: 25,
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByText(/Insufficient current permission/);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
it("drops draft choices after access denial or an actual repository scope change", async () => {
  await ready(baselined);
  choose();
  vi.mocked(getPollingStatus).mockRejectedValueOnce(
    new ApiError({ status: 403, message: "denied" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  choose();
  vi.mocked(getPollingStatus).mockResolvedValue({
    ...baselined,
    scope: {
      ...baselined.scope!,
      repository: "https://gitlab.example/team/other",
    },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh polling status" }),
  );
  await screen.findByText("https://gitlab.example/team/other");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});

const providerCases = [
  {
    provider: "gitlab",
    stream: "merge_requests",
    repository: "https://gitlab.example/team/repo",
    label: "GitLab",
    kind: "MR",
  },
  {
    provider: "github",
    stream: "pull_requests",
    repository: "https://github.com/team/repo",
    label: "GitHub.com",
    kind: "PR",
  },
  {
    provider: "gitea",
    stream: "pull_requests",
    repository: "https://gitea.example/team/repo",
    label: "Gitea",
    kind: "PR",
  },
] as const;
it.each(providerCases)(
  "uses reviewed $provider scope through baseline, enable and disable",
  async ({ provider, stream, repository, label, kind }) => {
    const scope = { provider, stream, repository } as PollingStatus["scope"];
    await ready({ ...initial, scope });
    expect(screen.getByText(/Disabled by default/)).toHaveTextContent(
      `supported ${kind} changes observed after that baseline`,
    );
    expect(
      screen.getByRole("button", { name: `${label} ${kind} polling` }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Polling source provenance"),
    ).toHaveTextContent(
      `An ${kind} observation is not proof that ${kind} code was tested`,
    );
    expect(
      screen.getByText(/Snapshot observations can miss/),
    ).toHaveTextContent(
      "Bounded two-snapshot comparison is not a lossless event stream",
    );
    fireEvent.click(screen.getByRole("button", { name: "Review baseline" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `configured ${label} repository`,
    );
    vi.mocked(baselinePolling).mockResolvedValue({ ...baselined, scope });
    vi.mocked(getPollingStatus).mockResolvedValue({ ...baselined, scope });
    fireEvent.click(
      screen.getByRole("button", { name: "Save baseline without runs" }),
    );
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
    expect(enablePolling).not.toHaveBeenCalled();
    reviewEnable();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `observed ${kind} head SHA, definition SHA and Agent checkout SHA may differ`,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "no historical event replay",
    );
    vi.mocked(enablePolling).mockResolvedValue({ ...enabled, scope });
    vi.mocked(getPollingStatus).mockResolvedValue({ ...enabled, scope });
    fireEvent.click(
      screen.getByRole("button", { name: "Enable these pipelines" }),
    );
    await screen.findByText("Enabled", { exact: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Review disable polling" }),
    );
    vi.mocked(disablePolling).mockResolvedValue({
      ...initial,
      scope,
      revision: 3,
    });
    vi.mocked(getPollingStatus).mockResolvedValue({
      ...initial,
      scope,
      revision: 3,
    });
    fireEvent.click(screen.getByRole("button", { name: "Disable polling" }));
    await screen.findByText("Disabled", { exact: true });
    expect(baselinePolling).toHaveBeenCalledOnce();
    expect(enablePolling).toHaveBeenCalledOnce();
    expect(disablePolling).toHaveBeenCalledOnce();
  },
);
it.each(providerCases)(
  "clears $provider status and drafts after current permission loss",
  async ({ provider, stream, repository }) => {
    await ready({
      ...baselined,
      scope: { provider, stream, repository } as PollingStatus["scope"],
    });
    choose();
    vi.mocked(getPollingStatus).mockRejectedValue(
      new ApiError({ status: 403, message: "secret" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh polling status" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Polling snapshot")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review enable polling" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  },
);
it.each(["gitee", "bitbucket", "generic"])(
  "leaves unsupported $0 projects read-only",
  async (projectId) => {
    vi.mocked(getPollingStatus).mockResolvedValue({
      ...initial,
      supported: false,
      scope: undefined,
      blocker: "requires_existing_enabled_supported_pr_project",
      capabilities: { canBaseline: false, canEnable: false, canDisable: false },
    });
    render(<PollingPanel projectId={projectId} />);
    await screen.findByText(
      /Requires an existing enabled GitLab MR, GitHub.com PR or Gitea PR project/,
    );
    expect(getPollingCandidates).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review baseline" }),
    ).not.toBeInTheDocument();
  },
);
