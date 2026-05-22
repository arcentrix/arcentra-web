/**
 * Agents Fleet 页面 — Engineering Blueprint 重做
 *
 * 视觉层完全按设计系统规范重写；数据层（Apis.*、状态、事件）全部保留。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Copy,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Apis } from "@/api";
import type { Agent, AgentStatus, UpdateAgentRequest } from "@/api/agent/types";
import type {
  RegistrationToken,
  CreateRegistrationTokenReq,
} from "@/api/agent/types";
import { AgentDialog } from "@/components/agent-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/page-header";
import {
  Panel,
  PanelHeader,
  MetaRow,
  SectionEyebrow,
  StatusDot,
  FilterPill,
  ColumnHead,
} from "@/components/blueprint";
import type { DotTone } from "@/components/blueprint";

/* ─────────────────────── 类型 / 常量 ─────────────────────── */

type FleetTab = "agents" | "pools" | "tokens" | "activity";
type StatusFilter = "all" | "online" | "busy" | "offline" | "unknown";
type EnabledFilter = "all" | "enabled" | "disabled";
type SortOption = "last-seen" | "name-asc" | "status";

/** AgentStatus → StatusDot tone 映射 */
const STATUS_DOT_TONE: Record<AgentStatus, DotTone> = {
  0: "muted",
  1: "ok",
  2: "fail",
  3: "running",
  4: "info",
};

/** AgentStatus → Badge variant */
const STATUS_BADGE: Record<
  AgentStatus,
  {
    label: string;
    variant: "success" | "warning" | "critical" | "outline" | "info" | "secondary";
    online: boolean;
  }
> = {
  0: { label: "Unknown", variant: "outline", online: false },
  1: { label: "Online", variant: "success", online: true },
  2: { label: "Offline", variant: "critical", online: false },
  3: { label: "Busy", variant: "info", online: true },
  4: { label: "Idle", variant: "secondary", online: true },
};

/* ─────────────────────── 数据工具函数（原有，保留不变）─────────────────────── */

const parseNumericLabel = (
  labels: Record<string, string> | undefined,
  keys: string[],
) => {
  const source = labels || {};
  for (const key of keys) {
    const value = source[key];
    if (!value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getAgentCapacity = (agent: Agent) => {
  if (agent.isEnabled !== 1) return 0;
  const fromLabel = parseNumericLabel(agent.labels, [
    "capacity",
    "max_jobs",
    "slots",
    "worker_slots",
  ]);
  return fromLabel && fromLabel > 0 ? fromLabel : 4;
};

const getRunningJobs = (agent: Agent) => {
  const fromLabel = parseNumericLabel(agent.labels, [
    "running_jobs",
    "current_jobs",
    "jobs",
  ]);
  if (fromLabel !== null && fromLabel >= 0) return fromLabel;
  if (agent.status === 3) return 1;
  return 0;
};

const getLastSeen = (agent: Agent) => {
  const source = agent.labels || {};
  const direct =
    source.last_seen ||
    source.lastSeen ||
    source.last_heartbeat ||
    source.heartbeat ||
    source.heartbeat_text;
  if (direct) return direct;

  const heartbeatAgeSeconds = parseNumericLabel(source, [
    "heartbeat_age_seconds",
    "heartbeatAgeSeconds",
  ]);
  if (heartbeatAgeSeconds !== null && heartbeatAgeSeconds >= 0) {
    if (heartbeatAgeSeconds < 60) return `${heartbeatAgeSeconds}s ago`;
    if (heartbeatAgeSeconds < 3600)
      return `${Math.floor(heartbeatAgeSeconds / 60)}m ago`;
    return `${Math.floor(heartbeatAgeSeconds / 3600)}h ago`;
  }

  if (agent.status === 0) return "Never";
  if (agent.status === 2) return "Stale";
  if (agent.status === 3) return "Active";
  return "Recent";
};

const getEndpoint = (agent: Agent) => {
  if (!agent.address || !agent.port) return "-";
  return `${agent.address}:${agent.port}`;
};

const getRuntime = (agent: Agent) => {
  const os = agent.os || "-";
  const arch = agent.arch || "-";
  return `${os} / ${arch}`;
};

const getStatusSortRank = (status: AgentStatus) => {
  if (status === 3) return 0;
  if (status === 1 || status === 4) return 1;
  if (status === 2) return 2;
  return 3;
};

const formatExpiry = (expiresAt: string | null) => {
  if (!expiresAt) return "Never";
  return new Date(expiresAt).toLocaleDateString();
};

/* ─────────────────────── 子组件 ─────────────────────── */

/** 指标统计卡（设计系统样板） */
function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  hint: string;
  loading?: boolean;
}) {
  return (
    <Panel className="flex flex-col gap-2 px-5 py-[18px]">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="reading font-mono text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
          {value}
        </span>
      )}
      {loading ? (
        <Skeleton className="h-4 w-36" />
      ) : (
        <span className="text-[12px] text-fg-muted">{hint}</span>
      )}
    </Panel>
  );
}

