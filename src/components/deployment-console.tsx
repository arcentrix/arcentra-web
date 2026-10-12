import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  advanceRelease,
  cancelRelease,
  createEnvironment,
  createRelease,
  getRelease,
  inspectRelease,
  recoverRelease,
  listEnvironments,
  listReleases,
} from "@/api/deploy";
import { getRun } from "@/api/pipeline";
import type {
  DeploymentRelease,
  EnvironmentInput,
  ReleaseInspection,
} from "@/api/deploy";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";
const environmentFields: {
  key: keyof EnvironmentInput;
  label: string;
  placeholder: string;
}[] = [
  { key: "name", label: "Environment name", placeholder: "Staging" },
  {
    key: "targetRef",
    label: "Operator target reference",
    placeholder: "staging-web",
  },
  { key: "namespace", label: "Kubernetes namespace", placeholder: "staging" },
  { key: "deployment", label: "Deployment name", placeholder: "web" },
  { key: "container", label: "Container name", placeholder: "app" },
];
const blankEnvironment = {
  name: "",
  targetRef: "",
  namespace: "",
  deployment: "",
  container: "",
};
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request failed. Refresh to verify the current record before trying again.";
}
function Pages({
  page,
  total,
  onPage,
  label,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={`${label} pages`}
      className="flex items-center gap-3 text-xs"
    >
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} · {total} total
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page * 20 >= total}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

