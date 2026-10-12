import { Link } from "react-router-dom";
import { Bot, Hammer, Package, Rocket } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/blueprint";
import { Button } from "@/components/ui/button";

interface DeployUnavailableProps {
  title?: string;
  projectId?: string;
}

/** Deployment data and actions stay unavailable until a real service is integrated. */
export function DeployUnavailable({
  title = "Deployment integration unavailable",
  projectId,
}: DeployUnavailableProps) {
  const projectPath = projectId
    ? `/projects/${encodeURIComponent(projectId)}`
    : undefined;

  return (
    <Panel>
      <PanelHeader
        title={<h3>{title}</h3>}
        action={<StatusBadge tone="muted">Not integrated</StatusBadge>}
      />
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-start gap-3">
          <Rocket
            className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted"
            aria-hidden
          />
          <div className="max-w-2xl space-y-2 text-[13px] text-fg-muted">
            <p>
              A deployment service is not integrated in this build. Environment
              health, rollout progress, and release history cannot be loaded.
            </p>
            <p>
              Release, rollback, promotion, and environment configuration are
              unavailable. Choose a deployment target and implement its backend
              integration before enabling these actions.
            </p>
          </div>
        </div>
        <div className="border-t pt-4">
          <h4 className="mb-3 text-sm font-medium">Continue with builds</h4>
          <nav
            aria-label="Available build tools"
            className="flex flex-wrap gap-2"
          >
            <Button asChild size="sm">
              <Link to={projectPath ? `${projectPath}/pipelines` : "/build"}>
                <Hammer aria-hidden />
                {projectPath ? "View project pipelines" : "Open Build"}
              </Link>
            </Button>
            {projectPath && (
              <Button asChild size="sm" variant="outline">
                <Link to={`${projectPath}/artifacts`}>
                  <Package aria-hidden />
                  View project artifacts
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/agents">
                <Bot aria-hidden />
                View Agents
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </Panel>
  );
}