/** Runner grid 卡片 */
function RunnerCard({
  agent,
  active,
  onClick,
}: {
  agent: Agent;
  active: boolean;
  onClick: () => void;
}) {
  const capacity = getAgentCapacity(agent);
  const jobs = getRunningJobs(agent);
  const load = capacity > 0 ? Math.round((jobs / capacity) * 100) : 0;
  const tone = STATUS_DOT_TONE[agent.status] ?? "muted";
  const isRunning = agent.status === 3;

  const loadBarColor =
    load > 80
      ? "var(--accent-warn)"
      : isRunning
        ? "var(--brand-signal)"
        : "var(--fg)";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        border: 0,
        cursor: "pointer",
        padding: 14,
        background: active ? "var(--bg-elevated)" : "var(--bg)",
        boxShadow: active ? "inset 0 0 0 1px var(--brand-signal-dim)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* 顶行：agent ID + 状态点 */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] text-foreground">
          {agent.agentName}
        </span>
        <StatusDot tone={tone} pulse={isRunning} />
      </div>

      {/* 副行：OS · arch */}
      <div className="font-mono text-[10.5px] text-fg-subtle">
        {agent.os || "-"} · {agent.arch || "-"}
      </div>

      {/* 负载条 */}
      <div
        style={{
          height: 4,
          width: "100%",
          borderRadius: 9999,
          background: "var(--border)",
          overflow: "hidden",
          marginTop: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${load}%`,
            background: loadBarColor,
            opacity: agent.status === 0 ? 0.3 : 0.75,
          }}
        />
      </div>

      {/* 底行：负载% + jobs/capacity */}
      <div className="flex justify-between font-mono text-[10px] text-fg-subtle">
        <span>{load}% load</span>
        <span>
          {capacity > 0 ? `${jobs} / ${capacity}` : "-"}
        </span>
      </div>
    </button>
  );
}

/* ─────────────────────── 主组件 ─────────────────────── */

export default function AgentsOverview() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FleetTab>("agents");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [osFilter, setOsFilter] = useState("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("last-seen");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Runner grid 选中状态（Overview 右侧详情面板）
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);

  // Registration Tokens state
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenExpiryDate, setTokenExpiryDate] = useState<Date | undefined>(undefined);
  const [tokenFormData, setTokenFormData] = useState<{
    description: string;
    maxUses: string;
  }>({ description: "", maxUses: "" });
  const [showTokenResult, setShowTokenResult] = useState(false);
  const [createdToken, setCreatedToken] = useState<{
    id: number;
    token: string;
    description: string;
  } | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<RegistrationToken | null>(null);
  const [tokensPage] = useState(1);
  const [tokensPageSize] = useState(10);

  /* ── 数据加载 ── */

  const loadAgents = async () => {
    setLoading(true);
    try {
      const response = await Apis.agent.listAgents({ pageNum: 1, pageSize: 1000 });
      const list = response.agents || [];
      setAgents(list);
      if (list.length > 0 && !selectedRunnerId) {
        setSelectedRunnerId(list[0].agentId);
      }
    } catch (error) {
      toast.error("Failed to load agents");
      console.error("Load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const response = await Apis.agent.listRegistrationTokens({ pageNum: 1, pageSize: 1000 });
      setTokens(response.tokens || []);
    } catch (error) {
      console.error("Load tokens failed:", error);
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { if (activeTab === "tokens") loadTokens(); }, [activeTab, loadTokens]);
  useEffect(() => { setPageNum(1); }, [searchTerm, statusFilter, osFilter, enabledFilter, sortBy]);

  /* ── 事件处理（原有，保留不变）── */

  const handleEdit = (agent: Agent) => { setSelectedAgent(agent); setDialogOpen(true); };
  const handleDelete = (agent: Agent) => { setSelectedAgent(agent); setDeleteDialogOpen(true); };

  const handleConfirmDelete = async () => {
    if (!selectedAgent) return;
    try {
      await Apis.agent.deleteAgent(selectedAgent.agentId);
      toast.success("Agent deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedAgent(null);
      await loadAgents();
    } catch (error) {
      toast.error("Failed to delete agent");
      console.error("Delete failed:", error);
    }
  };

  const handleSubmit = async (data: UpdateAgentRequest) => {
    try {
      if (selectedAgent) {
        await Apis.agent.updateAgent(selectedAgent.agentId, data);
        await loadAgents();
      }
    } catch (error: any) {
      throw error;
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedField(null), 1800);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    try {
      await Apis.agent.updateAgent(agent.agentId, {
        isEnabled: agent.isEnabled === 1 ? 0 : 1,
      });
      toast.success(agent.isEnabled === 1 ? "Agent disabled" : "Agent enabled");
      await loadAgents();
    } catch (error) {
      toast.error("Failed to toggle agent status");
      console.error("Toggle failed:", error);
    }
  };

  const handleApprove = async (agent: Agent) => {
    try {
      await Apis.agent.approveAgent(agent.agentId);
      toast.success("Agent approved");
      await loadAgents();
    } catch (error) {
      toast.error("Failed to approve agent");
      console.error("Approve failed:", error);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenFormData.description.trim()) {
      toast.error("Description is required");
      return;
    }
    try {
      const req: CreateRegistrationTokenReq = { description: tokenFormData.description.trim() };
      if (tokenFormData.maxUses) req.maxUses = parseInt(tokenFormData.maxUses, 10);
      if (tokenExpiryDate) req.expiresAt = tokenExpiryDate.toISOString();
      const resp = await Apis.agent.createRegistrationToken(req);
      setCreatedToken({ id: resp.id, token: resp.token, description: resp.description });
      setShowTokenResult(true);
      setTokenDialogOpen(false);
      setTokenFormData({ description: "", maxUses: "" });
      setTokenExpiryDate(undefined);
      await loadTokens();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create token");
    }
  };

  const handleRevokeToken = async () => {
    if (!tokenToRevoke) return;
    try {
      await Apis.agent.revokeRegistrationToken(tokenToRevoke.id);
      toast.success("Token revoked");
      setRevokeDialogOpen(false);
      setTokenToRevoke(null);
      await loadTokens();
    } catch (error) {
      toast.error("Failed to revoke token");
    }
  };

  /* ── 派生数据 ── */

  const osOptions = useMemo(() => {
    const uniqueOs = Array.from(new Set(agents.map((a) => a.os).filter(Boolean)));
    return uniqueOs.sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const onlineCount = useMemo(
    () => agents.filter((a) => STATUS_BADGE[a.status]?.online).length,
    [agents],
  );
  const offlineCount = useMemo(() => agents.filter((a) => a.status === 2).length, [agents]);
  const unknownCount = useMemo(() => agents.filter((a) => a.status === 0).length, [agents]);
  const enabledCount = useMemo(() => agents.filter((a) => a.isEnabled === 1).length, [agents]);
  const runningJobs = useMemo(() => agents.reduce((s, a) => s + getRunningJobs(a), 0), [agents]);
  const totalCapacity = useMemo(() => agents.reduce((s, a) => s + getAgentCapacity(a), 0), [agents]);
  const capacityPct =
    totalCapacity > 0 ? `${Math.round((runningJobs / totalCapacity) * 100)}%` : "—";

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = agents.filter((agent) => {
      const matchesSearch =
        !term ||
        agent.agentName.toLowerCase().includes(term) ||
        agent.agentId.toLowerCase().includes(term) ||
        getEndpoint(agent).toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online" && (agent.status === 1 || agent.status === 4)) ||
        (statusFilter === "busy" && agent.status === 3) ||
        (statusFilter === "offline" && agent.status === 2) ||
        (statusFilter === "unknown" && agent.status === 0);
      const matchesOs = osFilter === "all" || agent.os === osFilter;
      const matchesEnabled =
        enabledFilter === "all" ||
        (enabledFilter === "enabled" && agent.isEnabled === 1) ||
        (enabledFilter === "disabled" && agent.isEnabled !== 1);
      return matchesSearch && matchesStatus && matchesOs && matchesEnabled;
    });

    if (sortBy === "name-asc") return result.sort((a, b) => a.agentName.localeCompare(b.agentName));
    return result.sort((a, b) => {
      const rank = getStatusSortRank(a.status) - getStatusSortRank(b.status);
      if (rank !== 0) return rank;
      return a.agentName.localeCompare(b.agentName);
    });
  }, [agents, enabledFilter, osFilter, searchTerm, sortBy, statusFilter]);

  const totalPages = Math.ceil(filteredAgents.length / pageSize);
  const displayAgents = useMemo(
    () => filteredAgents.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [filteredAgents, pageNum, pageSize],
  );
  const displayTokens = useMemo(
    () => tokens.slice((tokensPage - 1) * tokensPageSize, tokensPage * tokensPageSize),
    [tokens, tokensPage, tokensPageSize],
  );

  /* ── Runner grid 的右侧详情 ── */
  const selectedRunner = agents.find((a) => a.agentId === selectedRunnerId) ?? null;

  /* ── 按 cluster/label 分组（用于侧边 Clusters 面板）── */
  const clusterMap = useMemo(() => {
    const map = new Map<string, { total: number; online: number }>();
    for (const agent of agents) {
      const cluster = agent.labels?.cluster || agent.labels?.pool || "default";
      const existing = map.get(cluster) ?? { total: 0, online: 0 };
      existing.total += 1;
      if (STATUS_BADGE[agent.status]?.online) existing.online += 1;
      map.set(cluster, existing);
    }
    return map;
  }, [agents]);

  /* ── 注册 alert 横幅 ── */
  const showUnknownAlert = unknownCount > 0;

  /* ─────────────── JSX ─────────────── */

  return (
    <>
      <section className="flex flex-1 flex-col gap-6 p-8">

        {/* 页头 */}
        <PageHeader
          eyebrow="agents / runtime"
          title="Agents"
          sub="Distributed runners and execution targets across all clusters."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTokenDialogOpen(true)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Register token
              </Button>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add runner
              </Button>
            </div>
          }
        />

        {/* 统计行 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Online"
            value={loading ? "—" : `${onlineCount} / ${agents.length}`}
            hint={`${offlineCount} offline`}
            loading={loading}
          />
          <StatCard
            label="Unknown"
            value={loading ? "—" : unknownCount}
            hint="Registered but never seen"
            loading={loading}
          />
          <StatCard
            label="Enabled"
            value={loading ? "—" : enabledCount}
            hint="Eligible for scheduling"
            loading={loading}
          />
          <StatCard
            label="Capacity"
            value={loading ? "—" : capacityPct}
            hint={`${runningJobs} / ${totalCapacity} slots used`}
            loading={loading}
          />
        </div>

        {/* 未知 agent 告警条 */}
        {showUnknownAlert && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-[12.5px] text-amber-600 dark:text-amber-400">
            {unknownCount} agents have never reported heartbeat. Check network access, runtime startup command, and registration token validity.
          </div>
        )}

        {/* Tab 导航 */}
        <div className="flex items-center gap-1 border-b">
          {(["agents", "pools", "tokens", "activity"] as FleetTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                "pb-2.5 pt-1 px-3 font-mono text-[12px] uppercase tracking-[0.06em] transition-colors " +
                (activeTab === tab
                  ? "border-b-2 border-brand-signal text-foreground"
                  : "text-fg-muted hover:text-foreground")
              }
            >
              {tab === "tokens" ? "Tokens" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Tab: agents ── */}
        {activeTab === "agents" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* 左侧：Runner grid */}
            <Panel>
              <PanelHeader
                title="Runners"
                sub={loading ? "loading…" : `${agents.length} registered · ${onlineCount} online`}
                action={
                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="h-7 w-[110px] font-mono text-[11px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                }
              />

              {loading ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 1,
                    padding: 1,
                    background: "var(--border)",
                  }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ padding: 14, background: "var(--bg)" }}>
                      <Skeleton className="mb-2 h-3 w-20" />
                      <Skeleton className="mb-3 h-2 w-16" />
                      <Skeleton className="h-1 w-full" />
                      <div className="mt-2 flex justify-between">
                        <Skeleton className="h-2 w-10" />
                        <Skeleton className="h-2 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-[13px] text-fg-muted">
                    {agents.length === 0
                      ? "No agents registered yet."
                      : "No agents match the current filters."}
                  </p>
                  {agents.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setOsFilter("all");
                        setEnabledFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 1,
                    padding: 1,
                    background: "var(--border)",
                  }}
                >
                  {filteredAgents.map((agent) => (
                    <RunnerCard
                      key={agent.agentId}
                      agent={agent}
                      active={agent.agentId === selectedRunnerId}
                      onClick={() => setSelectedRunnerId(agent.agentId)}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* 右侧：选中 runner 详情 + Clusters */}
            <div className="flex flex-col gap-4">

              {/* Runner Detail */}
              <Panel>
                {selectedRunner ? (
                  <>
                    <div className="p-5">
                      <SectionEyebrow>runner detail</SectionEyebrow>
                      <h3 className="mt-2.5 font-mono text-[18px] font-semibold tracking-[-0.02em] text-foreground">
                        {selectedRunner.agentName}
                      </h3>
                      <div className="mt-4 flex flex-col gap-3">
                        <MetaRow label="Agent ID" value={selectedRunner.agentId} />
                        <MetaRow label="Status" value={
                          <Badge variant={STATUS_BADGE[selectedRunner.status].variant}>
                            {STATUS_BADGE[selectedRunner.status].label}
                          </Badge>
                        } mono={false} />
                        <MetaRow
                          label="Endpoint"
                          value={getEndpoint(selectedRunner)}
                        />
                        <MetaRow label="Runtime" value={getRuntime(selectedRunner)} />
                        <MetaRow label="Version" value={selectedRunner.version || "-"} />
                        <MetaRow
                          label="Jobs"
                          value={
                            getAgentCapacity(selectedRunner) > 0
                              ? `${getRunningJobs(selectedRunner)} / ${getAgentCapacity(selectedRunner)}`
                              : "-"
                          }
                        />
                        <MetaRow label="Last seen" value={getLastSeen(selectedRunner)} />
                        <MetaRow
                          label="Enabled"
                          value={selectedRunner.isEnabled === 1 ? "Yes" : "No"}
                        />
                        {selectedRunner.registeredBy && (
                          <MetaRow label="Registered by" value={selectedRunner.registeredBy} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t px-4 py-3">
                      <Switch
                        checked={selectedRunner.isEnabled === 1}
                        onCheckedChange={() => handleToggleStatus(selectedRunner)}
                        aria-label={selectedRunner.isEnabled === 1 ? "Drain agent" : "Enable agent"}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(selectedRunner)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/agents/${selectedRunner.agentId}`)}
                      >
                        Logs
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                      {selectedRunner.registeredBy === "dynamic" && selectedRunner.isEnabled === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(selectedRunner)}
                        >
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-5">
                    <SectionEyebrow>runner detail</SectionEyebrow>
                    <p className="mt-4 text-[13px] text-fg-muted">
                      Select a runner to view details.
                    </p>
                  </div>
                )}
              </Panel>

              {/* Clusters 面板 */}
              <Panel>
                <PanelHeader
                  title="Clusters"
                  sub={`${clusterMap.size} reachable`}
                />
                {clusterMap.size === 0 ? (
                  <p className="px-5 py-4 text-[13px] text-fg-muted">
                    No cluster labels found on agents.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {Array.from(clusterMap.entries()).map(([name, stats]) => (
                      <li key={name} className="flex items-center gap-3 px-5 py-3">
                        <Server className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                        <span className="flex-1 truncate font-mono text-[12.5px] text-foreground">
                          {name}
                        </span>
                        <span className="font-mono text-[11px]">
                          <span className="text-foreground">{stats.online}</span>
                          <span className="text-fg-subtle"> / {stats.total}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        )}

        {/* ── Tab: pools ── */}
        {activeTab === "pools" && (
          <Panel>
            <PanelHeader title="Agent Pools" />
            <div className="px-5 py-4">
              <p className="text-[13px] text-fg-muted">
                Pool management will be available in the next iteration. Use labels today to simulate pool grouping.
              </p>
            </div>
          </Panel>
        )}

        {/* ── Tab: tokens ── */}
        {activeTab === "tokens" && (
          <Panel>
            <PanelHeader
              title="Registration Tokens"
              sub="Generate tokens that agents use to register themselves dynamically."
              action={
                <Button size="sm" onClick={() => setTokenDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Generate token
                </Button>
              }
            />
            {tokensLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[13px] text-fg-muted">No registration tokens yet.</p>
                <Button size="sm" className="mt-4" onClick={() => setTokenDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Generate your first token
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><ColumnHead>Description</ColumnHead></TableHead>
                    <TableHead><ColumnHead>Created by</ColumnHead></TableHead>
                    <TableHead><ColumnHead>Uses</ColumnHead></TableHead>
                    <TableHead><ColumnHead>Expires</ColumnHead></TableHead>
                    <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                    <TableHead className="text-right"><ColumnHead>Actions</ColumnHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayTokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-medium">{token.description}</TableCell>
                      <TableCell className="font-mono text-[12px] text-fg-muted">
                        {token.createdBy || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-[12px]">
                        {token.useCount}{token.maxUses > 0 ? ` / ${token.maxUses}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-[12px]">
                        {formatExpiry(token.expiresAt)}
                      </TableCell>
                      <TableCell>
                        {token.isActive === 1 ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {token.isActive === 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setTokenToRevoke(token); setRevokeDialogOpen(true); }}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        )}

        {/* ── Tab: activity ── */}
        {activeTab === "activity" && (
          <Panel>
            <PanelHeader title="Agent Activity" />
            <div className="px-5 py-4">
              <p className="text-[13px] text-fg-muted">
                Activity timeline will be added in a follow-up. Current fleet health is available in the Agents tab.
              </p>
            </div>
          </Panel>
        )}

        {/* ── 全局 Agent 表（在 agents tab 下方，用于搜索 + 分页操作）── */}
        {activeTab === "agents" && agents.length > 0 && (
          <Panel>
            <PanelHeader
              title="All agents"
              sub={`${filteredAgents.length} result${filteredAgents.length !== 1 ? "s" : ""}`}
              action={
                <div className="flex items-center gap-2">
                  {/* 搜索 */}
                  <Input
                    placeholder="Search name, id, endpoint…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 w-[220px] font-mono text-[12px]"
                  />
                  {/* OS filter */}
                  <Select value={osFilter} onValueChange={setOsFilter}>
                    <SelectTrigger className="h-7 w-[100px] font-mono text-[11px]">
                      <SelectValue placeholder="OS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All OS</SelectItem>
                      {osOptions.map((os) => (
                        <SelectItem key={os} value={os}>{os}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Sort */}
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="h-7 w-[140px] font-mono text-[11px]">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-seen">Last seen</SelectItem>
                      <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />

            {/* 筛选 pills */}
            <div className="flex items-center gap-2 border-b px-5 py-3">
              {(["all", "online", "busy", "offline", "unknown"] as StatusFilter[]).map((f) => (
                <FilterPill
                  key={f}
                  label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  active={statusFilter === f}
                  dotTone={
                    f === "online" ? "ok"
                    : f === "busy" ? "running"
                    : f === "offline" ? "fail"
                    : f === "unknown" ? "muted"
                    : undefined
                  }
                  count={
                    f === "all" ? agents.length
                    : f === "online" ? onlineCount
                    : f === "busy" ? agents.filter((a) => a.status === 3).length
                    : f === "offline" ? offlineCount
                    : f === "unknown" ? unknownCount
                    : undefined
                  }
                  onClick={() => setStatusFilter(f)}
                />
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <FilterPill
                  label="Enabled"
                  active={enabledFilter === "enabled"}
                  count={enabledCount}
                  onClick={() =>
                    setEnabledFilter((p) => (p === "enabled" ? "all" : "enabled"))
                  }
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : displayAgents.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-fg-muted">
                No agents match the current filters.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><ColumnHead>Agent</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Endpoint</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Runtime</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Version</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Jobs</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Last seen</ColumnHead></TableHead>
                      <TableHead><ColumnHead>Registered by</ColumnHead></TableHead>
                      <TableHead className="text-right"><ColumnHead>Actions</ColumnHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayAgents.map((agent) => {
                      const capacity = getAgentCapacity(agent);
                      const jobs = getRunningJobs(agent);
                      const isDynamicPending = agent.registeredBy === "dynamic" && agent.isEnabled === 0;
                      return (
                        <TableRow
                          key={agent.agentId}
                          className="cursor-pointer"
                          onClick={() => navigate(`/agents/${agent.agentId}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <StatusDot tone={STATUS_DOT_TONE[agent.status] ?? "muted"} />
                              <div>
                                <div className="text-[13px] font-medium">{agent.agentName}</div>
                                <div className="font-mono text-[11px] text-fg-muted">{agent.agentId}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[agent.status]?.variant ?? "outline"}>
                              {STATUS_BADGE[agent.status]?.label ?? "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[12px]">{getEndpoint(agent)}</TableCell>
                          <TableCell className="font-mono text-[12px]">{getRuntime(agent)}</TableCell>
                          <TableCell className="font-mono text-[12px]">{agent.version || "-"}</TableCell>
                          <TableCell className="font-mono text-[12px]">
                            {capacity > 0 ? `${jobs} / ${capacity}` : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-[12px]">{getLastSeen(agent)}</TableCell>
                          <TableCell>
                            <Badge variant={agent.registeredBy === "dynamic" ? "info" : "outline"}>
                              {agent.registeredBy === "dynamic" ? "Dynamic" : agent.registeredBy || "Admin"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopy(agent.agentId, `id-${agent.agentId}`)}
                              >
                                {copiedField === `id-${agent.agentId}` ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              {isDynamicPending && (
                                <Button size="sm" variant="ghost" onClick={() => handleApprove(agent)}>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(agent)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(agent)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="border-t px-5 py-3">
                    <DataTablePagination
                      page={pageNum}
                      pageSize={pageSize}
                      total={filteredAgents.length}
                      onPageChange={setPageNum}
                    />
                  </div>
                )}
              </>
            )}
          </Panel>
        )}
      </section>

      {/* ── Dialogs（保留原有逻辑，只调整样式）── */}

      {/* Edit Agent Dialog */}
      <AgentDialog
        key={selectedAgent?.agentId || "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={selectedAgent}
        onSubmit={handleSubmit}
      />

      {/* Delete Agent Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete agent &quot;{selectedAgent?.agentName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Registration Token</DialogTitle>
            <DialogDescription>
              Create a token that agents can use to register themselves. The token is shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token-desc">Description</Label>
              <Input
                id="token-desc"
                placeholder="e.g., Production Linux agents"
                value={tokenFormData.description}
                onChange={(e) => setTokenFormData({ ...tokenFormData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-max-uses">Max Uses (optional, 0 = unlimited)</Label>
              <Input
                id="token-max-uses"
                type="number"
                placeholder="0"
                value={tokenFormData.maxUses}
                onChange={(e) => setTokenFormData({ ...tokenFormData, maxUses: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expiration (optional)</Label>
              <DatePicker date={tokenExpiryDate} onSelect={setTokenExpiryDate} placeholder="No expiration" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateToken}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Result Dialog */}
      <Dialog open={showTokenResult} onOpenChange={setShowTokenResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token Generated</DialogTitle>
            <DialogDescription>Copy this token now. It will not be shown again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={createdToken?.description || ""} readOnly className="font-medium" />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="relative">
                <Input
                  value={createdToken?.token || ""}
                  readOnly
                  className="pr-10 font-mono text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => createdToken && handleCopy(createdToken.token, "token-result")}
                >
                  {copiedField === "token-result" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-fg-muted">
                Configure this token as <code>grpc.registrationToken</code> in agent.toml.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTokenResult(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Token Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the token &quot;{tokenToRevoke?.description}&quot;? Agents using this token will no longer be able to register.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevokeToken}>Revoke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
