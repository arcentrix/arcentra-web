/**
 * Project Artifacts 标签面板 — Engineering Blueprint 重做
 * Panel + 表格：Name / Tag / Type / Size / SHA / Pushed。
 * 保留全部筛选/分页/下载/刷新逻辑。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { RefreshCw, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Panel,
  PanelHeader,
  StatusBadge,
  ColumnHead,
  type BadgeTone,
} from "@/components/blueprint";

interface Artifact {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: string;
  pipelineId?: string;
  pipelineName?: string;
  status: "available" | "expired" | "archived";
}

function artifactStatusToBadgeTone(status: string): BadgeTone {
  switch (status) {
    case "available":
      return "ok";
    case "expired":
      return "fail";
    case "archived":
      return "muted";
    default:
      return "muted";
  }
}

/** Derive a docker-style tag from artifact data */
function artifactTag(artifact: Artifact): string {
  if (artifact.name.includes("v1.2.3")) return "v1.2.3";
  if (artifact.name.includes("latest")) return "latest";
  if (artifact.type === "json") return "latest";
  if (artifact.type === "html") return "latest";
  if (artifact.type === "yaml") return "v1.0.0";
  return "latest";
}

/** Derive a fake short SHA */
function artifactSha(artifact: Artifact): string {
  const map: Record<string, string> = {
    "1": "a4f9c2",
    "2": "0bcf81",
    "3": "92ad11",
    "4": "ee2207",
    "5": "8a31fc",
  };
  return map[artifact.id] ?? "—";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

const Artifacts: FC = () => {
  const { projectId: _projectId } = useParams<{ projectId: string }>();
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);

  const artifacts: Artifact[] = [
    {
      id: "1",
      name: "build-artifact-v1.2.3.tar.gz",
      type: "archive",
      size: "45.2 MB",
      createdAt: "2024-01-20T14:30:00Z",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "available",
    },
    {
      id: "2",
      name: "test-results.json",
      type: "json",
      size: "2.1 MB",
      createdAt: "2024-01-20T10:15:00Z",
      pipelineId: "pipeline-2",
      pipelineName: "Testing Pipeline",
      status: "available",
    },
    {
      id: "3",
      name: "docker-image:latest",
      type: "docker",
      size: "128.5 MB",
      createdAt: "2024-01-19T18:20:00Z",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "available",
    },
    {
      id: "4",
      name: "coverage-report.html",
      type: "html",
      size: "856 KB",
      createdAt: "2024-01-19T12:00:00Z",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "expired",
    },
    {
      id: "5",
      name: "deployment-config.yaml",
      type: "yaml",
      size: "12 KB",
      createdAt: "2024-01-18T16:45:00Z",
      pipelineId: "pipeline-3",
      pipelineName: "Staging Pipeline",
      status: "archived",
    },
  ];

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      const matchesSearch =
        artifact.name.toLowerCase().includes(searchText.toLowerCase()) ||
        artifact.pipelineName?.toLowerCase().includes(searchText.toLowerCase());
      const matchesType = typeFilter === "all" || artifact.type === typeFilter;
      const matchesStatus = statusFilter === "all" || artifact.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [artifacts, searchText, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredArtifacts.length / pageSize);
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredArtifacts.slice(startIndex, startIndex + pageSize);
  }, [filteredArtifacts, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchText, typeFilter, statusFilter]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const handleDownload = (artifact: Artifact) => {
    console.log("Downloading artifact:", artifact.name);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input
            placeholder="Search artifacts or pipeline…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 w-[240px] text-[13px]"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] gap-1.5 text-[13px]">
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="archive">Archive</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="docker">Docker</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="yaml">YAML</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] gap-1.5 text-[13px]">
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="ml-auto h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Panel>
        <PanelHeader
          title="Artifacts"
          sub={`${filteredArtifacts.length} recent · ${artifacts.length} total`}
        />

        {filteredArtifacts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
            No artifacts match your filters.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHead>Name</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Tag</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Type</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Size</ColumnHead></TableHead>
                  <TableHead><ColumnHead>SHA</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                  <TableHead className="text-right"><ColumnHead>Pushed</ColumnHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedArtifacts.map((artifact) => (
                  <TableRow key={artifact.id}>
                    <TableCell className="font-mono text-[12.5px] font-medium">
                      {artifact.name}
                    </TableCell>
                    <TableCell className="font-mono text-[12px]">
                      {artifactTag(artifact)}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-fg-muted">
                      {artifact.type}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-fg-muted">
                      {artifact.size}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-fg-subtle">
                      {artifactSha(artifact)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={artifactStatusToBadgeTone(artifact.status)}>
                        {artifact.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-[11px] text-fg-subtle">
                          {formatDate(artifact.createdAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(artifact)}
                          disabled={artifact.status !== "available"}
                          className="h-7 gap-1"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="border-t px-5 py-3">
                <DataTablePagination
                  page={pageNum}
                  pageSize={pageSize}
                  total={filteredArtifacts.length}
                  onPageChange={setPageNum}
                />
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
};

export default Artifacts;
