/**
 * System Information 页面 - 显示系统信息
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Info,
  Search,
  ChevronRight,
  ArrowUpCircle,
  GitBranch,
  Cpu,
  Package,
  Tag,
  Puzzle,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getVersionInfo, type VersionInfo } from "@/api/system";
import { Apis } from "@/api";
import type { Plugin, PluginType } from "@/api/plugin/types";
import { toast } from "@/lib/toast";

export default function SystemInfoPage() {
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
      } catch (err: any) {
        console.error("Failed to load version info:", err);
        setError(err.message || "Failed to load version information");
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
      } catch (err: any) {
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

    // 状态过滤（目前所有插件都是启用状态，预留接口）
    // if (filterStatus !== 'all') {
    //   result = result.filter((p) => p.isEnabled === (filterStatus === 'enabled'));
    // }

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

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Info className="h-8 w-8 text-purple-500" />
              System Information
            </h2>
            <p className="text-muted-foreground mt-1">
              View system version, status, and runtime information
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Loading system information...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !versionInfo) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Info className="h-8 w-8 text-purple-500" />
              System Information
            </h2>
            <p className="text-muted-foreground mt-1">
              View system version, status, and runtime information
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Info className="h-8 w-8 text-purple-500" />
            System Information
          </h2>
          <p className="text-muted-foreground mt-1">
            View version, runtime environment and installed plugins.
          </p>
        </div>
        {versionInfo && (
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowUpCircle className="h-4 w-4" />
            Check for upgrade
          </Button>
        )}
      </div>

      {/* Top overview cards */}
      {versionInfo && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Version</CardTitle>
              <Tag className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">v{versionInfo.version}</div>
              <p className="text-xs text-muted-foreground">
                Latest stable release
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Build</CardTitle>
              <GitBranch className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{versionInfo.gitBranch}</div>
              <p className="text-xs text-muted-foreground font-mono">
                {versionInfo.gitCommit.substring(0, 7)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Runtime</CardTitle>
              <Cpu className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{versionInfo.platform}</div>
              <p className="text-xs text-muted-foreground">Detected at boot</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plugins</CardTitle>
              <Package className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plugins.length}</div>
              <p className="text-xs text-muted-foreground">
                {plugins.length === 0 ? "None installed" : "Installed plugins"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Runtime detail */}
      {versionInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Runtime</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <dt className="text-[13px] text-muted-foreground min-w-[110px]">
                  Version
                </dt>
                <dd className="text-[13px] font-medium">
                  {versionInfo.version}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-[13px] text-muted-foreground min-w-[110px]">
                  Build Time
                </dt>
                <dd className="text-[13px] font-medium font-mono">
                  {versionInfo.buildTime}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-[13px] text-muted-foreground min-w-[110px]">
                  Git Branch
                </dt>
                <dd className="text-[13px] font-medium">
                  {versionInfo.gitBranch}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-[13px] text-muted-foreground min-w-[110px]">
                  Git Commit
                </dt>
                <dd className="text-[13px] font-medium font-mono">
                  {versionInfo.gitCommit.substring(0, 7)}
                </dd>
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <dt className="text-[13px] text-muted-foreground min-w-[110px]">
                  Platform
                </dt>
                <dd className="text-[13px] font-medium">
                  {versionInfo.platform}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Plugins - 管理视图 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Plugins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜索和过滤器 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins by name, type, capability…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
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
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">
                All
              </TabsTrigger>
              <TabsTrigger value="source" className="text-xs px-3">
                Source
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs px-3">
                Custom
              </TabsTrigger>
              <TabsTrigger value="notify" className="text-xs px-3">
                Notify
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loadingPlugins ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Loading plugins...
                </div>
              ) : filteredPlugins.length > 0 ? (
                <div className="space-y-0 border rounded-lg">
                  {filteredPlugins.map((plugin) => (
                    <div
                      key={`${plugin.pluginId}-${plugin.version}`}
                      className="group flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
                      style={{ minHeight: "56px" }}
                      onClick={() => handlePluginClick(plugin)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium">
                            {plugin.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getPluginTypeColor(plugin.pluginType)}`}
                          >
                            {plugin.pluginType}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {plugin.version}
                          </span>
                          <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-xs text-muted-foreground">
                              Enabled
                            </span>
                          </div>
                        </div>
                        {plugin.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {plugin.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              ) : searchTerm ||
                filterType !== "all" ||
                filterStatus !== "all" ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    No plugins match your filters.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                    <Puzzle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-medium">
                      No plugins installed
                    </div>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Extend Arcentra with source, build, deploy and
                      notification plugins.
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
        </CardContent>
      </Card>

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
                  <label className="text-xs font-medium text-muted-foreground">
                    Version
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {selectedPlugin.version}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <div className="mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getPluginTypeColor(selectedPlugin.pluginType)}`}
                    >
                      {selectedPlugin.pluginType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-sm">Enabled</span>
                  </div>
                </div>
                {selectedPlugin.description && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Description
                    </label>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {selectedPlugin.description}
                    </p>
                  </div>
                )}
                {selectedPlugin.author && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Author
                    </label>
                    <p className="text-sm mt-1">{selectedPlugin.author}</p>
                  </div>
                )}
                {selectedPlugin.repository && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Repository
                    </label>
                    <a
                      href={selectedPlugin.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm mt-1 font-mono text-blue-600 dark:text-blue-400 hover:underline break-all block"
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
