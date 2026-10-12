import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, GitBranch, RefreshCw } from "lucide-react";
import { getPipeline, listPipelines, listRuns } from "@/api/pipeline";
import type { Pipeline } from "@/api/pipeline/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  Panel,
  PanelHeader,
  ColumnHead,
  SectionEyebrow,
} from "@/components/blueprint";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RunStatusBadge,
  formatDuration,
  formatRunTime,
} from "@/components/build/run-status";
import { AgentHealth } from "@/components/observe/agent-health";
import {
  buildRunLink,
  positivePage,
  summarizeRuns,
} from "@/components/observe/health";
import { SnapshotError, SnapshotPages } from "@/components/observe/shared";

const statuses = [
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
  "paused",
];

function PipelineSearch({
  name,
  onApply,
}: {
  name: string;
  onApply: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <form
      className="flex gap-2 border-b p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
    >
      <Input
        aria-label="Search pipelines"
        placeholder="Pipeline name…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-w-0 text-sm"
      />
      <Button type="submit" variant="outline" size="sm">
        Search
      </Button>
    </form>
  );
}

function RunHealth({
  pipeline,
  page,
  status,
  revision,
  onPage,
  onStatus,
}: {
  pipeline: Pipeline;
  page: number;
  status: string;
  revision: number;
  onPage: (page: number) => void;
  onStatus: (status: string) => void;
}) {
  const runs = useApiResource(
    `observe:runs:${JSON.stringify([pipeline.pipelineId, page, status, revision])}`,
    (signal) =>
      listRuns(
        pipeline.pipelineId,
        { page, status: status || undefined },
        signal,
      ),
  );
  const snapshot = runs.error || runs.loading ? undefined : runs.data;
  const summary = snapshot ? summarizeRuns(snapshot.list) : undefined;
  const maxDuration = Math.max(
    1,
    ...(snapshot?.list.map((run) =>
      Number.isFinite(run.duration) ? run.duration : 0,
    ) ?? []),
  );
  return (
    <div className="min-w-0 space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <SectionEyebrow>pipeline execution</SectionEyebrow>
            <h2 className="mt-2 break-words text-xl font-semibold">
              {pipeline.name || pipeline.pipelineId}
            </h2>
            <p className="mt-2 break-words text-sm text-fg-muted">
              {pipeline.description ||
                "Run state and recorded durations from the control plane."}
            </p>
            <p className="mt-3 break-all font-mono text-xs text-fg-subtle">
              {pipeline.defaultBranch || "—"} /{" "}
              {pipeline.pipelineFilePath || "—"}
            </p>
          </div>
          <Link
            to={buildRunLink(pipeline.pipelineId)}
            className="flex items-center gap-1 text-sm text-primary underline underline-offset-2"
          >
            Open in Build <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <h3 className="text-sm font-semibold">Run health</h3>
          <select
            aria-label="Run status"
            value={status}
            onChange={(event) => onStatus(event.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {runs.error ? (
          <SnapshotError
            subject="Run history"
            permission="pipeline:read for this pipeline"
            error={runs.error}
            retry={runs.refresh}
            loading={runs.loading}
          />
        ) : (
          <>
            {runs.loading && (
              <p role="status" className="px-5 py-3 text-sm text-fg-muted">
                {snapshot ? "Refreshing runs…" : "Loading runs…"}
              </p>
            )}
            {snapshot && summary && (
              <>
                <div className="border-t p-5">
                  <p className="text-xs text-fg-muted">
                    {snapshot.total} {status ? "matching" : "total"} runs ·
                    metrics below describe only the {summary.loaded} runs on
                    this page
                  </p>
                  <dl
                    aria-label="Current run page summary"
                    className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"
                  >
                    {[
                      ["Loaded runs", summary.loaded],
                      ["Failed runs", summary.failed],
                      ["Active runs", summary.active],
                      [
                        "Completed mean",
                        summary.meanDuration === null
                          ? "—"
                          : formatDuration(summary.meanDuration),
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-fg-muted">{label}</dt>
                        <dd className="mt-1 font-mono text-2xl font-semibold">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-fg-subtle">
                    Mean uses {summary.durationCount} completed runs with a
                    recorded positive duration. Pending and active runs are
                    excluded.
                  </p>
                </div>
                {snapshot.list.length === 0 ? (
                  <p className="border-t p-8 text-sm text-fg-muted">
                    {page > 1
                      ? "No runs on this page."
                      : status
                        ? "No runs match this status."
                        : "No runs yet for this pipeline."}
                  </p>
                ) : (
                  <Table aria-label="Pipeline execution health">
                    <TableHeader>
                      <TableRow>
                        {[
                          "Run / branch",
                          "Status",
                          "Started",
                          "Recorded duration",
                          "Inspect",
                        ].map((label) => (
                          <TableHead key={label}>
                            <ColumnHead>{label}</ColumnHead>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.list.map((run) => (
                        <TableRow key={run.runId}>
                          <TableCell className="max-w-52">
                            <p className="break-all font-mono text-xs">
                              {run.runId}
                            </p>
                            <p className="mt-1 break-words text-xs text-fg-muted">
                              {run.branch || "—"}
                              {run.commitSha
                                ? ` · ${run.commitSha.slice(0, 7)}`
                                : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <RunStatusBadge status={run.status} />
                            {run.failedJobs > 0 && (
                              <p className="mt-1 text-xs text-destructive">
                                {run.failedJobs} failed jobs
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-fg-muted">
                            {formatRunTime(run.startTime)}
                          </TableCell>
                          <TableCell className="min-w-28">
                            <span className="font-mono text-xs">
                              {Number.isFinite(run.duration) && run.duration > 0
                                ? formatDuration(run.duration)
                                : "—"}
                            </span>
                            {Number.isFinite(run.duration) &&
                              run.duration > 0 && (
                                <div
                                  aria-hidden
                                  className="mt-2 h-1 rounded-full bg-muted"
                                >
                                  <div
                                    className="h-1 rounded-full bg-primary/50"
                                    style={{
                                      width: `${Math.max(1, (run.duration / maxDuration) * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={buildRunLink(pipeline.pipelineId, run.runId)}
                              className="whitespace-nowrap text-xs text-primary underline underline-offset-2"
                              aria-label={`Inspect run ${run.runId} and logs`}
                            >
                              Run & logs{" "}
                              <ArrowUpRight
                                aria-hidden
                                className="ml-1 inline size-3"
                              />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <SnapshotPages
                  name="Run"
                  page={page}
                  total={snapshot.total}
                  loading={runs.loading}
                  onPage={onPage}
                />
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

export default function Observe() {
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const pipelinePage = positivePage(params.get("pipelinePage"));
  const runPage = positivePage(params.get("runPage"));
  const agentPage = positivePage(params.get("agentPage"));
  const name = params.get("pipelineName") ?? "";
  const requestedStatus = params.get("runStatus") ?? "";
  const status = statuses.includes(requestedStatus) ? requestedStatus : "";
  // The server's collection API filters per-pipeline grants. A platform-only
  // action check would incorrectly reject users with project/pipeline access.
  const pipelines = useApiResource(
    `observe:pipelines:${JSON.stringify([pipelinePage, name, revision])}`,
    (signal) =>
      listPipelines(
        { page: pipelinePage, pageSize: 20, name: name || undefined },
        signal,
      ),
  );
  const visiblePipelines =
    pipelines.error || pipelines.loading ? undefined : pipelines.data;
  const pipelineId =
    params.get("pipeline") ||
    (!pipelines.error ? visiblePipelines?.list[0]?.pipelineId : undefined);
  const pipeline = useApiResource(
    pipelineId
      ? `observe:pipeline:${JSON.stringify([pipelineId, revision])}`
      : null,
    (signal) => getPipeline(pipelineId!, signal),
  );
  const updateQuery = (values: Record<string, string | undefined>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="observe / execution health"
        title="Observe"
        sub="Inspect pipeline runs, failures, recorded durations and agent heartbeats. Refresh to fetch a new snapshot."
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw aria-hidden className="size-3.5" />
            Refresh
          </Button>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.8fr)]">
        <Panel className="min-w-0">
          <PanelHeader
            title="Pipelines"
            sub={
              !pipelines.error && visiblePipelines
                ? `${visiblePipelines.total} accessible ${name ? "matches" : "definitions"}`
                : "Permitted pipeline definitions"
            }
          />
          <PipelineSearch
            key={name}
            name={name}
            onApply={(value) =>
              updateQuery({
                pipelineName: value || undefined,
                pipelinePage: undefined,
                pipeline: undefined,
                runPage: undefined,
              })
            }
          />
          {pipelines.error ? (
            <SnapshotError
              subject="Pipeline list"
              permission="pipeline:read on an accessible pipeline"
              error={pipelines.error}
              retry={pipelines.refresh}
              loading={pipelines.loading}
            />
          ) : (
            <>
              {pipelines.loading && (
                <p role="status" className="p-5 text-sm text-fg-muted">
                  {visiblePipelines
                    ? "Refreshing pipelines…"
                    : "Loading pipelines…"}
                </p>
              )}
              {visiblePipelines?.list.length === 0 && (
                <p className="p-5 text-sm text-fg-muted">
                  {pipelinePage > 1
                    ? "No pipelines on this page."
                    : name
                      ? "No accessible pipelines match this search."
                      : "No readable pipelines found. Runs and logs require pipeline:read permission on a pipeline."}
                </p>
              )}
              {visiblePipelines?.list.map((item) => (
                <button
                  type="button"
                  key={item.pipelineId}
                  aria-pressed={pipelineId === item.pipelineId}
                  onClick={() =>
                    updateQuery({
                      pipeline: item.pipelineId,
                      runPage: undefined,
                    })
                  }
                  className={`w-full border-b p-4 text-left last:border-b-0 hover:bg-muted ${pipelineId === item.pipelineId ? "bg-muted shadow-[inset_2px_0_0_var(--brand-signal)]" : ""}`}
                >
                  <p className="break-words text-sm font-medium">
                    {item.name || item.pipelineId}
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-xs text-fg-muted">
                    <GitBranch aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">
                      {item.defaultBranch || "—"}
                    </span>
                    {item.isEnabled === 0 && (
                      <span className="ml-auto">Disabled</span>
                    )}
                  </p>
                </button>
              ))}
              {visiblePipelines && (
                <SnapshotPages
                  name="Pipeline"
                  page={pipelinePage}
                  total={visiblePipelines.total}
                  loading={pipelines.loading}
                  onPage={(page) =>
                    updateQuery({
                      pipelinePage: String(page),
                      pipeline: undefined,
                      runPage: undefined,
                    })
                  }
                />
              )}
            </>
          )}
        </Panel>
        {pipeline.error ? (
          <Panel>
            <SnapshotError
              subject="Pipeline"
              permission="pipeline:read for this pipeline"
              error={pipeline.error}
              retry={pipeline.refresh}
              loading={pipeline.loading}
            />
          </Panel>
        ) : pipeline.data && !pipeline.loading ? (
          <RunHealth
            key={pipeline.data.pipelineId}
            pipeline={pipeline.data}
            page={runPage}
            status={status}
            revision={revision}
            onPage={(page) => updateQuery({ runPage: String(page) })}
            onStatus={(value) =>
              updateQuery({ runStatus: value || undefined, runPage: undefined })
            }
          />
        ) : (
          <Panel>
            <p role="status" className="p-8 text-sm text-fg-muted">
              {pipeline.loading
                ? "Loading pipeline…"
                : "Select a readable pipeline to inspect its execution health."}
            </p>
          </Panel>
        )}
      </div>
      <AgentHealth
        page={agentPage}
        revision={revision}
        onPage={(page) => updateQuery({ agentPage: String(page) })}
      />
    </section>
  );
}
