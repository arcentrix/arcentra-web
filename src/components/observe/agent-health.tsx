import { Link } from "react-router-dom";
import { Apis } from "@/api";
import { AgentStatusMap } from "@/api/agent/types";
import { listAgentHealth } from "@/api/observe";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  Panel,
  PanelHeader,
  StatusBadge,
  ColumnHead,
} from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { heartbeatTime, summarizeAgents } from "./health";
import { SnapshotError, SnapshotPages } from "./shared";

export function AgentHealth({
  page,
  revision,
  onPage,
}: {
  page: number;
  revision: number;
  onPage: (page: number) => void;
}) {
  // Platform agent grants are independent of the Observe menu and pipeline grants.
  const permission = useApiResource(
    `observe:agent-permission:${revision}`,
    (signal) => Apis.me.getEffectiveActions({ scopeType: "platform" }, signal),
  );
  const allowed =
    !permission.loading &&
    !permission.error &&
    !!permission.data?.some(
      (action) => action === "agent:read" || action === "*:*",
    );
  const resource = useApiResource(
    allowed ? `observe:agents:${page}:${revision}` : null,
    (signal) => listAgentHealth(page, signal),
  );
  const snapshot =
    resource.error || resource.loading ? undefined : resource.data;
  const summary = snapshot ? summarizeAgents(snapshot.agents) : undefined;
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title="Agent health"
        sub="Platform execution agents · server-reported snapshot"
      />
      {permission.error ? (
        <SnapshotError
          subject="Agent permission check"
          permission="platform agent:read"
          error={permission.error}
          retry={permission.refresh}
          loading={permission.loading}
        />
      ) : permission.loading ? (
        <p role="status" className="p-5 text-sm text-fg-muted">
          Checking agent access…
        </p>
      ) : !allowed ? (
        <div className="space-y-3 p-5 text-sm text-fg-muted">
          <p>
            Agent health requires platform agent:read permission. Pipeline
            access does not grant fleet access.
          </p>
          <Button variant="outline" size="sm" onClick={permission.refresh}>
            Check agent access again
          </Button>
        </div>
      ) : resource.error ? (
        <SnapshotError
          subject="Agent health"
          permission="platform agent:read"
          error={resource.error}
          retry={() => {
            permission.refresh();
            resource.refresh();
          }}
          loading={resource.loading}
        />
      ) : (
        <>
          {resource.loading && (
            <p role="status" className="p-5 text-sm text-fg-muted">
              {snapshot ? "Refreshing agents…" : "Loading agents…"}
            </p>
          )}
          {snapshot && summary && (
            <>
              <div className="space-y-2 border-b px-5 py-4 text-xs text-fg-muted">
                <p>
                  {snapshot.count} registered agents · {snapshot.agents.length}{" "}
                  loaded on this page
                </p>
                <p>
                  {summary.available} available · {summary.busy} busy ·{" "}
                  {summary.offline} offline · {summary.disabled} disabled on
                  this page
                </p>
                <p>
                  Available means enabled and online or idle. Heartbeat
                  timestamps are reported by the server; scheduling also depends
                  on pipeline selectors.
                </p>
              </div>
              {snapshot.agents.length === 0 ? (
                <p className="p-8 text-sm text-fg-muted">
                  {page > 1
                    ? "No agents on this page."
                    : "No registered agents yet."}
                </p>
              ) : (
                <Table aria-label="Agent health">
                  <TableHeader>
                    <TableRow>
                      {[
                        "Agent",
                        "Status",
                        "Scheduling",
                        "Last heartbeat",
                        "Platform",
                        "Version",
                      ].map((label) => (
                        <TableHead key={label}>
                          <ColumnHead>{label}</ColumnHead>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.agents.map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell>
                          <Link
                            to={`/agents/${encodeURIComponent(agent.agentId)}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {agent.agentName || agent.agentId}
                          </Link>
                          <p className="mt-1 font-mono text-xs text-fg-subtle">
                            {agent.agentId}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            icon={null}
                            tone={
                              agent.status === 3
                                ? "running"
                                : [1, 4].includes(agent.status)
                                  ? "ok"
                                  : agent.status === 2
                                    ? "fail"
                                    : "muted"
                            }
                          >
                            {AgentStatusMap[agent.status] ?? "unknown"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs text-fg-muted">
                          {agent.isEnabled === 1
                            ? "Enabled"
                            : agent.isEnabled === 0
                              ? "Disabled"
                              : "Unknown"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-fg-muted">
                          {heartbeatTime(agent.lastHeartbeat)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-fg-muted">
                          {agent.os || "—"} / {agent.arch || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-fg-muted">
                          {agent.version || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <SnapshotPages
                name="Agent"
                page={page}
                total={snapshot.count}
                loading={resource.loading}
                onPage={onPage}
              />
            </>
          )}
        </>
      )}
    </Panel>
  );
}
