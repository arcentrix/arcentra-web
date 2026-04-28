/**
 * Projects 索引页面 - 工作台入口
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const STATUS_META: Record<
  ProjectStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "outline" }
> = {
  healthy: { label: "Healthy", variant: "success" },
  warning: { label: "Warning", variant: "warning" },
  paused: { label: "Paused", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
};

const RECENT_PROJECT_WINDOW_MINUTES = 7 * 24 * 60;

function formatLastUpdated(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / (24 * 60))}d ago`;
}

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
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>(
    "all",
  );
  const [ownerFilter, setOwnerFilter] = useState<"all" | string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent-updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

  const owners = useMemo(
    () => Array.from(new Set(projects.map((project) => project.owner))),
    [projects],
  );

  const totalProjects = projects.length;
  const activeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.status === "healthy" || project.status === "warning",
      ).length,
    [projects],
  );
  const totalPipelines = useMemo(
    () => projects.reduce((sum, project) => sum + project.pipelines, 0),
    [projects],
  );
  const totalDeployments = useMemo(
    () => projects.reduce((sum, project) => sum + project.deployments, 0),
    [projects],
  );

  const tabCounts = useMemo(
    () => ({
      all: projects.filter((project) => project.status !== "archived").length,
      favorites: projects.filter(
        (project) => project.favorite && project.status !== "archived",
      ).length,
      recent: projects.filter(
        (project) =>
          project.status !== "archived" &&
          project.lastUpdatedMinutes <= RECENT_PROJECT_WINDOW_MINUTES,
      ).length,
      archived: projects.filter((project) => project.status === "archived")
        .length,
    }),
    [projects],
  );

  const tabScopedProjects = useMemo(() => {
    if (activeTab === "favorites") {
      return projects.filter(
        (project) => project.favorite && project.status !== "archived",
      );
    }

    if (activeTab === "recent") {
      return projects.filter(
        (project) =>
          project.status !== "archived" &&
          project.lastUpdatedMinutes <= RECENT_PROJECT_WINDOW_MINUTES,
      );
    }

    if (activeTab === "archived") {
      return projects.filter((project) => project.status === "archived");
    }

    return projects.filter((project) => project.status !== "archived");
  }, [activeTab, projects]);

  const filteredAndSortedProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = tabScopedProjects.filter((project) => {
      const matchesSearch =
        !term ||
        project.name.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term) ||
        project.owner.toLowerCase().includes(term) ||
        project.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;
      const matchesOwner =
        ownerFilter === "all" || project.owner === ownerFilter;

      return matchesSearch && matchesStatus && matchesOwner;
    });

    const sorted = [...filtered];

    if (sortBy === "recent-updated") {
      sorted.sort((a, b) => a.lastUpdatedMinutes - b.lastUpdatedMinutes);
    } else if (sortBy === "name-asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "pipelines-desc") {
      sorted.sort((a, b) => b.pipelines - a.pipelines);
    } else {
      sorted.sort((a, b) => b.deployments - a.deployments);
    }

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

  const rangeStart =
    filteredAndSortedProjects.length === 0 ? 0 : (pageNum - 1) * pageSize + 1;
  const rangeEnd = Math.min(
    pageNum * pageSize,
    filteredAndSortedProjects.length,
  );

  const summaryCards = [
    {
      label: "Total Projects",
      value: totalProjects,
      hint: "All project workspaces",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      hint: "Healthy and warning projects",
    },
    {
      label: "Total Pipelines",
      value: totalPipelines,
      hint: "Pipelines across all projects",
    },
    {
      label: "Total Deployments",
      value: totalDeployments,
      hint: "All deployment records",
    },
  ];

  const hasNoResult = paginatedProjects.length === 0;

  const renderProjectCard = (project: ProjectItem) => (
    <Card
      key={project.id}
      className="h-full cursor-pointer border-border/80 transition-colors duration-200 hover:border-primary/40 hover:shadow-sm"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/projects/${project.id}`);
        }
      }}
    >
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Frame className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base leading-none">
                {project.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{project.owner}</p>
            </div>
          </div>
          <Badge variant={STATUS_META[project.status].variant}>
            {STATUS_META[project.status].label}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">
          {project.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-muted-foreground">Pipelines</span>
            <span className="font-medium">{project.pipelines}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-muted-foreground">Deployments</span>
            <span className="font-medium">{project.deployments}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-muted-foreground">Environments</span>
            <span className="font-medium">{project.environments}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-muted-foreground">Updated</span>
            <span className="font-medium">
              {formatLastUpdated(project.lastUpdatedMinutes)}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {project.favorite && (
              <Badge variant="info" className="text-[11px]">
                Favorite
              </Badge>
            )}
            {project.tags.map((tag) => (
              <Badge
                key={`${project.id}-${tag}`}
                variant="outline"
                className="text-[11px]"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Project actions"
                className="cursor-pointer"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 pt-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Frame className="h-8 w-8 text-primary" />
            Projects
          </h2>
          <p className="text-muted-foreground">
            Manage your projects and create new ones.
          </p>
        </div>
        <Button className="h-9 self-start md:self-auto">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
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

      <div className="rounded-lg border bg-background p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ProjectsTab)}
          >
            <TabsList className="h-9 w-full justify-start overflow-x-auto lg:w-auto">
              <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
              <TabsTrigger value="favorites">
                Favorites ({tabCounts.favorites})
              </TabsTrigger>
              <TabsTrigger value="recent">
                Recent ({tabCounts.recent})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived ({tabCounts.archived})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="inline-flex items-center rounded-md border p-1">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "all" | ProjectStatus)
              }
            >
              <SelectTrigger className="h-9 w-[160px]">
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

            <Select
              value={ownerFilter}
              onValueChange={(value) => setOwnerFilter(value)}
            >
              <SelectTrigger className="h-9 w-[190px]">
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

            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent-updated">Recently updated</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="pipelines-desc">Most pipelines</SelectItem>
                <SelectItem value="deployments-desc">
                  Most deployments
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Showing {rangeStart}-{rangeEnd} of {filteredAndSortedProjects.length}{" "}
          projects
        </div>
      </div>

      {hasNoResult ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="rounded-full bg-muted p-3">
              <Frame className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No projects found</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try adjusting search and filters, or create a new project to get
              started.
            </p>
            {searchTerm || statusFilter !== "all" || ownerFilter !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setOwnerFilter("all");
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Project Grid</h3>
            <p className="text-xs text-muted-foreground">
              Browse and open projects by status and activity.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedProjects.map((project) => renderProjectCard(project))}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Project List</h3>
            <p className="text-xs text-muted-foreground">
              Compact management view for high project volume.
            </p>
          </div>
          <Card className="border-border/80">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pipelines</TableHead>
                    <TableHead>Deployments</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/projects/${project.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {project.name}
                            </Link>
                            {project.favorite && (
                              <Badge variant="info" className="text-[11px]">
                                Favorite
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_META[project.status].variant}>
                          {STATUS_META[project.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>{project.pipelines}</TableCell>
                      <TableCell>{project.deployments}</TableCell>
                      <TableCell>
                        {formatLastUpdated(project.lastUpdatedMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Project actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/projects/${project.id}/settings`}>
                                Edit
                              </Link>
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
            </CardContent>
          </Card>
        </section>
      )}

      {totalPages > 1 && (
        <div className="border-t pt-4">
          <DataTablePagination
            page={pageNum}
            pageSize={pageSize}
            total={filteredAndSortedProjects.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </div>
  );
};

export default Projects;
