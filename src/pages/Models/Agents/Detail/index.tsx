/**
 * Agents Detail 页面 — Engineering Blueprint 重做
 *
 * 视觉层完全按设计系统规范重写；数据层（Apis.*、useParams、state、effect）全部保留。
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Edit,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentDialog } from "@/components/agent-dialog";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";
import type { Agent, UpdateAgentRequest, AgentStatus } from "@/api/agent/types";
import { PageHeader } from "@/components/page-header";
import {
  Panel,
  PanelHeader,
  MetaRow,
  SectionEyebrow,
  StatusDot,
} from "@/components/blueprint";
import type { DotTone } from "@/components/blueprint";

/* ─────────────────────── 常量 ─────────────────────── */

const STATUS_DOT_TONE: Record<AgentStatus, DotTone> = {
  0: "muted",
  1: "ok",
  2: "fail",
  3: "running",
  4: "info",
};

const STATUS_BADGE: Record<
  AgentStatus,
  {
    label: string;
    variant: "success" | "warning" | "critical" | "outline" | "info" | "secondary";
  }
> = {
  0: { label: "Unknown", variant: "outline" },
  1: { label: "Online", variant: "success" },
  2: { label: "Offline", variant: "critical" },
  3: { label: "Busy", variant: "info" },
  4: { label: "Idle", variant: "secondary" },
};

/* ─────────────────────── 数据工具函数（从 Overview 复用）─────────────────────── */

