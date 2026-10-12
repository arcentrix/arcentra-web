import { useParams } from "react-router-dom";
import { DeploymentConsole } from "@/components/deployment-console";
import { PageHeader } from "@/components/page-header";

export default function Environments() {
  const { projectId } = useParams();
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="project / targets"
        title="Environments"
        sub="Exact Kubernetes target bindings. An operator controls cluster access."
      />
      {projectId ? (
        <DeploymentConsole
          key={projectId}
          projectId={projectId}
          mode="environments"
        />
      ) : (
        <p>Choose a project to view environments.</p>
      )}
    </section>
  );
}
