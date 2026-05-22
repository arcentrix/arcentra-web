/**
 * Projects 列表页 — Engineering Blueprint 重做版本
 *
 * 数据层（state / filter / sort / pagination / navigate）完全保留；
 * 仅重写 JSX 结构与样式，按设计系统规范重新组织。
 */

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  Frame,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Panel, StatusDot, FilterPill, ColumnHead, type DotTone } from "@/components/blueprint";

/* ─── 类型定义（与原文件完全一致） ───────────────────────────────── */

type ProjectStatus = "healthy" | "warning" | "paused" | "archived";
type ProjectsTab = "all" | "favorites" | "recent" | "archived";
type SortOption =
  | "recent-updated"
  | "name-asc"
  | "pipelines-desc"
  | "deployments-desc";
type ViewMode = "grid" | "list";

type ProjectItem = {
  id: string;
  name: string;
  description: string;
  pipelines: number;
  deployments: number;
  environments: number;
  owner: string;
  status: ProjectStatus;
  favorite: boolean;
  lastUpdatedMinutes: number;
  tags: string[];
};

/* ─── 状态映射 ─────────────────────────────────────────────────── */

const STATUS_DOT_TONE: Record<ProjectStatus, DotTone> = {
  healthy: "ok",
  warning: "warn",
  paused: "muted",
  archived: "muted",
};

const STATUS_BADGE_VARIANT: Record<
  ProjectStatus,
  "success" | "warning" | "secondary" | "outline"
> = {
  healthy: "success",
  warning: "warning",
  paused: "secondary",
  archived: "outline",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  paused: "Paused",
  archived: "Archived",
};

const RECENT_PROJECT_WINDOW_MINUTES = 7 * 24 * 60;

