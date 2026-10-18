import { repositoryAddress } from "@/lib/repository-address";
import { useCallback, useEffect, useState } from "react";
import authStore from "@/store/auth";
import userStore from "@/store/user";
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
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized)
    return (
      <p role="status" className="p-6">
        Sign in to view this project.
      </p>
    );
  return (
    <ProjectSnapshot
      key={JSON.stringify([auth.accessToken, user.userinfo?.userId, projectId])}
    />
  );
}
function ProjectSnapshot() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const project = useApiResource(
    projectId ? `project:${projectId}:${revision}` : null,
    (signal) => getProject(projectId!, signal),
  );
  const [readDenied, setReadDenied] = useState(false);
  const refreshProject = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === projectId) refreshProject();
    };
    const denied = (event: Event) => {
      if ((event as CustomEvent).detail === projectId) setReadDenied(true);
    };
    window.addEventListener("arcentra:project-updated", changed);
    window.addEventListener("arcentra:project-read-denied", denied);
    return () => {
      window.removeEventListener("arcentra:project-updated", changed);
      window.removeEventListener("arcentra:project-read-denied", denied);
    };
  }, [projectId, refreshProject]);
  const snapshot =
    !readDenied &&
    !project.loading &&
    !project.error &&
    project.data?.projectId === projectId
      ? project.data
      : undefined;
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
              {snapshot?.displayName || snapshot?.name || "Project"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {snapshot?.description ||
                "Manage repository pipelines and inspect build executions."}
            </p>
            {snapshot && (
              <p className="mt-3 flex items-center gap-2 break-all font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3 shrink-0" />
                {repositoryAddress(snapshot.repoUrl)} · {snapshot.defaultBranch}
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
      {readDenied ? (
        <InlineErrorState
          title="Project access restricted"
          description="Your project read access changed. Previously loaded details are hidden."
          onRetry={() => {
            setReadDenied(false);
            refreshProject();
          }}
        />
      ) : project.error ? (
        <InlineErrorState
          title="Project unavailable"
          description="The current project could not be loaded. Refresh to check access and try again."
          onRetry={refreshProject}
        />
      ) : !snapshot ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading project…
        </p>
      ) : (
        <>
          {projectId && (
            <ProjectTabs projectId={projectId} pathname={location.pathname} />
          )}
          <Outlet context={snapshot} />
        </>
      )}
    </section>
  );
}
