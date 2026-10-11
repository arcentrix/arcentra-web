import { Link } from "react-router-dom";
import { Server, RefreshCw } from "lucide-react";
import { listAgents } from "@/api/agent";
import { AgentStatusMap } from "@/api/agent/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { Panel, PanelHeader, StatusDot } from "@/components/blueprint";
import { Button } from "@/components/ui/button";

export function AgentReadiness() {
  const resource = useApiResource(
    "build-agents",
    () => listAgents({ pageNum: 1, pageSize: 100 }),
    15000,
  );
  const agents = resource.data?.agents ?? [];
  const available = agents.filter(
    (a) => a.isEnabled === 1 && (a.status === 1 || a.status === 4),
  );
  return (
    <Panel>
      <PanelHeader
        title="Agent fleet"
        sub={
          resource.data
            ? `${available.length} available in ${agents.length} loaded agents`
            : "Execution capacity"
        }
      />
      <div className="space-y-3 border-t p-4">
        {!resource.data && resource.loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking agents…
          </p>
        )}
        {resource.error && (
          <div role="alert" className="text-sm text-destructive">
            Agent status unavailable: {resource.error.message}
            <Button size="sm" variant="ghost" onClick={resource.refresh}>
              <RefreshCw className="size-3" /> Retry
            </Button>
          </div>
        )}
        {resource.data && !resource.error && (
          <>
            <p className="text-xs text-muted-foreground">
              {available.length
                ? "Jobs use the selectors in your pipeline definition. An available agent must match those labels."
                : "No available agents in this list. Jobs fail if no enabled agent matches their selectors at dispatch. Connect a matching agent before running."}
            </p>
            {agents.slice(0, 6).map((agent) => (
              <Link
                key={agent.agentId}
                to={`/agents/${encodeURIComponent(agent.agentId)}`}
                className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-muted"
              >
                <Server className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {agent.agentName || agent.agentId}
                  <span className="ml-2 font-mono text-muted-foreground">
                    {agent.os}/{agent.arch}
                  </span>
                </span>
                <StatusDot
                  tone={
                    agent.isEnabled === 0
                      ? "muted"
                      : agent.status === 3
                        ? "running"
                        : [1, 4].includes(agent.status)
                          ? "ok"
                          : "muted"
                  }
                />
                <span>
                  {agent.isEnabled === 0
                    ? "disabled"
                    : AgentStatusMap[agent.status]}
                </span>
              </Link>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
