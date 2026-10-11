import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GitBranch, Play } from "lucide-react";
import { getProject } from "@/api/project";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { ProjectTabs } from "@/components/project-tabs";
import { SectionEyebrow } from "@/components/blueprint";
import { InlineErrorState } from "@/components/inline-error-state";
export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const project = useApiResource(
    projectId ? `project:${projectId}` : null,
    (signal) => getProject(projectId!, signal),
  );
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="size-3" />
          Projects
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <SectionEyebrow>project / workspace</SectionEyebrow>
            <h1 className="mt-2 text-3xl font-semibold">
              {project.data?.displayName || project.data?.name || "Project"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {project.data?.description ||
                "Manage repository pipelines and inspect build executions."}
            </p>
            {project.data && (
              <p className="mt-3 flex items-center gap-2 break-all font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3 shrink-0" />
                {project.data.repoUrl} · {project.data.defaultBranch}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/projects/${encodeURIComponent(projectId!)}/pipelines`)
            }
          >
            <Play className="size-3.5" />
            View pipelines
          </Button>
        </div>
      </div>
      {project.error ? (
        <InlineErrorState
          title="Project unavailable"
          description={project.error.message}
          onRetry={project.refresh}
        />
      ) : !project.data ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading project…
        </p>
      ) : (
        <>
          {projectId && (
            <ProjectTabs projectId={projectId} pathname={location.pathname} />
          )}
          <Outlet context={project.data} />
        </>
      )}
    </section>
  );
}
