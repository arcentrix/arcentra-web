import { Link, useOutletContext } from "react-router-dom";
import type { Project } from "@/api/project";
import { listPipelines } from "@/api/pipeline";
import { useApiResource } from "@/hooks/use-api-resource";
import { Panel, PanelHeader } from "@/components/blueprint";
import { InlineErrorState } from "@/components/inline-error-state";
import { AgentReadiness } from "@/components/build/agent-readiness";
export default function ProjectOverview() {
  const project = useOutletContext<Project>();
  const pipelines = useApiResource(
    `project-overview:${project.projectId}`,
    (signal) => listPipelines({ projectId: project.projectId }, signal),
  );
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader
          title="Pipeline definitions"
          sub="Repository-backed builds for this project"
        />
        <div className="border-t">
          {pipelines.error ? (
            <InlineErrorState
              description={pipelines.error.message}
              onRetry={pipelines.refresh}
              minHeight={200}
            />
          ) : !pipelines.data ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              Loading pipelines…
            </p>
          ) : pipelines.data.list.length ? (
            pipelines.data.list.map((pipeline) => (
              <Link
                key={pipeline.pipelineId}
                to={`/projects/${encodeURIComponent(project.projectId)}/pipelines/${encodeURIComponent(pipeline.pipelineId)}`}
                className="flex items-center gap-4 border-b p-5 last:border-0 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{pipeline.name}</h3>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {pipeline.defaultBranch} / {pipeline.pipelineFilePath}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {pipeline.totalRuns} runs
                </span>
              </Link>
            ))
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No pipelines connected.{" "}
              <Link
                className="underline"
                to={`/projects/${encodeURIComponent(project.projectId)}/pipelines`}
              >
                Add a pipeline
              </Link>{" "}
              to start building.
            </p>
          )}
        </div>
        {pipelines.data &&
          pipelines.data.total > pipelines.data.list.length && (
            <Link
              className="block border-t p-4 text-sm underline"
              to={`/projects/${encodeURIComponent(project.projectId)}/pipelines`}
            >
              View all {pipelines.data.total} pipelines
            </Link>
          )}
      </Panel>
      <AgentReadiness />
    </div>
  );
}