const parseNumericLabelFrom = (
  labels: Record<string, string> | undefined,
  keys: string[],
): number | null => {
  const source = labels || {};
  for (const key of keys) {
    const value = source[key];
    if (!value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

/* ─────────────────────── 主组件 ─────────────────────── */

export default function AgentsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadingRef = useRef(false);
  const currentIdRef = useRef<string | undefined>(undefined);

  /* ── 数据加载（原有逻辑，保留不变）── */

  useEffect(() => {
    if (!id) {
      navigate("/agents");
      return;
    }

    if (loadingRef.current || currentIdRef.current === id) return;

    loadingRef.current = true;
    currentIdRef.current = id;
    setLoading(true);

    Apis.agent
      .getAgentById(id)
      .then((data) => {
        if (currentIdRef.current === id) setAgent(data);
      })
      .catch((error: any) => {
        if (currentIdRef.current === id) {
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
        if (currentIdRef.current === id) {
          setLoading(false);
          loadingRef.current = false;
        }
      });

    return () => {
      if (currentIdRef.current !== id) loadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── 事件处理（原有，保留不变）── */

  const reloadAgent = async () => {
    if (!id) return;
    currentIdRef.current = undefined;
    loadingRef.current = false;
    currentIdRef.current = id;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await Apis.agent.getAgentById(id);
      if (currentIdRef.current === id) setAgent(data);
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

  /* ── 派生数据（原有，保留不变）── */

  const parseNumericLabel = (keys: string[]) =>
    parseNumericLabelFrom(agent?.labels, keys);

  const runningJobs =
    parseNumericLabel(["running_jobs", "current_jobs", "jobs"]) ??
    (agent?.status === 3 ? 1 : 0);
  const capacity =
    agent?.isEnabled === 1
      ? parseNumericLabel(["capacity", "max_jobs", "slots"]) || 4
      : 0;
  const heartbeatAge = parseNumericLabel(["heartbeat_age_seconds", "heartbeatAgeSeconds"]);

  const lastHeartbeatText = (() => {
    const source = agent?.labels || {};
    const explicit =
      source.last_seen || source.lastSeen || source.last_heartbeat || source.heartbeat;
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
    return raw.split(",").map((t: string) => t.trim()).filter(Boolean);
  })();

  /* ── 加载 / 空态 ── */

  if (loading) {
    return (
      <section className="flex flex-1 flex-col gap-6 p-8">
        {/* 面包屑骨架 */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <ChevronRight className="h-3 w-3 text-fg-subtle" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Panel key={i} className="flex flex-col gap-2 px-5 py-[18px]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </Panel>
          ))}
        </div>
      </section>
    );
  }

  if (!agent) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-[13px] text-fg-muted">Agent not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/agents")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to agents
        </Button>
      </section>
    );
  }

  const statusMeta = STATUS_BADGE[agent.status] ?? STATUS_BADGE[0];
  const dotTone = STATUS_DOT_TONE[agent.status] ?? "muted";
  const isDynamicPending = agent.registeredBy === "dynamic" && agent.isEnabled === 0;
  const loadPct = capacity > 0 ? Math.round((runningJobs / capacity) * 100) : 0;

  /* ─────────────────────── JSX ─────────────────────── */

  return (
    <>
      <section className="flex flex-1 flex-col gap-6 p-8">

        {/* 面包屑 */}
        <nav className="flex items-center gap-1.5 font-mono text-[11px] text-fg-muted">
          <button
            type="button"
            className="hover:text-foreground transition-colors"
            onClick={() => navigate("/agents")}
          >
            Agents
          </button>
          <ChevronRight className="h-3 w-3 text-fg-subtle" />
          <span className="text-fg-subtle">{agent.agentName}</span>
        </nav>

        {/* 页头 */}
        <PageHeader
          eyebrow="agents / detail"
          title={agent.agentName}
          sub={`Agent ID · ${agent.agentId}`}
          action={
            <div className="flex items-center gap-2">
              {isDynamicPending && (
                <Button variant="outline" size="sm" onClick={handleApprove}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Approve
                </Button>
              )}
              <Switch
                checked={agent.isEnabled === 1}
                onCheckedChange={handleToggleStatus}
                aria-label={agent.isEnabled === 1 ? "Disable agent" : "Enable agent"}
              />
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          }
        />

        {/* 指标卡行 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 状态 */}
          <Panel className="flex flex-col gap-2 px-5 py-[18px]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
              Status
            </span>
            <div className="flex items-center gap-2">
              <StatusDot tone={dotTone} pulse={agent.status === 3} />
              <span className="reading font-mono text-[24px] font-semibold leading-none tabular-nums">
                {statusMeta.label}
              </span>
            </div>
            <Badge variant={statusMeta.variant} className="w-fit">
              {statusMeta.label}
            </Badge>
          </Panel>

          {/* 启用状态 */}
          <Panel className="flex flex-col gap-2 px-5 py-[18px]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
              Scheduling
            </span>
            <span className="reading font-mono text-[24px] font-semibold leading-none tabular-nums text-foreground">
              {agent.isEnabled === 1 ? "Enabled" : "Disabled"}
            </span>
            <Badge variant={agent.isEnabled === 1 ? "success" : "secondary"} className="w-fit">
              {agent.isEnabled === 1 ? "Eligible" : "Excluded"}
            </Badge>
          </Panel>

          {/* 版本 */}
          <Panel className="flex flex-col gap-2 px-5 py-[18px]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
              Version
            </span>
            <span className="reading font-mono text-[24px] font-semibold leading-none tabular-nums text-foreground">
              {agent.version || "—"}
            </span>
            <span className="text-[12px] text-fg-muted">Agent runtime version</span>
          </Panel>

          {/* 负载 */}
          <Panel className="flex flex-col gap-2 px-5 py-[18px]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
              Load
            </span>
            <span className="reading font-mono text-[24px] font-semibold leading-none tabular-nums text-foreground">
              {capacity > 0 ? `${loadPct}%` : "—"}
            </span>
            <span className="text-[12px] text-fg-muted">
              {capacity > 0 ? `${runningJobs} / ${capacity} slots` : "No capacity"}
            </span>
          </Panel>
        </div>

        {/* 详情 Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="font-mono">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="running-tasks">Running Tasks</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>

          {/* ── Tab: overview ── */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">

              {/* 基本信息 */}
              <Panel>
                <PanelHeader title="Agent information" />
                <div className="flex flex-col gap-3 p-5">
                  <MetaRow label="Name" value={agent.agentName} />
                  <MetaRow label="Agent ID" value={agent.agentId} />
                  <MetaRow
                    label="Endpoint"
                    value={
                      agent.address && agent.port
                        ? `${agent.address}:${agent.port}`
                        : "-"
                    }
                  />
                  <MetaRow label="Status" value={
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  } mono={false} />
                  <MetaRow label="Enabled" value={agent.isEnabled === 1 ? "Yes" : "No"} />
                  <MetaRow label="Registered by" value={agent.registeredBy || "Admin"} />
                  <MetaRow label="Last seen" value={lastHeartbeatText} />
                  <MetaRow label="Metrics path" value={agent.metrics || "-"} />
                </div>
              </Panel>

              {/* 运行时 */}
              <Panel>
                <PanelHeader title="Runtime" />
                <div className="flex flex-col gap-3 p-5">
                  <MetaRow label="OS" value={agent.os || "-"} />
                  <MetaRow label="Arch" value={agent.arch || "-"} />
                  <MetaRow label="Version" value={agent.version || "-"} />
                  <MetaRow
                    label="Jobs"
                    value={capacity > 0 ? `${runningJobs} / ${capacity}` : "-"}
                  />
                  <MetaRow label="Load" value={capacity > 0 ? `${loadPct}%` : "-"} />
                </div>

                {/* 负载进度条 */}
                {capacity > 0 && (
                  <div className="border-t px-5 py-4">
                    <div className="mb-1.5 flex justify-between font-mono text-[10.5px] text-fg-subtle">
                      <span>Slot utilization</span>
                      <span>{loadPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        style={{
                          height: "100%",
                          width: `${loadPct}%`,
                          background:
                            loadPct > 80
                              ? "var(--accent-warn)"
                              : agent.status === 3
                                ? "var(--brand-signal)"
                                : "var(--fg)",
                          opacity: 0.75,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </Panel>

              {/* Labels */}
              {Object.keys(agent.labels || {}).length > 0 && (
                <Panel className="lg:col-span-2">
                  <PanelHeader
                    title="Labels"
                    sub={`${Object.keys(agent.labels || {}).length} entries`}
                  />
                  <div className="flex flex-col divide-y divide-border">
                    {Object.entries(agent.labels || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-4 px-5 py-2.5">
                        <span className="w-48 shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-subtle">
                          {key}
                        </span>
                        <span className="min-w-0 truncate font-mono text-[12.5px] text-foreground">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: running-tasks ── */}
          <TabsContent value="running-tasks" className="mt-4">
            <Panel>
              <PanelHeader title="Running tasks" sub={`${runningJobs} active`} />
              <div className="p-5">

                {/* 指标行 */}
                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-md border bg-bg-elevated px-4 py-3">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                      Jobs
                    </span>
                    <span className="font-mono text-[20px] font-semibold tabular-nums text-foreground">
                      {capacity > 0 ? `${runningJobs} / ${capacity}` : "-"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-md border bg-bg-elevated px-4 py-3">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                      Last heartbeat
                    </span>
                    <span className="font-mono text-[20px] font-semibold tabular-nums text-foreground">
                      {lastHeartbeatText}
                    </span>
                  </div>
                </div>

                {/* 任务列表 */}
                {currentTaskNames.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <SectionEyebrow>Active tasks</SectionEyebrow>
                    {currentTaskNames.map((taskName: string) => (
                      <div
                        key={taskName}
                        className="flex items-center gap-3 rounded-md border px-4 py-2.5"
                      >
                        <StatusDot tone="running" pulse />
                        <span className="font-mono text-[12.5px] text-foreground">
                          {taskName}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-fg-muted">
                    {runningJobs > 0
                      ? "Agent is busy, but task names are not reported by runtime metadata."
                      : "No running tasks."}
                  </p>
                )}
              </div>
            </Panel>
          </TabsContent>

          {/* ── Tab: configuration ── */}
          <TabsContent value="configuration" className="mt-4">
            <Panel>
              <PanelHeader title="Raw configuration" sub="JSON representation of agent record" />
              <div className="p-5">
                <pre className="overflow-x-auto rounded-md border bg-bg-elevated px-4 py-4 font-mono text-[12px] leading-relaxed text-foreground">
                  <code>{JSON.stringify(agent, null, 2)}</code>
                </pre>
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </section>

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
