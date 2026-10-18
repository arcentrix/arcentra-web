import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, RefreshCw, Square, Terminal } from "lucide-react";
import {
  getRun,
  getRunJobs,
  getRunLogs,
  isActiveRun,
  isTerminalRun,
  stopRun,
} from "@/api/pipeline";
import type { JobRun } from "@/api/pipeline/types";
import { RunDeployment } from "./run-deployment";
import { RunApprovals } from "./run-approvals";
import { useApiResource } from "@/hooks/use-api-resource";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { formatRunLogOutput } from "./run-log-output";
import { Panel, PanelHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { InlineErrorState } from "@/components/inline-error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RunStatusBadge,
  formatDuration,
  formatRunTime,
  errorMessage,
} from "./run-status";

function controllerManaged(job: JobRun) {
  return job.steps.some(
    (step) =>
      !!step.deploymentReleaseId ||
      (step.uses === "builtin:kubernetes" && step.action === "deploy"),
  );
}

function InitialCheckout({ job }: { job: JobRun }) {
  const reported =
    job.sourceProvenanceState === "reported" &&
    job.sourceExpectationCaptured &&
    job.sourceType === "git" &&
    !!job.sourceRepository &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(job.sourceResolvedCommit);
  const noSource =
    job.sourceExpectationCaptured && !job.sourceType && !job.sourceRepository;
  return (
    <section
      aria-label={`${job.jobName} initial checkout`}
      className="mt-3 rounded-md border bg-muted/20 p-3 text-xs"
    >
      <h4 className="font-medium">Initial source checkout</h4>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Source repository</dt>
          <dd className="mt-1 break-all font-mono">
            {job.sourceRepository || (noSource ? "Not configured" : "Unknown")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Requested ref</dt>
          <dd className="mt-1 break-all font-mono">
            {job.sourceRef ||
              (job.sourceRepository ? "Not specified" : "Unknown")}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Initial commit SHA</dt>
          <dd className="mt-1 break-all font-mono">
            {reported ? job.sourceResolvedCommit : "Unknown"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Evidence state</dt>
          <dd className="mt-1">
            {reported ? "Agent-reported initial checkout" : "Unknown"}
          </dd>
        </div>
      </dl>
      {!reported && (
        <p className="mt-3 text-muted-foreground">
          {!job.sourceExpectationCaptured
            ? "No captured source expectation is available for this job. Older runs remain unknown."
            : noSource
              ? "No source checkout was configured for this job."
              : "No Agent checkout report is recorded. It may still be awaiting the terminal report, checkout may not have completed, or the Agent may not support reporting."}
        </p>
      )}
    </section>
  );
}

interface RunDetailProps {
  pipelineId: string;
  runId: string;
  projectId: string;
  onChanged: () => void;
}

export function RunDetail(props: RunDetailProps) {
  const auth = authStore.useState();
  const { userinfo } = userStore.useState();
  // Match the existing cookie/token session invalidation pattern. Credentials
  // never enter React keys, output, or diagnostics.
  const identity = `${auth.initialized}:${auth.accessToken}:${userinfo?.userId ?? ""}`;
  const session = useRef({ identity, revision: 0 });
  if (session.current.identity !== identity) {
    session.current = { identity, revision: session.current.revision + 1 };
  }
  if (!auth.initialized || !(auth.accessToken || userinfo?.userId)) {
    return <p role="status">Sign in to view execution details.</p>;
  }
  return (
    <RunDetailContent
      key={JSON.stringify([
        props.projectId,
        props.pipelineId,
        props.runId,
        session.current.revision,
      ])}
      {...props}
    />
  );
}

function RunDetailContent({
  pipelineId,
  runId,
  projectId,
  onChanged,
}: RunDetailProps) {
  const permission = useScopedPermission("project", projectId);
  const [terminal, setTerminal] = useState(false);
  const [logsSettled, setLogsSettled] = useState(false);
  useEffect(() => {
    if (!terminal) {
      setLogsSettled(false);
      return;
    }
    // Agent completion can precede the final Kafka log batch. Keep a bounded
    // catch-up window, then leave manual Refresh available for slower delivery.
    const timer = setTimeout(() => setLogsSettled(true), 15000);
    return () => clearTimeout(timer);
  }, [terminal]);
  const resource = useApiResource(
    `run:${pipelineId}:${runId}`,
    async (signal) => {
      const run = await getRun(pipelineId, runId, signal);
      if (!signal.aborted) setTerminal(isTerminalRun(run.status));
      return run;
    },
    terminal ? 0 : 3000,
  );
  const jobs = useApiResource(
    `jobs:${pipelineId}:${runId}:${terminal}`,
    (signal) => getRunJobs(pipelineId, runId, signal),
    terminal ? 0 : 3000,
  );
  const [logStep, setLogStep] = useState("");
  const [logCursors, setLogCursors] = useState([0]);
  const fromLine = logCursors[logCursors.length - 1];
  const logs = useApiResource(
    `logs:${pipelineId}:${runId}:${terminal}:${logStep}:${fromLine}`,
    (signal) =>
      getRunLogs(pipelineId, runId, signal, {
        stepRunId: logStep || undefined,
        fromLine,
      }),
    terminal && logsSettled ? 0 : 3000,
  );
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const pending = useRef(false);
  const refresh = () => {
    resource.refresh();
    jobs.refresh();
    logs.refresh();
    onChanged();
  };
  const cancel = async () => {
    if (pending.current) return;
    pending.current = true;
    setStopping(true);
    setActionError("");
    try {
      await stopRun(pipelineId, runId);
      setConfirmStop(false);
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      pending.current = false;
      setStopping(false);
    }
  };
  const logOutput = useMemo(
    () =>
      formatRunLogOutput(
        logs.error ? undefined : logs.data,
        jobs.error ? undefined : jobs.data,
        { fromLine, stepId: logStep },
      ),
    [logs.data, logs.error, jobs.data, jobs.error, fromLine, logStep],
  );
  const logText = logOutput.text;
  const canCopy = !!logs.data && !!logText && !logs.error && !jobs.error;
  const copyLogs = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(logText);
      setCopied(logText);
    } catch {
      setActionError("Could not copy logs. Select and copy the text instead.");
    }
  };
  return (
    <div className="min-w-0 space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">Execution details</h3>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {runId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh execution"
              onClick={refresh}
            >
              <RefreshCw
                className={
                  resource.loading ? "size-3.5 animate-spin" : "size-3.5"
                }
              />
            </Button>
            {resource.data && <RunStatusBadge status={resource.data.status} />}
          </div>
        </div>
        {resource.error && (
          <InlineErrorState
            title="Run could not be refreshed"
            description={resource.error.message}
            onRetry={resource.refresh}
            minHeight={150}
          />
        )}
        {!resource.data && resource.loading && (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            Loading execution…
          </p>
        )}
        {resource.data && (
          <>
            <dl className="grid grid-cols-2 gap-4 border-t p-5 text-xs">
              <div>
                <dt className="text-muted-foreground">
                  Recorded trigger branch
                </dt>
                <dd className="mt-1 break-all font-mono">
                  {resource.data.branch || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Definition revision</dt>
                <dd className="mt-1 break-all font-mono">
                  {resource.data.definitionCommitSha || "Unknown"}
                </dd>
                <dd className="mt-1 text-muted-foreground">
                  Pipeline definition loaded for this run.
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Recorded trigger revision
                </dt>
                <dd className="mt-1 break-all font-mono">
                  {resource.data.commitSha || "Unknown"}
                </dd>
                <dd className="mt-1 text-muted-foreground">
                  Ambiguous legacy value; may identify the definition. Per-job
                  checkout evidence is below.
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="mt-1">
                  {formatRunTime(resource.data.startTime)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-mono">
                  {formatDuration(resource.data.duration)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jobs completed</dt>
                <dd className="mt-1 font-mono">
                  {resource.data.completedJobs} / {resource.data.totalJobs}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Failed jobs</dt>
                <dd className="mt-1 font-mono">{resource.data.failedJobs}</dd>
              </div>
            </dl>
            {isActiveRun(resource.data.status) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
                <p className="text-xs text-muted-foreground">
                  Refreshing every 3 seconds
                </p>
                {permission.has("pipeline:cancel") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={stopping}
                    onClick={() => {
                      setActionError("");
                      setConfirmStop(true);
                    }}
                  >
                    <Square className="size-3" /> Cancel run
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
      <RunApprovals
        projectId={projectId}
        pipelineId={pipelineId}
        runId={runId}
      />
      <Panel>
        <PanelHeader
          title="Jobs & steps"
          sub="Persisted execution state from agents and the controller"
        />
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Each Agent report describes that job's initial checkout before user
          steps. It is not a build attestation or proof of the current
          workspace, artifacts, or image contents. Jobs can use different
          repositories and commits.
        </p>
        <div className="border-t">
          {jobs.error && (
            <InlineErrorState
              title="Jobs unavailable"
              description={jobs.error.message}
              onRetry={jobs.refresh}
              minHeight={150}
            />
          )}
          {!jobs.data && jobs.loading && (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              Loading jobs…
            </p>
          )}
          {jobs.data?.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              No jobs reported yet. The run may still be preparing.
            </p>
          )}
          {jobs.data?.map((job) => (
            <div key={job.jobRunId} className="border-b p-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm font-medium">
                  {job.jobName}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDuration(job.duration)}
                </span>
                <RunStatusBadge status={job.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {controllerManaged(job)
                  ? "Controller-managed deployment"
                  : "Agent: "}
                {job.agentId ? (
                  <Link
                    className="underline underline-offset-2"
                    to={`/agents/${encodeURIComponent(job.agentId)}`}
                  >
                    {job.agentId}
                  </Link>
                ) : controllerManaged(job) ? (
                  ""
                ) : (
                  "Not assigned"
                )}
              </p>
              <InitialCheckout job={job} />
              {job.errorMessage && (
                <p className="mt-2 break-words text-xs text-destructive">
                  {job.errorMessage}
                </p>
              )}
              {job.steps.some((step) => step.retryMode) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Every attempt keeps separate logs and artifacts. Unused
                  attempts are skipped. Retrying a completed job is unavailable
                  without a verified workspace checkpoint. Before starting a new
                  run, inspect any existing deployment release; an unresolved
                  apply must be recovered using its original release ID.
                </p>
              )}
              <ol className="mt-3 space-y-2">
                {job.steps.map((step) => (
                  <li
                    key={step.stepRunId}
                    className="rounded-md border bg-muted/20 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-xs">
                        {step.name}
                        {step.retryMode
                          ? ` · attempt ${step.attempt ?? 1} · ${step.retryMode === "whole_job" ? "whole job" : "failed step"}`
                          : ""}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(step.duration)}
                      </span>
                      <RunStatusBadge status={step.status} />
                    </div>
                    {step.deploymentReleaseId && (
                      <RunDeployment
                        key={`${projectId}:${step.deploymentReleaseId}`}
                        projectId={projectId}
                        pipelineId={pipelineId}
                        runId={runId}
                        releaseId={step.deploymentReleaseId}
                      />
                    )}
                    {step.exitCode !== null && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        Exit code {step.exitCode}
                      </p>
                    )}
                    {step.errorMessage && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-destructive">
                        {step.errorMessage}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Terminal className="size-4" />
            <h3 className="text-sm font-semibold">Execution logs</h3>
            {terminal && !logsSettled && (
              <span role="status" className="text-xs text-muted-foreground">
                Collecting final output…
              </span>
            )}
            {terminal && logsSettled && (
              <span className="text-xs text-muted-foreground">
                Delivery can be delayed. Refresh to check for replayed logs.
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyLogs()}
            disabled={!canCopy}
          >
            <Copy className="size-3.5" />
            {copied === logText && canCopy ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          <label className="text-xs text-muted-foreground" htmlFor="log-step">
            Output
          </label>
          <select
            id="log-step"
            value={logStep}
            onChange={(event) => {
              setLogStep(event.target.value);
              setLogCursors([0]);
              setCopied(null);
            }}
            className="min-w-0 max-w-full rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">All steps</option>
            {jobs.data?.flatMap((job) =>
              job.steps.map((step) => (
                <option key={step.stepRunId} value={step.stepRunId}>
                  {job.jobName} / {step.name}
                  {step.retryMode ? ` / attempt ${step.attempt ?? 1}` : ""}
                </option>
              )),
            )}
          </select>
          {!!logStep && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={logs.loading || logCursors.length <= 1}
                onClick={() => setLogCursors((cursors) => cursors.slice(0, -1))}
              >
                Previous output
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  logs.loading ||
                  !logs.data?.truncated ||
                  logOutput.nextLine === undefined
                }
                onClick={() => {
                  const next = logOutput.nextLine;
                  if (next !== undefined && next > fromLine)
                    setLogCursors((cursors) => [...cursors, next]);
                }}
              >
                Next output
              </Button>
            </div>
          )}
        </div>
        {logs.error ? (
          <InlineErrorState
            title="Logs unavailable"
            description={logs.error.message}
            onRetry={logs.refresh}
            minHeight={150}
          />
        ) : (
          <>
            <pre
              tabIndex={0}
              aria-label="Execution logs"
              className="max-h-96 min-h-36 overflow-auto border-t bg-[#0c121b] p-4 font-mono text-xs leading-6 text-slate-200"
            >
              {logText ||
                (logs.loading ? "Loading logs…" : "No output received yet.")}
            </pre>
          </>
        )}
      </Panel>
      {actionError && !confirmStop && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <Dialog
        open={confirmStop}
        onOpenChange={(open) => {
          if (!stopping) setConfirmStop(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this run?</DialogTitle>
            <DialogDescription>
              Running jobs will be interrupted and pending jobs will be
              cancelled. This cannot undo steps that have already completed.
              Kubernetes changes already applied will not be rolled back. An
              unresolved apply keeps its target reserved; inspect and explicitly
              recover the same release ID in Deployments.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={stopping}
              onClick={() => setConfirmStop(false)}
            >
              Keep running
            </Button>
            <Button
              variant="destructive"
              disabled={stopping}
              onClick={() => void cancel()}
            >
              {stopping ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
