import { DeployUnavailable } from "@/components/deploy-unavailable";
import { PageHeader } from "@/components/page-header";

export default function Deploy() {
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="deploy / integration status"
        title="Deploy"
        sub="Deployment environments and releases require a backend integration."
      />
      <DeployUnavailable />
    </section>
  );
}
