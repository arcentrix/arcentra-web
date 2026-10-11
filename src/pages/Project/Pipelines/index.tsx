import { useParams } from "react-router-dom";
import { PipelineWorkspace } from "@/components/build/pipeline-workspace";
export default function Pipelines() {
  const { projectId } = useParams();
  return <PipelineWorkspace key={projectId} projectId={projectId} />;
}
