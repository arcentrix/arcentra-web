import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import {
  baselinePolling,
  disablePolling,
  enablePolling,
  getPollingCandidates,
  getPollingStatus,
} from "@/api/polling";
import type {
  PollingCandidate,
  PollingCandidates,
  PollingStatus,
} from "@/api/polling/types";
import { ApiError } from "@/lib/api-error";
import { Panel } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Action = "baseline" | "enable" | "disable";
type DraftCandidate = PollingCandidate & { pageHint: number };
type Review = {
  action: Action;
  status: PollingStatus;
  pipelines: PollingCandidate[];
};
const stateNames = {
  disabled: "Disabled",
  baselined: "Baseline ready",
  enabled: "Enabled",
  paused: "Paused",
};
function time(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not available";
}
function reason(value: string): string {
  const labels: Record<string, string> = {
    requires_existing_enabled_supported_pr_project:
      "Requires an existing enabled GitLab MR, GitHub.com PR or Gitea PR project. Check its existing server-side provider, repository, credentials and trigger settings. Gitee and Bitbucket polling are not supported.",
    requires_existing_enabled_gitlab_mr_project:
      "Requires an existing enabled GitLab project configured for merge-request polling. Check its existing server-side provider, repository, credentials and MR trigger settings.",
    pipeline_repository_ref_or_state_not_eligible:
      "Not eligible: check the pipeline's enabled state, matching project repository, definition branch and path.",
    insufficient_current_trigger_authority:
      "Insufficient current permission. Enabling requires project read/update and this pipeline's read/trigger permissions.",
    configuration_changed:
      "Project or selected pipeline configuration changed. Review the configuration and establish a new baseline before enabling again.",
    authorization_denied:
      "The enabling user's current permissions no longer authorize polling. Restoring access does not automatically resume it.",
    definition_unavailable:
      "The saved pipeline definition revision could not be verified. Check the configured branch, path and definition; do not substitute an unreviewed revision.",
    provider_unavailable:
      "The provider could not be read safely. Check the existing server-side integration before establishing a new baseline.",
    provider_incomplete:
      "The provider scan was incomplete or exceeded a supported bound. Progress has not been confirmed.",
    recovery_required:
      "Unresolved execution evidence requires operator reconciliation. A new baseline cannot discard or resubmit existing runs.",
    unavailable:
      "The latest polling operation could not be completed. Refresh for current status; no successful progress is confirmed.",
  };
  return (
    labels[value] ??
    "Polling is blocked. Ask an administrator to inspect the existing integration and execution evidence."
  );
}
function failure(error: unknown, writing = false) {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Current polling access denied. Refresh after your project or pipeline permissions are corrected; no additional authority is granted here.";
    if (error.status === 409)
      return error.message.includes("unresolved execution evidence")
        ? "Unresolved execution evidence requires operator reconciliation. A replacement baseline cannot discard or resubmit those runs. Refresh to review current status."
        : "Polling state changed. Refresh and review the current baseline and pipeline selection before trying again.";
    if (error.status === 422)
      return "The configuration or selected pipelines are not currently eligible. Check the repository, definition branch/path, enabled state and current permissions, then refresh.";
  }
  return writing
    ? "No successful change is confirmed. The request may have reached the server. Refresh current status before deciding whether to try again."
    : "Polling status is unavailable. Refresh to try again. No current polling state or permissions could be verified.";
}

