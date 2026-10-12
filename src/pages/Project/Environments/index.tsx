import { useParams } from "react-router-dom";
import { DeployUnavailable } from "@/components/deploy-unavailable";

export default function Environments() {
  const { projectId } = useParams();
  return (
    <DeployUnavailable title="Environments unavailable" projectId={projectId} />
  );
}