function formatLastUpdated(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / (24 * 60))}d ago`;
}

/* ─── 主组件 ────────────────────────────────────────────────────── */

const Projects: FC = () => {
  const navigate = useNavigate();
  const [projects] = useState<ProjectItem[]>([
    {
      id: "1",
      name: "Project A",
      description: "Main project for production",
      pipelines: 12,
      deployments: 5,
      environments: 3,
      owner: "Platform Team",
      status: "healthy",
      favorite: true,
      lastUpdatedMinutes: 12,
      tags: ["production", "core"],
    },
    {
      id: "2",
      name: "Project B",
      description: "Customer onboarding workspace",
      pipelines: 8,
      deployments: 3,
      environments: 2,
      owner: "Growth Team",
      status: "healthy",
      favorite: false,
      lastUpdatedMinutes: 48,
      tags: ["growth"],
    },
    {
      id: "3",
      name: "Project C",
      description: "Runtime migration validation",
      pipelines: 5,
      deployments: 2,
      environments: 2,
      owner: "Core Services",
      status: "warning",
      favorite: true,
      lastUpdatedMinutes: 95,
      tags: ["migration", "critical"],
    },
    {
      id: "4",
      name: "Project D",
      description: "Nightly regression workload",
      pipelines: 3,
      deployments: 1,
      environments: 1,
      owner: "QA Team",
      status: "paused",
      favorite: false,
      lastUpdatedMinutes: 420,
      tags: ["qa"],
    },
    {
      id: "5",
      name: "Project E",
      description: "Staging launch project",
      pipelines: 7,
      deployments: 4,
      environments: 3,
      owner: "Platform Team",
      status: "healthy",
      favorite: false,
      lastUpdatedMinutes: 150,
      tags: ["staging"],
    },
    {
      id: "6",
      name: "Project F",
      description: "Legacy demo workload",
      pipelines: 2,
      deployments: 0,
      environments: 1,
      owner: "Solution Engineering",
      status: "archived",
      favorite: false,
      lastUpdatedMinutes: 3200,
      tags: ["legacy"],
    },
    {
      id: "7",
      name: "Project G",
      description: "API gateway hardening",
      pipelines: 11,
      deployments: 6,
      environments: 4,
      owner: "Security Team",
      status: "warning",
      favorite: true,
      lastUpdatedMinutes: 64,
      tags: ["security", "api"],
    },
    {
      id: "8",
      name: "Project H",
      description: "Regional rollout workspace",
      pipelines: 6,
      deployments: 3,
      environments: 3,
      owner: "Expansion Team",
      status: "healthy",
      favorite: false,
      lastUpdatedMinutes: 180,
      tags: ["regional"],
    },
    {
      id: "9",
      name: "Project I",
      description: "Data platform modernization",
      pipelines: 10,
      deployments: 4,
      environments: 3,
      owner: "Data Team",
      status: "paused",
      favorite: false,
      lastUpdatedMinutes: 1440,
      tags: ["data", "platform"],
    },
  ]);

  const [activeTab, setActiveTab] = useState<ProjectsTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent-updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

  const owners = useMemo(
    () => Array.from(new Set(projects.map((p) => p.owner))),
    [projects],
  );

  const totalProjects = projects.length;
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "healthy" || p.status === "warning").length,
    [projects],
  );
  const totalPipelines = useMemo(
    () => projects.reduce((sum, p) => sum + p.pipelines, 0),
    [projects],
  );
  const totalDeployments = useMemo(
    () => projects.reduce((sum, p) => sum + p.deployments, 0),
    [projects],
  );

  const tabCounts = useMemo(
    () => ({
      all: projects.filter((p) => p.status !== "archived").length,
      favorites: projects.filter((p) => p.favorite && p.status !== "archived").length,
      recent: projects.filter(
        (p) => p.status !== "archived" && p.lastUpdatedMinutes <= RECENT_PROJECT_WINDOW_MINUTES,
      ).length,
      archived: projects.filter((p) => p.status === "archived").length,
    }),
    [projects],
  );

  const tabScopedProjects = useMemo(() => {
    if (activeTab === "favorites") {
      return projects.filter((p) => p.favorite && p.status !== "archived");
    }
    if (activeTab === "recent") {
      return projects.filter(
        (p) => p.status !== "archived" && p.lastUpdatedMinutes <= RECENT_PROJECT_WINDOW_MINUTES,
      );
    }
    if (activeTab === "archived") {
      return projects.filter((p) => p.status === "archived");
    }
    return projects.filter((p) => p.status !== "archived");
  }, [activeTab, projects]);

  const filteredAndSortedProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = tabScopedProjects.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.owner.toLowerCase().includes(term) ||
        p.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesOwner = ownerFilter === "all" || p.owner === ownerFilter;
      return matchesSearch && matchesStatus && matchesOwner;
    });

    const sorted = [...filtered];
    if (sortBy === "recent-updated") sorted.sort((a, b) => a.lastUpdatedMinutes - b.lastUpdatedMinutes);
    else if (sortBy === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "pipelines-desc") sorted.sort((a, b) => b.pipelines - a.pipelines);
    else sorted.sort((a, b) => b.deployments - a.deployments);
    return sorted;
  }, [ownerFilter, searchTerm, sortBy, statusFilter, tabScopedProjects]);

  const totalPages = Math.ceil(filteredAndSortedProjects.length / pageSize);
  const paginatedProjects = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredAndSortedProjects.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedProjects, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [activeTab, ownerFilter, searchTerm, sortBy, statusFilter]);

  const rangeStart = filteredAndSortedProjects.length === 0 ? 0 : (pageNum - 1) * pageSize + 1;
  const rangeEnd = Math.min(pageNum * pageSize, filteredAndSortedProjects.length);
  const hasNoResult = paginatedProjects.length === 0;

  /* ─── 卡片渲染 ─────────────────────────────────────────────────── */

  const renderProjectCard = (project: ProjectItem) => (
    <article
      key={project.id}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/projects/${project.id}`);
        }
      }}
      className="flex cursor-pointer flex-col rounded-[14px] border border-border bg-background p-5 transition-[border-color,background-color] duration-[160ms] hover:border-border-strong hover:bg-bg-elevated"
    >
      {/* 卡头：图标 + 名称 + 状态点 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated">
            <Frame className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <h3 className="text-[15px] font-semibold leading-none tracking-[-0.01em]">
            {project.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot tone={STATUS_DOT_TONE[project.status]} pulse={project.status === "warning"} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label="Project actions"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/projects/${project.id}/settings`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Archive</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 描述 */}
      <p className="mt-3 text-[13px] leading-[1.55] text-fg-muted line-clamp-2">
        {project.description}
      </p>

      {/* 底栏：语言 · 管线数 · 更新时间 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-[11px] text-fg-subtle">{project.owner}</span>
        <span className="font-mono text-[11px] text-fg-subtle tabular-nums">
          {project.pipelines} pipelines
        </span>
        <span className="font-mono text-[11px] text-fg-subtle">
          {formatLastUpdated(project.lastUpdatedMinutes)}
        </span>
      </div>

      {/* 标签行（仅在有 favorite 或 tag 时出现） */}
      {(project.favorite || project.tags.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {project.favorite && <Badge variant="info" className="text-[10.5px]">Favorite</Badge>}
          {project.tags.map((tag) => (
            <Badge key={`${project.id}-${tag}`} variant="outline" className="text-[10.5px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );

  /* ─── JSX ─────────────────────────────────────────────────────── */

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      {/* 页头 */}
      <PageHeader
        eyebrow="projects / all"
        title="Projects"
        sub={`${totalProjects} projects · ${totalPipelines} pipelines · ${totalDeployments} deployments`}
        action={
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Project
          </Button>
        }
      />

      {/* 概览卡片行 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Projects", value: totalProjects, hint: "All workspaces" },
          { label: "Active Projects", value: activeProjects, hint: "Healthy + warning" },
          { label: "Total Pipelines", value: totalPipelines, hint: "Across all projects" },
          { label: "Total Deployments", value: totalDeployments, hint: "All records" },
        ].map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-background px-5 py-[18px]"
          >
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-fg-subtle">
              {card.label}
            </span>
            <span className="reading font-mono text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {card.value}
            </span>
            <span className="text-[11.5px] text-fg-subtle">{card.hint}</span>
          </div>
        ))}
      </div>

      {/* 筛选工具栏 */}
      <div className="flex flex-col gap-3">
        {/* 第一行：tab pills + 视图切换 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "favorites", "recent", "archived"] as const).map((t) => (
              <FilterPill
                key={t}
                active={activeTab === t}
                label={t.charAt(0).toUpperCase() + t.slice(1)}
                count={tabCounts[t]}
                onClick={() => setActiveTab(t)}
              />
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className="h-7 w-7 p-0"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className="h-7 w-7 p-0"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 第二行：搜索 + 下拉筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 搜索框 */}
          <div className="inline-flex h-8 min-w-[280px] max-w-[360px] flex-1 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects…"
              className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-subtle"
            />
          </div>

          {/* 状态筛选 */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | ProjectStatus)}
          >
            <SelectTrigger className="h-8 w-[140px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {/* 负责人筛选 */}
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-8 w-[180px] text-[13px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Owner: All</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 排序 */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-8 w-[200px] text-[13px]">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3 w-3 text-fg-subtle" />
                <SelectValue placeholder="Sort by" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent-updated">Recently updated</SelectItem>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="pipelines-desc">Most pipelines</SelectItem>
              <SelectItem value="deployments-desc">Most deployments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 计数提示 */}
        <p className="font-mono text-[11px] text-fg-subtle">
          Showing {rangeStart}–{rangeEnd} of {filteredAndSortedProjects.length} projects
        </p>
      </div>

      {/* 主体：空态 / 网格 / 列表 */}
      {hasNoResult ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-elevated">
            <Frame className="h-5 w-5 text-fg-muted" />
          </div>
          <h3 className="text-[14px] font-semibold">No projects found</h3>
          <p className="max-w-[340px] text-[13px] text-fg-muted">
            {searchTerm
              ? <>No projects match &ldquo;{searchTerm}&rdquo;. <span className="text-fg-subtle">Try a different search.</span></>
              : "Adjust filters or create a new project to get started."}
          </p>
          {(searchTerm || statusFilter !== "all" || ownerFilter !== "all") ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setOwnerFilter("all");
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Project
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedProjects.map(renderProjectCard)}
        </div>
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><ColumnHead>Name</ColumnHead></TableHead>
                <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                <TableHead><ColumnHead>Pipelines</ColumnHead></TableHead>
                <TableHead><ColumnHead>Deployments</ColumnHead></TableHead>
                <TableHead><ColumnHead>Updated</ColumnHead></TableHead>
                <TableHead className="text-right"><ColumnHead>Actions</ColumnHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-[13px] font-medium hover:text-brand-signal"
                        >
                          {project.name}
                        </Link>
                        {project.favorite && (
                          <Badge variant="info" className="text-[10.5px]">Favorite</Badge>
                        )}
                      </div>
                      <p className="line-clamp-1 font-mono text-[11px] text-fg-subtle">
                        {project.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[project.status]} className="text-[11.5px]">
                      {STATUS_LABEL[project.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[13px] tabular-nums">{project.pipelines}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[13px] tabular-nums">{project.deployments}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[12px] text-fg-muted">
                      {formatLastUpdated(project.lastUpdatedMinutes)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Project actions" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/projects/${project.id}/settings`}>Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Archive</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="border-t border-border pt-4">
          <DataTablePagination
            page={pageNum}
            pageSize={pageSize}
            total={filteredAndSortedProjects.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </section>
  );
};

export default Projects;