/** A new project identity destroys drafts and ignores every late read/write response. */
export function PollingPanel({ projectId }: { projectId: string }) {
  return <ProjectPollingPanel key={projectId} projectId={projectId} />;
}
function ProjectPollingPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<PollingStatus>();
  const [candidates, setCandidates] = useState<PollingCandidates>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string>();
  const [candidateError, setCandidateError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selected, setSelected] = useState<DraftCandidate[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [review, setReview] = useState<Review>();
  const [acknowledge, setAcknowledge] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const reading = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const lastRevision = useRef<number | undefined>(undefined);
  const lastScope = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (nextPage: number, revalidateDraft = false) => {
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      const request = ++generation.current;
      setLoading(true);
      setReview(undefined);
      setError(undefined);
      setCandidateError(undefined);
      try {
        const next = await getPollingStatus(projectId, controller.signal);
        const scopeKey = JSON.stringify([
          next.scope,
          next.baselineId,
          next.state,
        ]);
        const sameSnapshot =
          lastRevision.current === next.revision &&
          lastScope.current === scopeKey;
        let list: PollingCandidates | undefined;
        const checkedPages = new Map<number, PollingCandidates>();
        let listUnavailable = false;
        if (next.supported) {
          try {
            list = await getPollingCandidates(
              projectId,
              nextPage,
              controller.signal,
            );
            checkedPages.set(nextPage, list);
            if (revalidateDraft && sameSnapshot) {
              const pages = [
                ...new Set(selectedRef.current.map((item) => item.pageHint)),
              ];
              for (const draftPage of pages) {
                if (!checkedPages.has(draftPage))
                  checkedPages.set(
                    draftPage,
                    await getPollingCandidates(
                      projectId,
                      draftPage,
                      controller.signal,
                    ),
                  );
              }
            }
          } catch (cause) {
            if (
              cause instanceof ApiError &&
              (cause.status === 401 || cause.status === 403)
            )
              throw cause;
            listUnavailable = true;
          }
        }
        if (!alive.current || request !== generation.current) return;
        setCandidateError(
          listUnavailable
            ? "Pipeline candidates are unavailable. Refresh before selecting or enabling pipelines. The current polling status remains visible."
            : undefined,
        );
        if (!sameSnapshot) setSelected([]);
        else if (!listUnavailable)
          setSelected((old) =>
            old.filter((item) => {
              const checked = checkedPages.get(item.pageHint);
              if (!checked) return true;
              const current = checked.items.find(
                (row) => row.pipelineId === item.pipelineId,
              );
              return (
                !!current &&
                current.canEnable &&
                current.eligible &&
                current.defaultBranch === item.defaultBranch &&
                current.definitionPath === item.definitionPath &&
                current.name === item.name
              );
            }),
          );
        lastRevision.current = next.revision;
        lastScope.current = scopeKey;
        setStatus(next);
        setCandidates(list);
        setPage(nextPage);
      } catch (cause) {
        if (!alive.current || request !== generation.current) return;
        setStatus(undefined);
        setCandidates(undefined);
        if (
          cause instanceof ApiError &&
          (cause.status === 401 || cause.status === 403)
        )
          setSelected([]);
        setError(failure(cause));
      } finally {
        if (alive.current && request === generation.current) setLoading(false);
      }
    },
    [projectId],
  );
  useEffect(() => {
    alive.current = true;
    void load(1);
    return () => {
      alive.current = false;
      reading.current?.abort();
    };
  }, [load]);

  const refresh = () => {
    if (writing.current) return;
    setReview(undefined);
    setNotice(undefined);
    void load(1, true);
  };
  const fresh = !!status && !loading && !error && !busy;
  const openReview = (action: Action) => {
    if (!fresh || writing.current) return;
    setAcknowledge(false);
    setReview({ action, status, pipelines: [...selected] });
  };
  const perform = async () => {
    if (!review || !fresh || writing.current) return;
    const { action, status: reviewed, pipelines } = review;
    if (reviewed.revision !== status.revision) return;
    const replacement = !!reviewed.baselineId || reviewed.state === "paused";
    if (action === "baseline" && replacement && !acknowledge) return;
    if (
      action === "enable" &&
      (!reviewed.baselineId || !pipelines.length || pipelines.length > 100)
    )
      return;
    writing.current = true;
    setBusy(action);
    setNotice(undefined);
    reading.current?.abort();
    ++generation.current;
    try {
      const input = { expectedRevision: reviewed.revision };
      const next =
        action === "baseline"
          ? await baselinePolling(projectId, {
              ...input,
              acknowledgeDiscard: replacement && acknowledge,
            })
          : action === "enable"
            ? await enablePolling(projectId, {
                ...input,
                baselineId: reviewed.baselineId!,
                pipelineIds: pipelines.map((item) => item.pipelineId),
              })
            : await disablePolling(projectId, input);
      if (!alive.current) return;
      setStatus(next);
      setSelected([]);
      setReview(undefined);
      setNotice(
        action === "baseline"
          ? "Baseline saved. No runs were created. Review it and select pipelines before separately enabling polling."
          : action === "enable"
            ? "Polling enabled for the explicitly selected pipelines. This does not confirm any build or validation of the observed request code."
            : "Polling disabled. No new polling admissions are authorized; already accepted runs are not cancelled.",
      );
      await load(1);
    } catch (cause) {
      if (!alive.current) return;
      setError(failure(cause, true));
      setReview(undefined);
      setStatus(undefined);
      setCandidates(undefined);
      setSelected([]);
    } finally {
      writing.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const replacement =
    review && (!!review.status.baselineId || review.status.state === "paused");
  const canChoose =
    fresh &&
    !candidateError &&
    status.capabilities.canEnable &&
    !!status.baselineId;
  const provider = status?.scope?.provider;
  const providerName =
    provider === "gitlab"
      ? "GitLab"
      : provider === "github"
        ? "GitHub.com"
        : provider === "gitea"
          ? "Gitea"
          : "";
  const requestKind = provider === "gitlab" ? "MR" : provider ? "PR" : "PR/MR";
  return (
    <Panel>
      <Collapsible defaultOpen>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-auto gap-2 px-0">
              <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
              {providerName
                ? `${providerName} ${requestKind} polling`
                : "Repository PR/MR polling"}
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh polling status"
            disabled={!!busy}
            onClick={refresh}
          >
            <RefreshCw
              className={loading ? "size-3.5 animate-spin" : "size-3.5"}
            />{" "}
            Refresh
          </Button>
        </div>
        <CollapsibleContent className="space-y-4 border-t p-4 text-sm">
          <p className="text-muted-foreground">
            Disabled by default. First save a non-executing baseline, then
            separately authorize named existing pipelines for supported{" "}
            {requestKind}
            changes observed after that baseline, including changes observed
            between baseline and enable.
          </p>
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3"
            aria-label="Polling source provenance"
          >
            <p className="font-medium">
              An {requestKind} observation is not proof that {requestKind} code
              was tested.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Saved observation: {providerName || "the provider"}'s reported{" "}
                {requestKind} head revision is trigger metadata.
              </li>
              <li>
                Configured definition: each selected pipeline loads its
                configured branch and path; its definition SHA may differ from
                the observed {requestKind} SHA.
              </li>
              <li>
                Actual Agent checkout: inspect each job's reported initial
                checkout SHA in run details. Missing evidence stays unknown; a
                configured branch or successful run is not {requestKind}-code
                validation.
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Snapshot observations can miss intermediate changes. Bounded
            two-snapshot comparison is not a lossless event stream. Existing
            baseline revisions will not run, and historical event replay is not
            provided. Webhooks are a separate trigger path; duplicate prevention
            across webhooks and polling is not guaranteed. Event/ref matching
            uses the {requestKind} target branch.
          </p>
          {loading && (
            <p role="status">
              {status
                ? "Refreshing polling status… Previous snapshot shown; actions are unavailable."
                : "Loading polling status…"}
            </p>
          )}
          {busy && (
            <p role="status">
              {busy === "baseline"
                ? "Saving non-executing baseline…"
                : busy === "enable"
                  ? "Enabling selected pipelines…"
                  : "Disabling polling…"}{" "}
              Leaving or closing this view does not undo a request already sent.
              Refresh when you return.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {candidateError && (
            <p role="alert" className="text-destructive">
              {candidateError}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {status && (
            <>
              <dl
                className="grid gap-3 sm:grid-cols-2"
                aria-label={
                  loading ? "Previous polling snapshot" : "Polling snapshot"
                }
              >
                <div>
                  <dt className="text-muted-foreground">State</dt>
                  <dd className="font-medium">{stateNames[status.state]}</dd>
                </div>
                {status.scope && (
                  <div>
                    <dt className="text-muted-foreground">
                      Observed repository
                    </dt>
                    <dd className="break-all font-mono text-xs">
                      {status.scope.repository}
                    </dd>
                  </div>
                )}
                {status.baselineCompletedAt && (
                  <div>
                    <dt className="text-muted-foreground">
                      Baseline completed
                    </dt>
                    <dd>{time(status.baselineCompletedAt)}</dd>
                  </div>
                )}
                {status.baselineObservationCount !== undefined && (
                  <div>
                    <dt className="text-muted-foreground">
                      Baseline observations
                    </dt>
                    <dd>
                      {status.baselineObservationCount} saved; no baseline runs
                    </dd>
                  </div>
                )}
                {status.lastCompletedAt && (
                  <div>
                    <dt className="text-muted-foreground">
                      Last completed observation
                    </dt>
                    <dd>{time(status.lastCompletedAt)}</dd>
                  </div>
                )}
                {status.nextRetryAt && (
                  <div>
                    <dt className="text-muted-foreground">
                      Next retry / poll time
                    </dt>
                    <dd>{time(status.nextRetryAt)} (server schedule)</dd>
                  </div>
                )}
              </dl>
              {status.blocker && <p role="status">{reason(status.blocker)}</p>}
              {status.lastPollError && (
                <p role="status">Latest poll: {reason(status.lastPollError)}</p>
              )}
              {status.lastCompletedAt &&
                status.lastObservationCount !== undefined &&
                status.lastTargetCount !== undefined && (
                  <p>
                    Last completed observation: {status.lastObservationCount}{" "}
                    changed snapshot(s), {status.lastTargetCount} matched
                    pipeline target(s).
                    {status.lastTargetCount === 0
                      ? " Observation completed without a matching event/ref target; this is not build success."
                      : " Matching targets do not prove executed commands or build success; inspect run and Agent evidence."}
                  </p>
                )}
              {status.state === "paused" && (
                <p>
                  Polling is paused and will not automatically resume when
                  permissions or configuration are restored. Review the blocker,
                  then save a new baseline and explicitly enable again.
                </p>
              )}
              {status.selectedPipelines.length > 0 && (
                <div>
                  <p className="font-medium">
                    Selected pipelines visible to you
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {status.selectedPipelines.map((item) => (
                      <li key={item.pipelineId}>{item.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!status.capabilities.canBaseline &&
                !status.capabilities.canEnable &&
                !status.capabilities.canDisable &&
                status.supported && (
                  <p>
                    Read-only polling status. Managing polling requires current
                    project read/update permissions; each enabled pipeline
                    additionally requires its own read/trigger permission.
                  </p>
                )}
              {status.supported && candidates && (
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium">
                      Existing pipeline candidates
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Eligibility checks configuration and current permissions
                      only. It does not prove the definition is available or
                      matches a {requestKind} event/ref. New pipelines are never
                      selected automatically. Up to 100 may be explicitly
                      selected.
                    </p>
                  </div>
                  {candidates.items.length === 0 && (
                    <p>
                      {candidates.total === 0
                        ? "No readable pipeline candidates. Ask an administrator to check existing pipeline configuration and your access."
                        : "No candidates on this page. Return to an earlier page or refresh."}
                    </p>
                  )}
                  {candidates.items.length > 0 &&
                    !candidates.items.some(
                      (item) => item.canEnable && item.eligible,
                    ) && (
                      <p>
                        No eligible, authorized pipeline on this page. Check the
                        reasons below or review another page.
                      </p>
                    )}
                  <ul
                    className="divide-y rounded-md border"
                    aria-label="Polling pipeline candidates"
                  >
                    {candidates.items.map((item) => (
                      <li key={item.pipelineId} className="p-3">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 size-4"
                            aria-label={`Select ${item.name} for polling`}
                            checked={selected.some(
                              (row) => row.pipelineId === item.pipelineId,
                            )}
                            disabled={
                              !canChoose ||
                              !item.canEnable ||
                              !item.eligible ||
                              (selected.length >= 100 &&
                                !selected.some(
                                  (row) => row.pipelineId === item.pipelineId,
                                ))
                            }
                            onChange={(event) =>
                              setSelected((old) =>
                                event.target.checked
                                  ? [
                                      ...old.filter(
                                        (row) =>
                                          row.pipelineId !== item.pipelineId,
                                      ),
                                      { ...item, pageHint: page },
                                    ]
                                  : old.filter(
                                      (row) =>
                                        row.pipelineId !== item.pipelineId,
                                    ),
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{item.name}</span>
                            <span className="mt-1 block break-all font-mono text-xs">
                              Definition:{" "}
                              {item.defaultBranch || "Missing branch"} /{" "}
                              {item.definitionPath || "Missing path"}
                            </span>
                            {item.blocker && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {reason(item.blocker)}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {candidates.total > candidates.pageSize && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!fresh || !!candidateError || page <= 1}
                        onClick={() => void load(page - 1)}
                      >
                        Previous candidate page
                      </Button>
                      <span className="text-xs">
                        Page {candidates.pageNum} of{" "}
                        {Math.ceil(candidates.total / candidates.pageSize)} ·{" "}
                        {candidates.total} readable candidates
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !fresh ||
                          !!candidateError ||
                          page * candidates.pageSize >= candidates.total
                        }
                        onClick={() => void load(page + 1)}
                      >
                        Next candidate page
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {selected.length > 0 && (
                <p
                  aria-label="Draft pipeline selection"
                  className="break-words"
                >
                  Selected ({selected.length}):{" "}
                  {selected.map((item) => item.name).join(", ")}
                  {candidateError &&
                    " Draft retained; refresh to revalidate before enabling."}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {status.capabilities.canBaseline && (
                  <Button
                    variant="outline"
                    disabled={!fresh}
                    onClick={() => openReview("baseline")}
                  >
                    {status.baselineId
                      ? "Review replacement baseline"
                      : "Review baseline"}
                  </Button>
                )}
                {status.capabilities.canEnable && (
                  <Button
                    disabled={!canChoose || !selected.length}
                    onClick={() => openReview("enable")}
                  >
                    Review enable polling
                  </Button>
                )}
                {status.capabilities.canDisable && (
                  <Button
                    variant="outline"
                    disabled={!fresh}
                    onClick={() => openReview("disable")}
                  >
                    Review disable polling
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The server rechecks current permissions and exact configuration
                on every change and admission. Disabling stops new polling
                admissions; it does not cancel runs already accepted. Changes to
                the configured definition branch may apply to future
                observations.
              </p>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open) {
            setReview(undefined);
            setAcknowledge(false);
          }
        }}
      >
        {review && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {review.action === "baseline"
                  ? "Save a non-executing baseline"
                  : review.action === "enable"
                    ? "Enable selected pipelines"
                    : "Stop new polling admissions"}
              </DialogTitle>
              <DialogDescription>
                {review.action === "baseline"
                  ? `Read the existing configured ${providerName} repository and save the supported ${requestKind} snapshot. This creates no runs and does not enable polling.`
                  : review.action === "enable"
                    ? `Run only these selected pipelines for supported ${requestKind} changes observed after the reviewed baseline, using their configured definitions. Existing baseline revisions will not run; no historical event replay is provided.`
                    : "Disable this polling authorization. Runs already accepted are not cancelled; existing evidence remains available."}
              </DialogDescription>
            </DialogHeader>
            {review.status.scope && (
              <p className="break-all text-sm">
                Repository: {review.status.scope.repository}
              </p>
            )}
            {review.action === "baseline" && replacement && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0"
                  checked={acknowledge}
                  disabled={!!busy}
                  onChange={(event) => setAcknowledge(event.target.checked)}
                />
                <span>
                  I understand that a replacement baseline may skip unadmitted
                  observed changes. Existing unresolved run evidence cannot be
                  discarded or resubmitted; it requires separate operator
                  reconciliation.
                </span>
              </label>
            )}
            {review.action === "enable" && (
              <div className="space-y-3 text-sm">
                <p>
                  Reviewed baseline completed:{" "}
                  {time(review.status.baselineCompletedAt)}. The interval
                  between baseline and enable is included.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  {review.pipelines.map((item) => (
                    <li key={item.pipelineId}>
                      <span className="font-medium">{item.name}</span>
                      <span className="block break-all font-mono text-xs">
                        {item.defaultBranch} / {item.definitionPath}
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  Future commits to these configured definition branches may be
                  used. The observed {requestKind} head SHA, definition SHA and
                  Agent checkout SHA may differ. Enabling does not prove{" "}
                  {requestKind} code is tested.
                </p>
                <p>
                  Your current project and each pipeline's permissions remain
                  required for new admissions.
                </p>
              </div>
            )}
            {busy && (
              <p role="status" className="text-sm">
                Request in progress. Closing this dialog does not cancel or undo
                it.
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setReview(undefined);
                  setAcknowledge(false);
                }}
              >
                {busy ? "Close" : "Cancel"}
              </Button>
              <Button
                disabled={
                  !fresh ||
                  !!busy ||
                  (review.action === "baseline" &&
                    !!replacement &&
                    !acknowledge)
                }
                onClick={() => void perform()}
              >
                {review.action === "baseline"
                  ? "Save baseline without runs"
                  : review.action === "enable"
                    ? "Enable these pipelines"
                    : "Disable polling"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Panel>
  );
}
