import { useParams } from "react-router-dom";
import { PipelineWorkspace } from "@/components/build/pipeline-workspace";
export default function PipelineDetail() {
  const { projectId, id } = useParams();
  return (
    <PipelineWorkspace
      key={`${projectId}:${id}`}
      projectId={projectId}
      pipelineId={id}
    />
  );
}
