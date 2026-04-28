/**
 * Agents Fleet 页面
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldCheck,
  Trash2,
  Zap,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";

type FleetTab = "agents" | "pools" | "tokens" | "activity";
type StatusFilter = "all" | "online" | "busy" | "offline" | "unknown";
type EnabledFilter = "all" | "enabled" | "disabled";
type SortOption = "last-seen" | "name-asc" | "status";

const STATUS_META: Record<
  AgentStatus,
  {
    label: string;
    variant: "success" | "warning" | "critical" | "outline" | "info";
    online: boolean;
  }
> = {
  0: { label: "Unknown", variant: "outline", online: false },
  1: { label: "Online", variant: "success", online: true },
  2: { label: "Offline", variant: "critical", online: false },
  3: { label: "Busy", variant: "info", online: true },
  4: { label: "Online", variant: "success", online: true },
};

const parseNumericLabel = (
  labels: Record<string, string> | undefined,
  keys: string[],
) => {
  const source = labels || {};
  for (const key of keys) {
    const value = source[key];
    if (!value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
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
  if (fromLabel !== null && fromLabel >= 0) {
    return fromLabel;
  }
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

const getStatusBadge = (status: AgentStatus) => {
  const meta = STATUS_META[status] || STATUS_META[0];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
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

  // Registration Tokens state
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenExpiryDate, setTokenExpiryDate] = useState<Date | undefined>(
    undefined,
  );
  const [tokenFormData, setTokenFormData] = useState<{
    description: string;
    maxUses: string;
  }>({
    description: "",
    maxUses: "",
  });
  const [showTokenResult, setShowTokenResult] = useState(false);
  const [createdToken, setCreatedToken] = useState<{
    id: number;
    token: string;
    description: string;
  } | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<RegistrationToken | null>(
    null,
  );
  const [tokensPage] = useState(1);
  const [tokensPageSize] = useState(10);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const response = await Apis.agent.listAgents({
        pageNum: 1,
        pageSize: 1000,
      });
      setAgents(response.agents || []);
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
      const response = await Apis.agent.listRegistrationTokens({
        pageNum: 1,
        pageSize: 1000,
      });
      setTokens(response.tokens || []);
    } catch (error) {
      console.error("Load tokens failed:", error);
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (activeTab === "tokens") {
      loadTokens();
    }
  }, [activeTab, loadTokens]);

  useEffect(() => {
    setPageNum(1);
  }, [searchTerm, statusFilter, osFilter, enabledFilter, sortBy]);

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
  };

  const handleDelete = (agent: Agent) => {
    setSelectedAgent(agent);
    setDeleteDialogOpen(true);
  };

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

  // Registration Token handlers
  const handleCreateToken = async () => {
    if (!tokenFormData.description.trim()) {
      toast.error("Description is required");
      return;
    }
    try {
      const req: CreateRegistrationTokenReq = {
        description: tokenFormData.description.trim(),
      };
      if (tokenFormData.maxUses) {
        req.maxUses = parseInt(tokenFormData.maxUses, 10);
      }
      if (tokenExpiryDate) {
        req.expiresAt = tokenExpiryDate.toISOString();
      }
      const resp = await Apis.agent.createRegistrationToken(req);
      setCreatedToken({
        id: resp.id,
        token: resp.token,
        description: resp.description,
      });
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

  const osOptions = useMemo(() => {
    const uniqueOs = Array.from(
      new Set(agents.map((agent) => agent.os).filter(Boolean)),
    );
    return uniqueOs.sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const onlineCount = useMemo(
    () => agents.filter((agent) => STATUS_META[agent.status]?.online).length,
    [agents],
  );
  const offlineCount = useMemo(
    () => agents.filter((agent) => agent.status === 2).length,
    [agents],
  );
  const unknownCount = useMemo(
    () => agents.filter((agent) => agent.status === 0).length,
    [agents],
  );
  const enabledCount = useMemo(
    () => agents.filter((agent) => agent.isEnabled === 1).length,
    [agents],
  );
  const runningJobs = useMemo(
    () => agents.reduce((sum, agent) => sum + getRunningJobs(agent), 0),
    [agents],
  );
  const totalCapacity = useMemo(
    () => agents.reduce((sum, agent) => sum + getAgentCapacity(agent), 0),
    [agents],
  );

  const fleetSummaryCards = [
    {
      label: "Online Agents",
      value: `${onlineCount} / ${agents.length || 0}`,
      hint: `${offlineCount} offline`,
    },
    {
      label: "Unknown Agents",
      value: unknownCount,
      hint: "Registered but never seen",
    },
    {
      label: "Enabled Agents",
      value: enabledCount,
      hint: "Eligible for scheduling",
    },
    {
      label: "Running Jobs",
      value: `${runningJobs} / ${totalCapacity}`,
      hint:
        totalCapacity > 0
          ? `${Math.round((runningJobs / totalCapacity) * 100)}% capacity usage`
          : "No capacity",
    },
  ];

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
        (statusFilter === "online" &&
          (agent.status === 1 || agent.status === 4)) ||
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

    if (sortBy === "name-asc") {
      return result.sort((a, b) => a.agentName.localeCompare(b.agentName));
    }

    if (sortBy === "status") {
      return result.sort((a, b) => {
        const rank = getStatusSortRank(a.status) - getStatusSortRank(b.status);
        if (rank !== 0) return rank;
        return a.agentName.localeCompare(b.agentName);
      });
    }

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

  const displayTokens = useMemo(() => {
    return tokens.slice(
      (tokensPage - 1) * tokensPageSize,
      tokensPage * tokensPageSize,
    );
  }, [tokens, tokensPage, tokensPageSize]);

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never";
    return new Date(expiresAt).toLocaleDateString();
  };

  return (
    <>
      <section className="flex w-full flex-1 flex-col gap-6 p-4 pt-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              <Zap className="h-8 w-8 text-yellow-500" />
              Agents
            </h2>
            <p className="text-muted-foreground">
              Manage and monitor agent nodes across environments and networks.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {fleetSummaryCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="space-y-1 pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl">{card.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {unknownCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {unknownCount} agents have never reported heartbeat. Check network
            access, runtime startup command, and registration token validity.
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as FleetTab)}
        >
          <TabsList className="h-9 w-full justify-start overflow-x-auto lg:w-auto">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="pools">Pools</TabsTrigger>
            <TabsTrigger value="tokens">Registration Tokens</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "agents" && (
          <Card>
            <CardHeader>
              <CardTitle>Agent Fleet</CardTitle>
              <CardDescription>
                Filter, inspect, and operate runtime nodes from a single table.
              </CardDescription>
              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, id, or endpoint..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as StatusFilter)
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={osFilter} onValueChange={setOsFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="OS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All OS</SelectItem>
                      {osOptions.map((os) => (
                        <SelectItem key={os} value={os}>
                          {os}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={enabledFilter}
                    onValueChange={(value) =>
                      setEnabledFilter(value as EnabledFilter)
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Enabled" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Enabled: All</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortOption)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Sort by" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-seen">Sort: Last seen</SelectItem>
                      <SelectItem value="name-asc">Sort: Name (A-Z)</SelectItem>
                      <SelectItem value="status">Sort: Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-muted-foreground">
                    Loading agent fleet...
                  </p>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Zap className="mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground">
                    {agents.length === 0
                      ? "No agents registered yet."
                      : "No agents match the current filters."}
                  </p>
                  {agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Create a registration token in the &quot;Registration
                      Tokens&quot; tab and start an agent with it.
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setOsFilter("all");
                        setEnabledFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Runtime</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Jobs</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Registered By</TableHead>
                        <TableHead>Enabled</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayAgents.map((agent) => {
                        const capacity = getAgentCapacity(agent);
                        const jobs = getRunningJobs(agent);
                        const isDynamicPending =
                          agent.registeredBy === "dynamic" &&
                          agent.isEnabled === 0;
                        return (
                          <TableRow
                            key={agent.agentId}
                            className="cursor-pointer"
                            onClick={() => navigate(`/agents/${agent.agentId}`)}
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium hover:text-primary">
                                  {agent.agentName}
                                </div>
                                <div className="font-mono text-xs text-muted-foreground">
                                  {agent.agentId}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(agent.status)}
                            </TableCell>
                            <TableCell>{getEndpoint(agent)}</TableCell>
                            <TableCell>{getRuntime(agent)}</TableCell>
                            <TableCell>{agent.version || "-"}</TableCell>
                            <TableCell>
                              {capacity > 0 ? `${jobs} / ${capacity}` : "-"}
                            </TableCell>
                            <TableCell>{getLastSeen(agent)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  agent.registeredBy === "dynamic"
                                    ? "info"
                                    : "outline"
                                }
                              >
                                {agent.registeredBy === "dynamic"
                                  ? "Dynamic"
                                  : agent.registeredBy || "Admin"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {agent.isEnabled === 1 ? (
                                <Badge variant="success">
                                  <Power className="mr-1 h-3 w-3" />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <PowerOff className="mr-1 h-3 w-3" />
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div
                                className="flex items-center justify-end gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Agent actions"
                                      onPointerDown={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        navigate(`/agents/${agent.agentId}`)
                                      }
                                    >
                                      View details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleCopy(
                                          agent.agentId,
                                          `id-${agent.agentId}`,
                                        )
                                      }
                                    >
                                      Copy agent ID
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleEdit(agent)}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                    {isDynamicPending && (
                                      <DropdownMenuItem
                                        onClick={() => handleApprove(agent)}
                                      >
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Approve
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleToggleStatus(agent)}
                                    >
                                      {agent.isEnabled === 1
                                        ? "Disable"
                                        : "Enable"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDelete(agent)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="mt-4">
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
            </CardContent>
          </Card>
        )}

        {activeTab === "pools" && (
          <Card>
            <CardHeader>
              <CardTitle>Agent Pools</CardTitle>
              <CardDescription>
                Group agents by workload, environment, or network boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pool management will be available in the next iteration. Use
                labels today to simulate pool grouping.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "tokens" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registration Tokens</CardTitle>
                  <CardDescription>
                    Generate tokens that agents use to register themselves
                    dynamically.
                  </CardDescription>
                </div>
                <Button onClick={() => setTokenDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Token
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tokensLoading ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-muted-foreground">Loading tokens...</p>
                </div>
              ) : tokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="mb-4 text-muted-foreground">
                    No registration tokens yet.
                  </p>
                  <Button onClick={() => setTokenDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Your First Token
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayTokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell>
                          <span className="font-medium">
                            {token.description}
                          </span>
                        </TableCell>
                        <TableCell>{token.createdBy || "-"}</TableCell>
                        <TableCell>
                          {token.useCount}
                          {token.maxUses > 0 ? ` / ${token.maxUses}` : ""}
                        </TableCell>
                        <TableCell>{formatExpiry(token.expiresAt)}</TableCell>
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
                              onClick={() => {
                                setTokenToRevoke(token);
                                setRevokeDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "activity" && (
          <Card>
            <CardHeader>
              <CardTitle>Agent Activity</CardTitle>
              <CardDescription>
                Track registration, heartbeat, and runtime events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity timeline will be added in a follow-up. Current fleet
                health is available in the Agents table.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

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
              Are you sure you want to delete agent &quot;
              {selectedAgent?.agentName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
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
              Create a token that agents can use to register themselves. The
              token is shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token-desc">Description</Label>
              <Input
                id="token-desc"
                placeholder="e.g., Production Linux agents"
                value={tokenFormData.description}
                onChange={(e) =>
                  setTokenFormData({
                    ...tokenFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-max-uses">
                Max Uses (optional, 0 = unlimited)
              </Label>
              <Input
                id="token-max-uses"
                type="number"
                placeholder="0"
                value={tokenFormData.maxUses}
                onChange={(e) =>
                  setTokenFormData({
                    ...tokenFormData,
                    maxUses: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expiration (optional)</Label>
              <DatePicker
                date={tokenExpiryDate}
                onSelect={setTokenExpiryDate}
                placeholder="No expiration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateToken}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Result Dialog */}
      <Dialog open={showTokenResult} onOpenChange={setShowTokenResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token Generated</DialogTitle>
            <DialogDescription>
              Copy this token now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={createdToken?.description || ""}
                readOnly
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="relative">
                <Input
                  value={createdToken?.token || ""}
                  readOnly
                  className="pr-10 font-mono text-sm"
                  onClick={(event) =>
                    (event.target as HTMLInputElement).select()
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() =>
                    createdToken &&
                    handleCopy(createdToken.token, "token-result")
                  }
                >
                  {copiedField === "token-result" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this token as <code>grpc.registrationToken</code> in
                agent.toml.
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
              Are you sure you want to revoke the token &quot;
              {tokenToRevoke?.description}&quot;? Agents using this token will
              no longer be able to register.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeToken}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
