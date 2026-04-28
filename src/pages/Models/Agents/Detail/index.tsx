/**
 * Agents Detail 页面
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Zap, Edit, Power, PowerOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentDialog } from "@/components/agent-dialog";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";
import type { Agent, UpdateAgentRequest, AgentStatus } from "@/api/agent/types";

export default function AgentsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadingRef = useRef(false);
  const currentIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      navigate("/agents");
      return;
    }

    // 防止重复请求：如果正在加载或 ID 没有变化，则跳过
    if (loadingRef.current || currentIdRef.current === id) {
      return;
    }

    loadingRef.current = true;
    currentIdRef.current = id;
    setLoading(true);

    Apis.agent
      .getAgentById(id)
      .then((data) => {
        // 确保 ID 仍然匹配（防止快速切换路由导致的状态混乱）
        if (currentIdRef.current === id) {
          setAgent(data);
        }
      })
      .catch((error: any) => {
        // 确保 ID 仍然匹配
        if (currentIdRef.current === id) {
          // 如果是 404 错误，显示更友好的消息
          if (
            error?.response?.status === 404 ||
            error?.message?.includes("not found")
          ) {
            toast.error("Agent not found");
          } else {
            toast.error("Failed to load agent");
          }
          console.error("Load failed:", error);
          navigate("/agents");
        }
      })
      .finally(() => {
        // 确保 ID 仍然匹配
        if (currentIdRef.current === id) {
          setLoading(false);
          loadingRef.current = false;
        }
      });

    // 清理函数：当 ID 变化时，取消之前的请求
    return () => {
      if (currentIdRef.current !== id) {
        loadingRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleEdit = () => {
    setDialogOpen(true);
  };

  const reloadAgent = async () => {
    if (!id) return;

    // 重置 ref 以允许重新加载
    currentIdRef.current = undefined;
    loadingRef.current = false;

    // 触发重新加载
    currentIdRef.current = id;
    loadingRef.current = true;
    setLoading(true);

    try {
      const data = await Apis.agent.getAgentById(id);
      if (currentIdRef.current === id) {
        setAgent(data);
      }
    } catch (error: any) {
      if (currentIdRef.current === id) {
        toast.error("Failed to reload agent");
        console.error("Reload failed:", error);
      }
    } finally {
      if (currentIdRef.current === id) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const handleSubmit = async (data: UpdateAgentRequest) => {
    if (!agent) return;

    try {
      await Apis.agent.updateAgent(agent.agentId, data);
      await reloadAgent();
    } catch (error: any) {
      throw error;
    }
  };

  const handleApprove = async () => {
    if (!agent) return;
    try {
      await Apis.agent.approveAgent(agent.agentId);
      toast.success("Agent approved");
      await reloadAgent();
    } catch (error) {
      toast.error("Failed to approve agent");
      console.error("Approve failed:", error);
    }
  };

  const handleToggleStatus = async () => {
    if (!agent) return;

    try {
      await Apis.agent.updateAgent(agent.agentId, {
        isEnabled: agent.isEnabled === 1 ? 0 : 1,
      });
      toast.success(agent.isEnabled === 1 ? "Agent disabled" : "Agent enabled");
      await reloadAgent();
    } catch (error) {
      toast.error("Failed to toggle agent status");
      console.error("Toggle failed:", error);
    }
  };

  // 获取状态 Badge
  const getStatusBadge = (status: AgentStatus) => {
    const statusMap = {
      0: {
        label: "Unknown",
        className: "bg-gray-100 text-gray-600 border-gray-200",
      },
      1: {
        label: "Online",
        className: "bg-green-50 text-green-600 border-green-200",
      },
      2: {
        label: "Offline",
        className: "bg-red-50 text-red-600 border-red-200",
      },
      3: {
        label: "Busy",
        className: "bg-yellow-50 text-yellow-600 border-yellow-200",
      },
      4: {
        label: "Idle",
        className: "bg-blue-50 text-blue-600 border-blue-200",
      },
    };

    const variant = statusMap[status] || statusMap[0];

    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const parseNumericLabel = (keys: string[]) => {
    const source = agent?.labels || {};
    for (const key of keys) {
      const value = source[key];
      if (!value) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const runningJobs =
    parseNumericLabel(["running_jobs", "current_jobs", "jobs"]) ??
    (agent?.status === 3 ? 1 : 0);
  const capacity =
    agent?.isEnabled === 1
      ? parseNumericLabel(["capacity", "max_jobs", "slots"]) || 4
      : 0;
  const heartbeatAge = parseNumericLabel([
    "heartbeat_age_seconds",
    "heartbeatAgeSeconds",
  ]);

  const lastHeartbeatText = (() => {
    const source = agent?.labels || {};
    const explicit =
      source.last_seen ||
      source.lastSeen ||
      source.last_heartbeat ||
      source.heartbeat;
    if (explicit) return explicit;
    if (heartbeatAge !== null) {
      if (heartbeatAge < 60) return `${heartbeatAge}s ago`;
      if (heartbeatAge < 3600) return `${Math.floor(heartbeatAge / 60)}m ago`;
      return `${Math.floor(heartbeatAge / 3600)}h ago`;
    }
    if (agent?.status === 0) return "Never";
    if (agent?.status === 2) return "Stale";
    return "Recent";
  })();

  const currentTaskNames = (() => {
    const source = agent?.labels || {};
    const raw =
      source.current_tasks ||
      source.current_task ||
      source.running_tasks ||
      source.running_task ||
      source.job_names ||
      "";

    if (!raw) return [];
    return raw
      .split(",")
      .map((task) => task.trim())
      .filter(Boolean);
  })();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-6">
        <p className="text-muted-foreground">Loading agent...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-6">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              {agent.agentName}
            </h2>
            <p className="text-muted-foreground mt-1">
              Agent ID:{" "}
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {agent.agentId}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {agent.registeredBy === "dynamic" && agent.isEnabled === 0 && (
              <Button variant="outline" onClick={handleApprove}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            <Button variant="outline" onClick={handleToggleStatus}>
              {agent.isEnabled === 1 ? (
                <>
                  <PowerOff className="mr-2 h-4 w-4" />
                  Disable
                </>
              ) : (
                <>
                  <Power className="mr-2 h-4 w-4" />
                  Enable
                </>
              )}
            </Button>
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>{getStatusBadge(agent.status)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled</CardTitle>
              {agent.isEnabled === 1 ? (
                <Power className="h-4 w-4 text-green-500" />
              ) : (
                <PowerOff className="h-4 w-4 text-gray-500" />
              )}
            </CardHeader>
            <CardContent>
              {agent.isEnabled === 1 ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-600 border-emerald-200"
                >
                  Enabled
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-gray-100 text-gray-500 border-gray-200"
                >
                  Disabled
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Version</CardTitle>
              <Zap className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agent.version || "N/A"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform</CardTitle>
              <Zap className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div className="font-medium">{agent.os}</div>
                <div className="text-muted-foreground">{agent.arch}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="running-tasks">Running Tasks</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Information</CardTitle>
                <CardDescription>
                  Basic information about this agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Agent Name</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.agentName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Agent ID</p>
                    <p className="text-sm text-muted-foreground">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {agent.agentId}
                      </code>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.address && agent.port
                        ? `${agent.address}:${agent.port}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <div className="mt-1">{getStatusBadge(agent.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Operating System</p>
                    <p className="text-sm text-muted-foreground">{agent.os}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Architecture</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.arch}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Version</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.version || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Metrics Path</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.metrics}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Registered By</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.registeredBy || "Admin"}
                    </p>
                  </div>
                </div>
                {Object.keys(agent.labels || {}).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Labels</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(agent.labels || {}).map(
                        ([key, value]) => (
                          <Badge key={key} variant="outline">
                            {key}: {value}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="running-tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Running Tasks</CardTitle>
                <CardDescription>
                  Runtime workload currently executed by this agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Jobs</p>
                    <p className="text-sm font-medium">
                      {capacity > 0 ? `${runningJobs} / ${capacity}` : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      Last Heartbeat
                    </p>
                    <p className="text-sm font-medium">{lastHeartbeatText}</p>
                  </div>
                </div>

                {currentTaskNames.length > 0 ? (
                  <div className="space-y-2">
                    {currentTaskNames.map((taskName) => (
                      <div
                        key={taskName}
                        className="rounded-md border px-3 py-2 text-sm"
                      >
                        {taskName}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {runningJobs > 0
                      ? "Agent is busy, but task names are not reported by runtime metadata."
                      : "No running tasks."}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="configuration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Agent configuration settings</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                  <code>{JSON.stringify(agent, null, 2)}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AgentDialog
        key={agent.agentId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={agent}
        onSubmit={handleSubmit}
      />
    </>
  );
}
