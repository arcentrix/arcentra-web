import { Link, useSearchParams } from "react-router-dom";
import { listProjects } from "@/api/project";
import { DeploymentConsole } from "@/components/deployment-console";
import { PageHeader } from "@/components/page-header";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";

export default function Deploy() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId") ?? "";
  const projects = useApiResource("deploy:projects", (signal) =>
    listProjects({ pageSize: 100 }, signal),
  );
  const items =
    projects.error || projects.loading ? [] : (projects.data?.list ?? []);
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="deploy / kubernetes"
        title="Deploy"
        sub="Prepare an image release from a successful pipeline run, then explicitly execute and observe it."
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link className="underline" to="/build">
          Open Build
        </Link>
        <Link className="underline" to="/agents">
          View Agents
        </Link>
      </div>
      <label className="grid max-w-md gap-2 text-sm">
        Project
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={projectId}
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value) next.set("projectId", event.target.value);
            else next.delete("projectId");
            setParams(next);
          }}
          disabled={projects.loading}
        >
          <option value="">Select a project</option>
          {projectId && !items.some((item) => item.projectId === projectId) && (
            <option value={projectId}>{projectId}</option>
          )}
          {items.map((item) => (
            <option key={item.projectId} value={item.projectId}>
              {item.displayName || item.name}
            </option>
          ))}
        </select>
      </label>
      {projects.error && (
        <div role="alert">
          Projects could not be loaded.{" "}
          <Button size="sm" variant="outline" onClick={projects.refresh}>
            Retry projects
          </Button>
        </div>
      )}
      {!projects.loading &&
        !projects.error &&
        (projects.data?.total ?? 0) > 100 && (
          <p className="text-sm text-muted-foreground">
            Showing the first 100 projects. Open a project's Deployments tab for
            other projects.
          </p>
        )}
      {projectId ? (
        <DeploymentConsole key={projectId} projectId={projectId} />
      ) : (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">
          Select a project to load its real environments and release history.
          Cluster access remains disabled until an operator configures an exact
          target.
        </p>
      )}
    </section>
  );
}
