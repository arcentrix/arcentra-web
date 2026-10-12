import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download, RefreshCw } from "lucide-react";
import {
  artifactStatuses,
  downloadProjectArtifact,
  listProjectArtifacts,
  saveArtifactDownload,
  type ArtifactStatus,
  type ProjectArtifact,
} from "@/api/artifact";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineErrorState } from "@/components/inline-error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Panel,
  PanelHeader,
  StatusBadge,
  ColumnHead,
} from "@/components/blueprint";

const pageSize = 20;

function formatSize(artifact: ProjectArtifact): string {
  if (
    artifact.sizeKnown === false ||
    !Number.isFinite(artifact.size) ||
    artifact.size < 0
  )
    return "Unknown";
  if (artifact.size < 1024) return `${artifact.size} B`;
  const unit = Math.min(
    Math.floor(Math.log(artifact.size) / Math.log(1024)),
    4,
  );
  return `${(artifact.size / 1024 ** unit).toFixed(1)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function ArtifactFilters({
  name,
  runId,
  onApply,
}: {
  name: string;
  runId: string;
  onApply: (name: string, runId: string) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftRun, setDraftRun] = useState(runId);
  return (
    <form
      className="flex min-w-0 flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draftName.trim(), draftRun.trim());
      }}
    >
      <Input
        aria-label="Artifact name"
        placeholder="Search artifact names…"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        className="h-8 w-full text-[13px] sm:w-56"
      />
      <Input
        aria-label="Run ID"
        placeholder="Filter by exact run ID…"
        value={draftRun}
        onChange={(event) => setDraftRun(event.target.value)}
        className="h-8 w-full text-[13px] sm:w-52"
      />
      <Button variant="outline" size="sm" type="submit" className="h-8">
        Apply filters
      </Button>
    </form>
  );
}

function ArtifactWorkspace({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const name = params.get("name") ?? "";
  const runId = params.get("runId") ?? "";
  const requestedStatus = params.get("status");
  const status = artifactStatuses.find((value) => value === requestedStatus);
  const requestedPage = Number(params.get("page") ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const queryKey = JSON.stringify([projectId, page, name, runId, status]);
  const artifacts = useApiResource(
    // The server filters by each pipeline's grants. Project-wide effective
    // actions cannot represent a user's pipeline-only access.
    `artifacts:${queryKey}`,
    (signal) =>
      listProjectArtifacts(
        projectId,
        {
          page,
          pageSize,
          name: name || undefined,
          runId: runId || undefined,
          status,
        },
        signal,
      ),
  );
  const updateQuery = (values: Record<string, string | undefined>) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };
  const downloadScope = queryKey;
  const latestScope = useRef(downloadScope);
  latestScope.current = downloadScope;
  const operation = useRef<{
    controller: AbortController;
    scope: string;
  } | null>(null);
  const [download, setDownload] = useState<{
    scope: string;
    artifactId?: string;
    error?: string;
    message?: string;
  }>();
  useEffect(
    () => () => {
      operation.current?.controller.abort();
      operation.current = null;
    },
    [downloadScope],
  );
  const currentDownload =
    download?.scope === downloadScope ? download : undefined;
  const startDownload = async (artifact: ProjectArtifact) => {
    if (
      artifacts.loading ||
      artifacts.error ||
      !artifact.downloadAvailable ||
      artifact.status !== "available" ||
      operation.current
    )
      return;
    const request = { controller: new AbortController(), scope: downloadScope };
    operation.current = request;
    setDownload({ scope: downloadScope, artifactId: artifact.artifactId });
    try {
      const file = await downloadProjectArtifact(
        projectId,
        artifact.artifactId,
        artifact.name,
        request.controller.signal,
      );
      if (
        request.controller.signal.aborted ||
        operation.current !== request ||
        request.scope !== latestScope.current
      )
        return;
      saveArtifactDownload(file);
      setDownload({
        scope: downloadScope,
        message: `Download started for ${file.filename}.`,
      });
    } catch (error) {
      if (
        request.controller.signal.aborted ||
        operation.current !== request ||
        request.scope !== latestScope.current
      )
        return;
      setDownload({
        scope: downloadScope,
        error:
          error instanceof Error
            ? error.message
            : "Download failed. Try again.",
      });
    } finally {
      if (operation.current === request) operation.current = null;
    }
  };

  const filtered = !!(name || runId || status);
  const total = artifacts.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const accessDenied =
    isApiError(artifacts.error) && artifacts.error.status === 403;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ArtifactFilters
          key={JSON.stringify([name, runId])}
          name={name}
          runId={runId}
          onApply={(nextName, nextRun) =>
            updateQuery({ name: nextName, runId: nextRun, page: undefined })
          }
        />
        <select
          aria-label="Artifact status"
          value={status ?? "all"}
          onChange={(event) =>
            updateQuery({
              status:
                event.target.value === "all"
                  ? undefined
                  : (event.target.value as ArtifactStatus),
              page: undefined,
            })
          }
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="expired">Expired</option>
          <option value="unavailable">Unavailable</option>
        </select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() =>
              updateQuery({
                name: undefined,
                runId: undefined,
                status: undefined,
                page: undefined,
              })
            }
          >
            Clear filters
          </Button>
        )}
        <Button
          aria-label="Refresh artifacts"
          variant="outline"
          size="sm"
          className="ml-auto h-8 gap-1.5"
          disabled={artifacts.loading}
          onClick={artifacts.refresh}
        >
          <RefreshCw
            aria-hidden
            className={`h-3.5 w-3.5 ${artifacts.loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {currentDownload?.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          Download failed: {currentDownload.error}
        </p>
      )}
      {currentDownload?.message && (
        <p role="status" className="text-sm text-fg-muted">
          {currentDownload.message}
        </p>
      )}
      <Panel className="min-w-0">
        <PanelHeader
          title="Artifacts"
          sub={
            artifacts.error
              ? "Could not refresh artifacts"
              : artifacts.data
                ? `${total} ${filtered ? "matching" : "total"} artifacts`
                : "Stored run outputs"
          }
        />
        {artifacts.error ? (
          <InlineErrorState
            title={
              accessDenied
                ? "Artifact access restricted"
                : "Artifacts unavailable"
            }
            description={artifacts.error.message}
            requestId={
              isApiError(artifacts.error)
                ? artifacts.error.requestId
                : undefined
            }
            onRetry={artifacts.refresh}
            retryLabel={accessDenied ? "Check access again" : "Retry"}
            retrying={artifacts.loading}
          />
        ) : (
          <>
            {artifacts.loading && (
              <p role="status" className="px-5 py-3 text-sm text-fg-muted">
                {artifacts.data
                  ? "Refreshing artifacts…"
                  : "Loading artifacts…"}
              </p>
            )}
            {artifacts.data?.list.length === 0 && (
              <div className="space-y-3 px-5 py-12 text-center text-[13px] text-fg-muted">
                <p>
                  {page > 1
                    ? "No artifacts on this page."
                    : filtered
                      ? "No artifacts match your filters."
                      : "No artifacts yet. Artifacts uploaded by pipeline runs will appear here."}
                </p>
                {page > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuery({ page: undefined })}
                  >
                    Back to first page
                  </Button>
                )}
              </div>
            )}
            {!!artifacts.data?.list.length && (
              <Table aria-label="Project artifacts">
                <TableHeader>
                  <TableRow>
                    {[
                      "Name",
                      "Run",
                      "Size",
                      "Storage",
                      "Status",
                      "Created",
                      "Download",
                    ].map((label) => (
                      <TableHead key={label}>
                        <ColumnHead>{label}</ColumnHead>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artifacts.data.list.map((artifact) => (
                    <TableRow key={artifact.artifactId}>
                      <TableCell className="max-w-64 break-words font-mono text-[12.5px] font-medium">
                        {artifact.name}
                      </TableCell>
                      <TableCell className="max-w-48 break-all font-mono text-xs">
                        {artifact.pipelineId && artifact.pipelineRunId ? (
                          <Link
                            className="text-primary underline underline-offset-2"
                            to={`/projects/${encodeURIComponent(projectId)}/pipelines/${encodeURIComponent(artifact.pipelineId)}?run=${encodeURIComponent(artifact.pipelineRunId)}`}
                          >
                            {artifact.pipelineRunId}
                          </Link>
                        ) : (
                          artifact.pipelineRunId || "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-fg-muted">
                        {formatSize(artifact)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-fg-muted">
                        {artifact.storageType || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            artifact.status === "available"
                              ? "ok"
                              : artifact.status === "expired"
                                ? "fail"
                                : "muted"
                          }
                        >
                          {artifact.status}
                        </StatusBadge>
                        {(artifact.unavailableReason || artifact.expiresAt) && (
                          <p className="mt-1 max-w-56 text-xs text-fg-muted">
                            {artifact.unavailableReason ||
                              `Expires ${formatDate(artifact.expiresAt)}`}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[11px] text-fg-subtle">
                        {formatDate(artifact.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          aria-label={`Download ${artifact.name}`}
                          disabled={
                            !artifact.downloadAvailable ||
                            artifact.status !== "available" ||
                            !!currentDownload?.artifactId ||
                            artifacts.loading
                          }
                          onClick={() => void startDownload(artifact)}
                        >
                          {currentDownload?.artifactId ===
                          artifact.artifactId ? (
                            <RefreshCw
                              aria-hidden
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <Download aria-hidden className="size-3.5" />
                          )}
                          {currentDownload?.artifactId === artifact.artifactId
                            ? "Downloading…"
                            : "Download"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {artifacts.data && (totalPages > 1 || page > 1) && (
              <nav
                aria-label="Artifact pages"
                className="flex items-center justify-between gap-2 border-t p-3 text-xs text-fg-muted"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1 || artifacts.loading}
                  onClick={() =>
                    updateQuery({
                      page: page > 2 ? String(page - 1) : undefined,
                    })
                  }
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages || artifacts.loading}
                  onClick={() => updateQuery({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

export default function Artifacts() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId)
    return <p role="alert">Select a project to view artifacts.</p>;
  return <ArtifactWorkspace key={projectId} projectId={projectId} />;
}
