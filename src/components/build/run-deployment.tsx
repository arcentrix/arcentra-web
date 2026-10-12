import { useState } from "react";
import { Link } from "react-router-dom";
import { getRelease } from "@/api/deploy";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";

export function RunDeployment({
  projectId,
  pipelineId,
  runId,
  releaseId,
}: {
  projectId: string;
  pipelineId: string;
  runId: string;
  releaseId: string;
}) {
  const [settled, setSettled] = useState(false);
  const resource = useApiResource(
    `run-release:${projectId}:${pipelineId}:${runId}:${releaseId}`,
    async (signal) => {
      const release = await getRelease(projectId, releaseId, signal);
      if (release.pipelineId !== pipelineId || release.pipelineRunId !== runId)
        throw new Error("Release does not belong to this pipeline run.");
      if (!signal.aborted)
        setSettled(
          ["succeeded", "failed", "superseded", "cancelled"].includes(
            release.status,
          ),
        );
      return release;
    },
    settled ? 0 : 5000,
  );
  const release = resource.error ? undefined : resource.data;
  return (
    <div className="mt-3 space-y-2 rounded border p-3 text-xs">
      <p className="break-all">Kubernetes release: {releaseId}</p>
      {resource.error ? (
        <p role="alert">Release status unavailable: {resource.error.message}</p>
      ) : release ? (
        <>
          <p>Release status: {release.status}</p>
          {release.approvalId && (
            <p className="break-all">
              Durable approval: {release.approvalId}. Review its immutable
              evidence in Deployment approvals for this run.
            </p>
          )}
          {release.status === "queued" && release.approvalId && (
            <p>
              Waiting for an authorized controller and approved gate. Approval
              never restarts a stopped or interrupted run; refresh is read-only.
            </p>
          )}
          {release.reason && <p className="break-words">{release.reason}</p>}
          <p className="break-all font-mono">{release.image}</p>
          <p>Environment: {release.environmentId}</p>
          {release.status === "applying" && (
            <p>
              Apply is unresolved. This target remains reserved. An operator
              must inspect and explicitly recover this same release ID; do not
              start a duplicate release.
            </p>
          )}
        </>
      ) : (
        <p role="status">Loading release status…</p>
      )}
      <p className="text-muted-foreground">
        Pipeline cancellation or timeout does not roll back a Kubernetes change
        already applied. Release status is independent of the run status.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="underline underline-offset-2"
          to={`/projects/${encodeURIComponent(projectId)}/deployments?release=${encodeURIComponent(releaseId)}`}
        >
          Inspect release in Deployments
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={resource.loading}
          onClick={resource.refresh}
        >
          Refresh release
        </Button>
      </div>
    </div>
  );
}
