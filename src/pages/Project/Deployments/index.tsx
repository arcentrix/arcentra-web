import { useParams, useSearchParams } from "react-router-dom";
import { DeploymentConsole } from "@/components/deployment-console";
import { PageHeader } from "@/components/page-header";

export default function Deployments() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const releaseId = params.get("release") || undefined;
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="project / releases"
        title="Deployments"
        sub="Immutable pipeline artifacts, explicit Kubernetes execution, and observed rollout results."
      />
      {projectId ? (
        <DeploymentConsole
          key={`${projectId}:${releaseId ?? ""}`}
          projectId={projectId}
          releaseId={releaseId}
          mode="releases"
        />
      ) : (
        <p>Choose a project to view deployments.</p>
      )}
    </section>
  );
}
