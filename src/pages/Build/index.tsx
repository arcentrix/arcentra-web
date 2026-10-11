import { PageHeader } from "@/components/page-header";
import { PipelineWorkspace } from "@/components/build/pipeline-workspace";
export default function Build() {
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="build / pipelines"
        title="Build"
        sub="Run repository pipelines, inspect agent execution, and follow live build output."
      />
      <PipelineWorkspace />
    </section>
  );
}
