import { useParams } from "react-router-dom";
import { DeployUnavailable } from "@/components/deploy-unavailable";

export default function Deployments() {
  const { projectId } = useParams();
  return (
    <DeployUnavailable title="Deployments unavailable" projectId={projectId} />
  );
}
