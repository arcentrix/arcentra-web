/**
 * System Information 页面 - 显示系统信息
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  ChevronRight,
  ArrowUpCircle,
  Puzzle,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard, FormRow, StatusDot, ColumnHead } from "@/components/blueprint";
import { getVersionInfo, type VersionInfo } from "@/api/system";
import { Apis } from "@/api";
import type { Plugin, PluginType } from "@/api/plugin/types";
import { toast } from "@/lib/toast";

export default function SystemInfoPage({
  headless = false,
}: {
  /** 嵌入 Settings 侧栏分区时启用：去掉页头与外层留白。 */
  headless?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // 插件管理状态
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // 防止重复请求（React StrictMode 会执行两次）
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;

    const loadVersionInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await getVersionInfo();
        console.log("Version info loaded:", info);
        setVersionInfo(info);
      } catch (err: unknown) {
        console.error("Failed to load version info:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load version information";
        setError(message);
        toast.error("Failed to load version information");
      } finally {
        setLoading(false);
      }
    };

    const loadPlugins = async () => {
      setLoadingPlugins(true);
      try {
        const response = await Apis.plugin.listPlugins();
        // 按 pluginId 分组，每个插件只显示最新版本
        const pluginMap = new Map<string, Plugin>();
        response.plugins.forEach((plugin) => {
          const existing = pluginMap.get(plugin.pluginId);
          if (
            !existing ||
            compareVersions(plugin.version, existing.version) > 0
          ) {
            pluginMap.set(plugin.pluginId, plugin);
          }
        });
        setPlugins(Array.from(pluginMap.values()));
      } catch (err: unknown) {
        console.error("Failed to load plugins:", err);
        // 不显示错误提示，因为插件信息是可选的
      } finally {
        setLoadingPlugins(false);
      }
    };

    loadVersionInfo();
    loadPlugins();
  }, []);

  // 简单的版本比较函数（语义化版本）
  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    return 0;
  };

  // 过滤和搜索插件
  const filteredPlugins = useMemo(() => {
    let result = plugins;

    // Tab 过滤
    if (activeTab !== "all") {
      result = result.filter((p) => p.pluginType === activeTab);
    }

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.pluginId.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term),
      );
    }

    // 类型过滤
    if (filterType !== "all") {
      result = result.filter((p) => p.pluginType === filterType);
    }

    return result;
  }, [plugins, activeTab, searchTerm, filterType, filterStatus]);

  // 获取插件类型标签颜色
  const getPluginTypeColor = (type: PluginType) => {
    const colors: Record<PluginType, string> = {
      source: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      build:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      test: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      deploy:
        "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      security: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      notify:
        "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      approval:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      storage: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
      analytics:
        "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
      integration:
        "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      custom: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
    };
    return colors[type] || colors.custom;
  };

  // 处理插件点击
  const handlePluginClick = (plugin: Plugin) => {
    setSelectedPlugin(plugin);
    setDrawerOpen(true);
  };

  const outer = headless ? "flex flex-col gap-4" : "flex-1 flex flex-col gap-4 p-4 md:p-8 pt-6";

  /* ── Loading state ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={outer}>
        {/* Upgrade button placeholder */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
        {/* Control plane skeleton */}
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-[18px]">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <div className="p-5 space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid items-center gap-6 border-b py-3.5 last:border-b-0 [grid-template-columns:200px_1fr]"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────────────── */
  if (error && !versionInfo) {
    return (
      <div className={outer}>
        <SettingsCard title="Control plane" sub="Running build and health.">
          <p className="text-[13px] text-accent-danger">{error}</p>
        </SettingsCard>
      </div>
    );
  }

  /* ── Main render ───────────────────────────────────────────── */
  return (
    <div className={outer}>
      {/* Header action */}
      {versionInfo && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Check for upgrade
          </Button>
        </div>
      )}

      {/* ── Control plane card ──────────────────────────────────── */}
      {versionInfo && (
        <SettingsCard
          title="Control plane"
          sub="Running build and health."
        >
          <FormRow label="Version">
            <span className="font-mono text-[13px]">
              v{versionInfo.version}
            </span>
          </FormRow>
          <FormRow label="Commit" hint={`Branch: ${versionInfo.gitBranch}`}>
            <span className="font-mono text-[13px] text-fg-muted">
              {versionInfo.gitCommit.substring(0, 7)} · {versionInfo.buildTime}
            </span>
          </FormRow>
          <FormRow label="Platform">
            <span className="font-mono text-[13px] text-fg-muted">
              {versionInfo.platform}
            </span>
          </FormRow>
          <FormRow label="Database" hint="postgres · connection pool">
            <span className="inline-flex items-center gap-2 font-mono text-[13px]">
              <StatusDot tone="ok" />
              <span className="text-accent-success">healthy</span>
            </span>
          </FormRow>
          <FormRow label="Object storage" hint="Connectivity not verified">
            <a
              href="/settings?section=storage"
              className="text-[13px] text-fg-muted underline underline-offset-4"
            >
              Review saved configuration
            </a>
          </FormRow>
        </SettingsCard>
      )}

      {/* ── Plugins card ────────────────────────────────────────── */}
      <SettingsCard
        title="Plugins"
        sub="Installed source, build, deploy, and notification plugins."
        action={
          <span className="font-mono text-[13px] text-fg-muted">
            {plugins.length} installed
          </span>
        }
      >
        {/* Search and filter */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder="Search plugins by name, type, capability…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-[34px] text-[13px]"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] h-[34px] text-[13px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="build">Build</SelectItem>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="deploy">Deploy</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="notify">Notify</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-[34px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-[12px] px-3">
              All
            </TabsTrigger>
            <TabsTrigger value="source" className="text-[12px] px-3">
              Source
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-[12px] px-3">
              Custom
            </TabsTrigger>
            <TabsTrigger value="notify" className="text-[12px] px-3">
              Notify
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loadingPlugins ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : filteredPlugins.length > 0 ? (
              <>
                {/* Column header */}
                <div className="mb-1 grid items-center gap-4 border-b pb-2 [grid-template-columns:1fr_auto_auto_auto]">
                  <ColumnHead>Plugin</ColumnHead>
                  <ColumnHead>Type</ColumnHead>
                  <ColumnHead>Version</ColumnHead>
                  <span />
                </div>
                <div className="overflow-hidden rounded-md border">
                  {filteredPlugins.map((plugin) => (
                    <div
                      key={`${plugin.pluginId}-${plugin.version}`}
                      className="group flex cursor-pointer items-center gap-4 border-b px-4 py-3 last:border-b-0 transition-colors hover:bg-bg-elevated"
                      onClick={() => handlePluginClick(plugin)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">
                          {plugin.name}
                        </div>
                        {plugin.description && (
                          <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-subtle">
                            {plugin.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10.5px] ${getPluginTypeColor(plugin.pluginType)}`}
                      >
                        {plugin.pluginType}
                      </Badge>
                      <span className="font-mono text-[12px] text-fg-muted">
                        {plugin.version}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  ))}
                </div>
              </>
            ) : searchTerm || filterType !== "all" || filterStatus !== "all" ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-elevated">
                  <Search className="h-5 w-5 text-fg-muted" />
                </div>
                <div className="text-[13px] text-fg-muted">
                  No plugins match your filters.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-elevated">
                  <Puzzle className="h-5 w-5 text-fg-muted" />
                </div>
                <div>
                  <div className="text-[13px] font-medium">
                    No plugins installed
                  </div>
                  <p className="mt-1 max-w-sm text-[12px] text-fg-muted">
                    Extend Arcentra with source, build, deploy and notification
                    plugins.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Puzzle className="h-3.5 w-3.5" />
                    Browse plugins
                  </Button>
                  <Button size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Install manually
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SettingsCard>

      {/* 插件详情抽屉 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Plugin: {selectedPlugin?.name}</SheetTitle>
            <SheetDescription>
              Plugin details and configuration
            </SheetDescription>
          </SheetHeader>
          {selectedPlugin && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                    Version
                  </label>
                  <p className="mt-1 font-mono text-[13px]">
                    {selectedPlugin.version}
                  </p>
                </div>
                <div>
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                    Type
                  </label>
                  <div className="mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-[10.5px] ${getPluginTypeColor(selectedPlugin.pluginType)}`}
                    >
                      {selectedPlugin.pluginType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                    Status
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusDot tone="ok" />
                    <span className="text-[13px] text-accent-success">
                      Enabled
                    </span>
                  </div>
                </div>
                {selectedPlugin.description && (
                  <div>
                    <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                      Description
                    </label>
                    <p className="mt-1 text-[13px] text-fg-muted">
                      {selectedPlugin.description}
                    </p>
                  </div>
                )}
                {selectedPlugin.author && (
                  <div>
                    <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                      Author
                    </label>
                    <p className="mt-1 text-[13px]">{selectedPlugin.author}</p>
                  </div>
                )}
                {selectedPlugin.repository && (
                  <div>
                    <label className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
                      Repository
                    </label>
                    <a
                      href={selectedPlugin.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all font-mono text-[12px] text-brand-signal hover:underline"
                    >
                      {selectedPlugin.repository}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