/** The key at callers resets all mutation and review state when project identity changes. */
export function DeploymentConsole({
  projectId,
  releaseId,
  mode = "both",
}: {
  projectId: string;
  releaseId?: string;
  mode?: "both" | "environments" | "releases";
}) {
  const [environmentPage, setEnvironmentPage] = useState(1);
  const [releasePage, setReleasePage] = useState(1);
  const environments = useApiResource(
    `deploy:environments:${projectId}:${environmentPage}`,
    (signal) => listEnvironments(projectId, environmentPage, signal),
  );
  const releases = useApiResource(
    mode === "environments"
      ? null
      : `deploy:releases:${projectId}:${releasePage}`,
    (signal) => listReleases(projectId, releasePage, signal),
  );
  const selectedRelease = useApiResource(
    releaseId ? `deploy:release:${projectId}:${releaseId}` : null,
    (signal) => getRelease(projectId, releaseId!, signal),
  );
  const [environment, setEnvironment] =
    useState<EnvironmentInput>(blankEnvironment);
  const [source, setSource] = useState({
    environmentId: "",
    pipelineId: "",
    pipelineRunId: "",
    artifactId: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [review, setReview] = useState<DeploymentRelease | null>(null);
  const [inspection, setInspection] = useState<ReleaseInspection | null>(null);
  const [recoveryConsent, setRecoveryConsent] = useState("");
  const recoveryRun = useApiResource(
    review?.origin === "pipeline_job"
      ? `recovery-run:${projectId}:${review.pipelineId}:${review.pipelineRunId}`
      : null,
    async (signal) => {
      const run = await getRun(
        review!.pipelineId,
        review!.pipelineRunId,
        signal,
      );
      if (
        run.pipelineId !== review!.pipelineId ||
        run.runId !== review!.pipelineRunId
      )
        throw new Error("The original pipeline run could not be verified.");
      return run;
    },
  );
  const locked = useRef(false);
  const mounted = useRef(true);
  const request = useRef({ key: "", id: "" });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = () => {
    setInspection(null);
    setRecoveryConsent("");
    environments.refresh();
    releases.refresh();
    selectedRelease.refresh();
  };
  async function mutate(action: () => Promise<unknown>, success: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await action();
      if (mounted.current) {
        setMessage(success);
        setReview(null);
        refresh();
      }
    } catch (error) {
      if (mounted.current) {
        setFailure(errorText(error));
        refresh();
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function inspect(releaseId: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailure("");
    setInspection(null);
    try {
      const result = await inspectRelease(projectId, releaseId);
      if (mounted.current) setInspection(result);
    } catch (error) {
      if (mounted.current) setFailure(errorText(error));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const environmentSnapshot =
    environments.error || environments.loading ? undefined : environments.data;
  const releaseSnapshot =
    releases.error || releases.loading ? undefined : releases.data;
  const selectedSnapshot =
    selectedRelease.error || selectedRelease.loading
      ? undefined
      : selectedRelease.data;
  const visibleReleases = [
    ...(selectedSnapshot ? [selectedSnapshot] : []),
    ...(releaseSnapshot?.list ?? []).filter(
      (item) => item.releaseId !== releaseId,
    ),
  ];
  const selectedEnvironment = environmentSnapshot?.list.find(
    (item) => item.environmentId === source.environmentId,
  );
  const currentTarget = review
    ? environmentSnapshot?.list.find(
        (item) => item.environmentId === review.environmentId,
      )
    : undefined;
  const recoveryKey = JSON.stringify({
    review,
    currentTarget,
    run: recoveryRun.data,
  });
  const recoveryAllowed =
    review?.status === "applying" &&
    recoveryConsent === recoveryKey &&
    (review.origin !== "pipeline_job" ||
      (!!recoveryRun.data && !recoveryRun.loading && !recoveryRun.error));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          className="underline underline-offset-4"
          to={`/projects/${encodeURIComponent(projectId)}/pipelines`}
        >
          View project pipelines
        </Link>
        <Link
          className="underline underline-offset-4"
          to={`/projects/${encodeURIComponent(projectId)}/artifacts`}
        >
          View project artifacts
        </Link>
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
          Refresh records
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Release an immutable image manifest from a successful pipeline run.
        Persisted run approvals must be approved; missing or legacy DSL gates
        are not verified. Cluster targets are configured by an operator for an
        exact project, namespace, Deployment, and container. Saving records does
        not deploy anything.
      </div>
      {failure && (
        <p
          role="alert"
          className="rounded border border-red-500/30 p-3 text-sm text-red-600"
        >
          {failure}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {environments.error && (
        <p role="alert">
          Environments could not be loaded: {errorText(environments.error)}
        </p>
      )}
      {environments.loading && <p role="status">Loading environments…</p>}
      {mode !== "releases" && (
        <section
          className="space-y-4 rounded-xl border p-5"
          aria-label="Environments"
        >
          <div>
            <h3 className="text-lg font-semibold">Environments</h3>
            <p className="text-sm text-muted-foreground">
              Configuration status only. Environment records do not report live
              workload health.
            </p>
          </div>
          {environmentSnapshot?.list.length === 0 && (
            <p>No environments yet. Add an exact target binding below.</p>
          )}
          {environmentSnapshot?.list.map((item) => (
            <article
              key={item.environmentId}
              className="flex flex-wrap justify-between gap-3 rounded border p-3"
            >
              <div>
                <h4 className="font-medium">{item.name}</h4>
                <p className="font-mono text-xs">
                  {item.targetRef} · {item.namespace}/{item.deployment} ·{" "}
                  {item.container}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Environment ID: {item.environmentId}
                </p>
              </div>
              <div className="text-sm">
                <span>
                  {item.configured
                    ? "Target configured"
                    : "Target not configured"}
                </span>
                {item.activeReleaseId && (
                  <p className="text-xs">An active release holds this target</p>
                )}
              </div>
            </article>
          ))}
          {environmentSnapshot && (
            <Pages
              label="Environments"
              page={environmentPage}
              total={environmentSnapshot.total}
              onPage={setEnvironmentPage}
            />
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Add environment binding
            </summary>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(
                  () => createEnvironment(projectId, environment),
                  "Environment saved. An operator must configure this exact target before execution.",
                );
              }}
            >
              {environmentFields.map(({ key, label, placeholder }) => (
                <label className="grid gap-1 text-xs" key={key}>
                  {label}
                  <Input
                    required
                    maxLength={key === "deployment" ? 253 : 128}
                    placeholder={placeholder}
                    value={environment[key]}
                    onChange={(event) =>
                      setEnvironment({
                        ...environment,
                        [key]: event.target.value,
                      })
                    }
                    disabled={busy}
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground md:col-span-2">
                Bindings are immutable. No cluster URL, token, or kubeconfig is
                accepted here. Requires project update permission.
              </p>
              <Button type="submit" disabled={busy} className="w-fit">
                Save environment
              </Button>
            </form>
          </details>
        </section>
      )}
      {mode !== "environments" && (
        <>
          <section
            className="space-y-4 rounded-xl border p-5"
            aria-label="Prepare release"
          >
            <div>
              <h3 className="text-lg font-semibold">Prepare release</h3>
              <p className="text-sm text-muted-foreground">
                Select the registered JSON artifact containing only an image
                field with a SHA256-pinned image reference. The server verifies
                artifact bytes and pipeline ownership.
              </p>
            </div>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const key = JSON.stringify(source);
                if (request.current.key !== key)
                  request.current = { key, id: crypto.randomUUID() };
                void mutate(
                  () =>
                    createRelease(projectId, {
                      ...source,
                      requestId: request.current.id,
                    }),
                  "Release prepared. Review it before executing the Kubernetes change.",
                );
              }}
            >
              <label className="grid gap-1 text-xs">
                Environment
                <select
                  className={selectClass}
                  required
                  value={source.environmentId}
                  disabled={busy || !environmentSnapshot}
                  onChange={(event) =>
                    setSource({ ...source, environmentId: event.target.value })
                  }
                >
                  <option value="">Select environment</option>
                  {environmentSnapshot?.list.map((item) => (
                    <option key={item.environmentId} value={item.environmentId}>
                      {item.name}
                      {item.configured ? "" : " · target not configured"}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  { key: "pipelineId", label: "Pipeline ID" },
                  { key: "pipelineRunId", label: "Successful run ID" },
                  { key: "artifactId", label: "Image manifest artifact ID" },
                ] as const
              ).map(({ key, label }) => (
                <label className="grid gap-1 text-xs" key={key}>
                  {label}
                  <Input
                    required
                    maxLength={64}
                    value={source[key]}
                    disabled={busy}
                    onChange={(event) =>
                      setSource({ ...source, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground md:col-span-2">
                Only a successful run with an immutable definition revision and
                completed persisted approvals can be selected. Missing legacy
                DSL gates are not verified. Requires project update and pipeline
                read/trigger plus the target tier’s release permission.
              </p>
              <Button
                type="submit"
                disabled={busy || !selectedEnvironment?.configured}
                className="w-fit"
              >
                Prepare release
              </Button>
            </form>
            {mode === "releases" && environmentSnapshot && (
              <Pages
                label="Environment selection"
                page={environmentPage}
                total={environmentSnapshot.total}
                onPage={setEnvironmentPage}
              />
            )}
          </section>
          <section
            className="space-y-4 rounded-xl border p-5"
            aria-label="Release history"
          >
            <div>
              <h3 className="text-lg font-semibold">Release history</h3>
              <p className="text-sm text-muted-foreground">
                Execution and rollout checks are explicit. Historical success is
                an observation at the recorded time, not current health. Active
                releases cannot be cancelled or automatically rolled back.
              </p>
            </div>
            {releaseId && (
              <div className="rounded border p-3 text-sm">
                <p className="break-all">Selected release: {releaseId}</p>
                {selectedRelease.loading && (
                  <p role="status">Loading selected release…</p>
                )}
                {selectedRelease.error && (
                  <p role="alert">
                    Selected release unavailable:{" "}
                    {errorText(selectedRelease.error)}
                  </p>
                )}
              </div>
            )}
            {releases.loading && <p role="status">Loading releases…</p>}
            {releases.error && (
              <p role="alert">
                Releases could not be loaded: {errorText(releases.error)}
              </p>
            )}
            {releaseSnapshot?.list.length === 0 && !selectedSnapshot && (
              <p>No releases in this project.</p>
            )}
            {visibleReleases.map((release) => {
              const target = environmentSnapshot?.list.find(
                (item) => item.environmentId === release.environmentId,
              );
              return (
                <article
                  key={release.releaseId}
                  aria-label={
                    release.releaseId === releaseId
                      ? "Selected release details"
                      : undefined
                  }
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium">
                      {target?.name ?? release.environmentId}
                    </h4>
                    <span className="rounded border px-2 py-1 text-xs uppercase tracking-wide">
                      {release.status}
                    </span>
                  </div>
                  <p className="break-all font-mono text-xs">{release.image}</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p className="break-all">Release: {release.releaseId}</p>
                    <p className="break-all">
                      Run: {release.pipelineRunId} · definition revision{" "}
                      {release.commitSha}
                    </p>
                    <p className="break-all">Artifact: {release.artifactId}</p>
                    <p>{release.reason}</p>
                    {release.lastObservedAt ? (
                      <p>
                        Last Kubernetes observation:{" "}
                        {new Date(release.lastObservedAt).toLocaleString()} ·{" "}
                        {release.updatedReplicas}/{release.desiredReplicas}{" "}
                        updated · {release.availableReplicas}/
                        {release.desiredReplicas} available
                      </p>
                    ) : (
                      <p>No rollout observation yet</p>
                    )}
                  </div>
                  {release.status === "applying" && (
                    <p className="text-xs text-muted-foreground">
                      Apply is unresolved and the target remains reserved. An
                      operator must inspect and explicitly recover this same
                      release ID. Pipeline cancellation or timeout does not roll
                      back changes.
                    </p>
                  )}
                  <Link
                    className="inline-block text-xs underline underline-offset-2"
                    to={`/projects/${encodeURIComponent(projectId)}/pipelines/${encodeURIComponent(release.pipelineId)}?run=${encodeURIComponent(release.pipelineRunId)}`}
                  >
                    Return to pipeline run
                  </Link>
                  {inspection?.releaseId === release.releaseId && (
                    <div
                      aria-label="Read-only Kubernetes inspection"
                      className="space-y-1 rounded border p-3 text-xs"
                    >
                      <p>Observed Kubernetes state: {inspection.status}</p>
                      <p>{inspection.reason}</p>
                      <p>
                        {inspection.updatedReplicas}/
                        {inspection.desiredReplicas} updated ·{" "}
                        {inspection.availableReplicas}/
                        {inspection.desiredReplicas} available
                      </p>
                      <p>
                        This inspection made no changes. Persisted release
                        status remains {inspection.persistedStatus}; it does not
                        clear a reservation or restart the pipeline.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {release.status === "queued" &&
                      release.origin !== "pipeline_job" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy || !target?.configured}
                            onClick={() => {
                              setFailure("");
                              setRecoveryConsent("");
                              setReview(release);
                            }}
                          >
                            Review execution
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                () =>
                                  cancelRelease(projectId, release.releaseId),
                                "Queued release cancelled before apply.",
                              )
                            }
                          >
                            Cancel queued release
                          </Button>
                          {!target?.configured && (
                            <span className="self-center text-xs text-muted-foreground">
                              Execution requires a configured target on the
                              current environment page.
                            </span>
                          )}
                        </>
                      )}
                    {release.status === "applying" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setFailure("");
                          setRecoveryConsent("");
                          setReview(release);
                        }}
                      >
                        Review same-release recovery
                      </Button>
                    )}
                    {release.status === "observing" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            () => advanceRelease(projectId, release.releaseId),
                            "Rollout observation recorded. The release status and reservation now reflect the verified result.",
                          )
                        }
                      >
                        Record rollout observation
                      </Button>
                    )}
                    {(release.status === "applying" ||
                      release.status === "observing") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void inspect(release.releaseId)}
                      >
                        Inspect Kubernetes state
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
            {releaseSnapshot && (
              <Pages
                label="Releases"
                page={releasePage}
                total={releaseSnapshot.total}
                onPage={setReleasePage}
              />
            )}
          </section>
        </>
      )}
      <Dialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {review?.status === "applying"
                ? "Recover this same Kubernetes release?"
                : "Execute Kubernetes release"}
            </DialogTitle>
            <DialogDescription>
              This updates one container in an existing Deployment. The server
              uses the immutable image below and refuses a changed workload
              identity. Acceptance does not imply rollout success.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Project: {projectId}</p>
            <p>
              Target:{" "}
              {currentTarget
                ? `${currentTarget.targetRef} · ${currentTarget.namespace}/${currentTarget.deployment} · ${currentTarget.container}`
                : review?.environmentId}
            </p>
            <p className="break-all font-mono text-xs">{review?.image}</p>
            <p className="break-all text-xs">
              Source run: {review?.pipelineRunId}
            </p>
            {review?.status === "applying" && (
              <p>
                A previous request may already have applied. Explicit recovery
                checks the stored workload identity and release marker, then may
                perform the original image update if it was not applied. This
                does not create a replacement release or roll back changes.
              </p>
            )}
            {review?.status === "applying" && (
              <>
                <p className="break-all font-mono text-xs">
                  Same release ID: {review.releaseId}
                </p>
                {review.origin === "pipeline_job" && (
                  <div className="space-y-1 text-xs">
                    {recoveryRun.loading && (
                      <p role="status">Checking original pipeline state…</p>
                    )}
                    {recoveryRun.error && (
                      <p role="alert">
                        Cannot verify original pipeline:{" "}
                        {errorText(recoveryRun.error)}
                      </p>
                    )}
                    {recoveryRun.data && !recoveryRun.error && (
                      <p>Original pipeline status: {recoveryRun.data.status}</p>
                    )}
                    <p>
                      Recovery can apply the pending image even if the original
                      pipeline was cancelled or timed out. A stopped pipeline
                      remains terminal; recovery never restarts it. Cancellation
                      never guarantees rollback.
                    </p>
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recoveryConsent === recoveryKey}
                    disabled={
                      busy ||
                      (review.origin === "pipeline_job" &&
                        (recoveryRun.loading ||
                          !!recoveryRun.error ||
                          !recoveryRun.data))
                    }
                    onChange={(event) =>
                      setRecoveryConsent(
                        event.target.checked ? recoveryKey : "",
                      )
                    }
                  />
                  <span>
                    I authorize recovery of this same release, including the
                    original image update if it has not applied
                  </span>
                </label>
              </>
            )}
            {failure && (
              <p role="alert" className="text-red-600">
                {failure}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Back
            </Button>
            <Button
              disabled={
                busy ||
                !review ||
                !currentTarget?.configured ||
                (review.status === "applying" && !recoveryAllowed)
              }
              onClick={() => {
                if (!review || locked.current || !currentTarget?.configured)
                  return;
                if (review.status === "applying") {
                  if (!recoveryAllowed) return;
                  void mutate(
                    () => recoverRelease(projectId, review.releaseId),
                    "Same-release recovery recorded. Inspect Kubernetes state to verify the outcome; the original pipeline status is unchanged.",
                  );
                } else {
                  void mutate(
                    () => advanceRelease(projectId, review.releaseId),
                    "Execution request recorded. Inspect Kubernetes state to obtain a read-only observation.",
                  );
                }
              }}
            >
              {busy
                ? "Submitting…"
                : review?.status === "applying"
                  ? "Recover same release"
                  : "Apply selected image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
