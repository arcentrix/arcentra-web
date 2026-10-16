import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileCode2, GitBranch, Play, Plus, RefreshCw } from "lucide-react";
import { getPipeline, listPipelines, listRuns } from "@/api/pipeline";
import { useApiResource } from "@/hooks/use-api-resource";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import { Panel, PanelHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineErrorState } from "@/components/inline-error-state";
import { AgentReadiness } from "./agent-readiness";
import { PollingPanel } from "./polling-panel";
import {
  CreatePipelineDialog,
  PipelineSpecDialog,
  RunPipelineDialog,
} from "./pipeline-dialogs";
import { RunDetail } from "./run-detail";
import { formatDuration, formatRunTime, RunStatusBadge } from "./run-status";
import type { Pipeline } from "@/api/pipeline/types";

export function PipelineWorkspace({
  projectId,
  pipelineId,
}: {
  projectId?: string;
  pipelineId?: string;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const permission = useScopedPermission("project", projectId);
  const pipelines = useApiResource(
    `pipelines:${projectId ?? "all"}:${page}:${search}`,
    (signal) => listPipelines({ projectId, page, name: search }, signal),
    15000,
  );
  const selectedId =
    pipelineId ?? params.get("pipeline") ?? pipelines.data?.list[0]?.pipelineId;
  const selected = useApiResource(
    selectedId ? `pipeline:${selectedId}` : null,
    (signal) => getPipeline(selectedId!, signal),
    15000,
  );
  const selectPipeline = (id: string) => {
    if (pipelineId && projectId) {
      navigate(
        `/projects/${encodeURIComponent(projectId)}/pipelines/${encodeURIComponent(id)}`,
      );
      return;
    }
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("pipeline", id);
      next.delete("run");
      return next;
    });
  };
  return (
    <div className="space-y-5">
      {projectId && <PollingPanel projectId={projectId} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Search pipelines"
            placeholder="Search pipelines…"
            className="w-60"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh pipelines"
            onClick={() => {
              pipelines.refresh();
              selected.refresh();
            }}
          >
            <RefreshCw
              className={
                pipelines.loading ? "size-3.5 animate-spin" : "size-3.5"
              }
            />
          </Button>
        </div>
        {(!projectId ||
          permission.loading ||
          permission.has("pipeline:create")) && (
          <Button
            size="sm"
            disabled={!!projectId && permission.loading}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            New pipeline
          </Button>
        )}
      </div>
      {permission.error && !selected.data && (
        <p role="alert" className="text-sm text-destructive">
          Could not check project permissions: {permission.error.message}{" "}
          <button
            type="button"
            className="underline"
            onClick={permission.refresh}
          >
            Retry
          </button>
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.6fr)]">
        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader
              title="Pipelines"
              sub={
                pipelines.data
                  ? `${pipelines.data.total} definitions`
                  : "Repository-backed definitions"
              }
            />
            <div className="border-t">
              {pipelines.error && (
                <InlineErrorState
                  title="Pipelines unavailable"
                  description={pipelines.error.message}
                  onRetry={pipelines.refresh}
                  minHeight={200}
                />
              )}
              {!pipelines.data && pipelines.loading && (
                <p role="status" className="p-5 text-sm text-muted-foreground">
                  Loading pipelines…
                </p>
              )}
              {pipelines.data?.list.length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">
                  {search
                    ? "No pipelines match this search."
                    : "No pipelines yet. Connect a repository definition to get started."}
                </p>
              )}
              {pipelines.data?.list.map((pipeline) => (
                <button
                  type="button"
                  key={pipeline.pipelineId}
                  aria-pressed={selectedId === pipeline.pipelineId}
                  onClick={() => selectPipeline(pipeline.pipelineId)}
                  className={`w-full border-b p-4 text-left transition-colors last:border-b-0 hover:bg-muted ${selectedId === pipeline.pipelineId ? "bg-muted shadow-[inset_2px_0_0_var(--brand-signal)]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {pipeline.name}
                    </span>
                    {pipeline.isEnabled === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <GitBranch className="size-3" />
                    <span className="truncate">{pipeline.defaultBranch}</span>
                    <span className="ml-auto whitespace-nowrap">
                      {pipeline.totalRuns} runs
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {pipelines.data && pipelines.data.total > 20 && (
              <Pagination
                page={page}
                total={pipelines.data.total}
                pageSize={20}
                onPage={setPage}
                loading={pipelines.loading}
              />
            )}
          </Panel>
          <AgentReadiness />
        </div>
        <div className="min-w-0">
          {selected.error ? (
            <Panel>
              <InlineErrorState
                title="Pipeline unavailable"
                description={selected.error.message}
                onRetry={selected.refresh}
              />
            </Panel>
          ) : selected.data ? (
            <PipelineExecution
              key={selected.data.pipelineId}
              pipeline={selected.data}
              onChanged={() => {
                selected.refresh();
                pipelines.refresh();
              }}
            />
          ) : (
            <Panel>
              <p role="status" className="p-8 text-sm text-muted-foreground">
                {selected.loading
                  ? "Loading pipeline…"
                  : "Select a pipeline to view its runs."}
              </p>
            </Panel>
          )}
        </div>
      </div>
      {createOpen && (
        <CreatePipelineDialog
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            pipelines.refresh();
            selectPipeline(id);
          }}
        />
      )}
    </div>
  );
}

function PipelineExecution({
  pipeline,
  onChanged,
}: {
  pipeline: Pipeline;
  onChanged: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [runOpen, setRunOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const permission = useScopedPermission("project", pipeline.projectId);
  const runs = useApiResource(
    `runs:${pipeline.pipelineId}:${page}:${status}`,
    (signal) => listRuns(pipeline.pipelineId, { page, status }, signal),
    5000,
  );
  const selectedRunId = params.get("run") ?? runs.data?.list[0]?.runId;
  const selectRun = (id: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("pipeline", pipeline.pipelineId);
      next.set("run", id);
      return next;
    });
  return (
    <div className="space-y-5">
      {permission.error && (
        <p role="alert" className="text-sm text-destructive">
          Could not check project permissions: {permission.error.message}{" "}
          <button
            type="button"
            className="underline"
            onClick={permission.refresh}
          >
            Retry
          </button>
        </p>
      )}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{pipeline.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pipeline.description || "Repository-backed pipeline"}
            </p>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              {pipeline.defaultBranch} / {pipeline.pipelineFilePath}
            </p>
          </div>
          <div className="flex gap-2">
            {permission.has("pipeline:read") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSpecOpen(true)}
              >
                <FileCode2 className="size-3.5" />
                Definition
              </Button>
            )}
            {permission.has("pipeline:trigger") && (
              <Button
                size="sm"
                disabled={pipeline.isEnabled === 0}
                onClick={() => setRunOpen(true)}
              >
                <Play className="size-3.5" />
                Run pipeline
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <h3 className="text-sm font-semibold">Run history</h3>
          <select
            aria-label="Filter runs by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">All statuses</option>
            {[
              "pending",
              "running",
              "success",
              "failed",
              "cancelled",
              "paused",
            ].map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {runs.error && (
          <InlineErrorState
            title="Run history unavailable"
            description={runs.error.message}
            onRetry={runs.refresh}
            minHeight={180}
          />
        )}
        {!runs.data && runs.loading && (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            Loading runs…
          </p>
        )}
        {runs.data?.list.length === 0 && (
          <p className="border-t p-5 text-sm text-muted-foreground">
            {status
              ? "No runs with this status."
              : "No runs yet. Start a run to see execution state and logs here."}
          </p>
        )}
        {runs.data?.list.map((run) => (
          <button
            type="button"
            key={run.runId}
            aria-pressed={run.runId === selectedRunId}
            onClick={() => selectRun(run.runId)}
            className={`flex w-full flex-wrap items-center gap-3 border-t px-5 py-3 text-left hover:bg-muted ${run.runId === selectedRunId ? "bg-muted/60" : ""}`}
          >
            <RunStatusBadge status={run.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs">{run.runId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRunTime(run.startTime)}
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {formatDuration(run.duration)}
            </span>
          </button>
        ))}
        {runs.data && runs.data.total > 20 && (
          <Pagination
            page={page}
            total={runs.data.total}
            pageSize={20}
            onPage={setPage}
            loading={runs.loading}
          />
        )}
      </Panel>
      {selectedRunId && (
        <RunDetail
          key={selectedRunId}
          pipelineId={pipeline.pipelineId}
          runId={selectedRunId}
          projectId={pipeline.projectId}
          onChanged={() => {
            runs.refresh();
            onChanged();
          }}
        />
      )}
      {runOpen && (
        <RunPipelineDialog
          pipeline={pipeline}
          onClose={() => setRunOpen(false)}
          onStarted={(id) => {
            setRunOpen(false);
            setStatus("");
            setPage(1);
            selectRun(id);
            runs.refresh();
            onChanged();
          }}
        />
      )}
      {specOpen && (
        <PipelineSpecDialog
          pipeline={pipeline}
          readOnly={!permission.has("pipeline:update")}
          onClose={() => setSpecOpen(false)}
        />
      )}
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  loading,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
      <Button
        size="sm"
        variant="ghost"
        disabled={page <= 1 || loading}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={page * pageSize >= total || loading}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
