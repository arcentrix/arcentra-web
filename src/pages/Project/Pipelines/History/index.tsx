/**
 * Pipeline History 页面 — Engineering Blueprint 重做
 * Panel + 表格样式，保留全部筛选/分页/搜索逻辑与数据。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { RefreshCw, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  StatusDot,
  StatusBadge,
  FilterPill,
  ColumnHead,
  type DotTone,
  type BadgeTone,
} from "@/components/blueprint";

type PipelineExecutionStatus =
  | "success"
  | "failed"
  | "running"
  | "cancelled"
  | "pending";

interface PipelineExecution {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: PipelineExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: string;
  commit?: string;
  branch?: string;
  stages?: {
    name: string;
    status: PipelineExecutionStatus;
    duration?: number;
  }[];
}

function statusToDotTone(status: PipelineExecutionStatus): DotTone {
  switch (status) {
    case "success":
      return "ok";
    case "failed":
      return "fail";
    case "running":
      return "running";
    case "pending":
      return "warn";
    case "cancelled":
      return "muted";
  }
}

function statusToBadgeTone(status: PipelineExecutionStatus): BadgeTone {
  switch (status) {
    case "success":
      return "ok";
    case "failed":
      return "fail";
    case "running":
      return "running";
    case "pending":
      return "warn";
    case "cancelled":
      return "muted";
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCompactDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

const FILTER_OPTIONS: { label: string; value: string; dotTone?: DotTone }[] = [
  { label: "All", value: "all" },
  { label: "Success", value: "success", dotTone: "ok" },
  { label: "Failed", value: "failed", dotTone: "fail" },
  { label: "Running", value: "running", dotTone: "running" },
  { label: "Cancelled", value: "cancelled", dotTone: "muted" },
  { label: "Pending", value: "pending", dotTone: "warn" },
];

const PipelineHistory: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);

  const executions: PipelineExecution[] = [
    {
      id: "1",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "success",
      startedAt: "2024-01-20T14:30:00Z",
      completedAt: "2024-01-20T14:35:00Z",
      duration: 300,
      triggeredBy: "user@example.com",
      commit: "abc123",
      branch: "main",
      stages: [
        { name: "Build", status: "success", duration: 120 },
        { name: "Test", status: "success", duration: 90 },
        { name: "Deploy", status: "success", duration: 90 },
      ],
    },
    {
      id: "2",
      pipelineId: "pipeline-2",
      pipelineName: "Testing Pipeline",
      status: "failed",
      startedAt: "2024-01-20T10:15:00Z",
      completedAt: "2024-01-20T10:18:00Z",
      duration: 180,
      triggeredBy: "user@example.com",
      commit: "def456",
      branch: "develop",
      stages: [
        { name: "Build", status: "success", duration: 100 },
        { name: "Test", status: "failed", duration: 80 },
      ],
    },
    {
      id: "3",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "running",
      startedAt: "2024-01-20T16:00:00Z",
      triggeredBy: "user@example.com",
      commit: "ghi789",
      branch: "main",
      stages: [
        { name: "Build", status: "success", duration: 110 },
        { name: "Test", status: "running" },
      ],
    },
    {
      id: "4",
      pipelineId: "pipeline-3",
      pipelineName: "Staging Pipeline",
      status: "cancelled",
      startedAt: "2024-01-19T18:20:00Z",
      completedAt: "2024-01-19T18:22:00Z",
      duration: 120,
      triggeredBy: "user@example.com",
      commit: "jkl012",
      branch: "staging",
    },
    {
      id: "5",
      pipelineId: "pipeline-1",
      pipelineName: "Main Deployment Pipeline",
      status: "success",
      startedAt: "2024-01-19T12:00:00Z",
      completedAt: "2024-01-19T12:05:00Z",
      duration: 300,
      triggeredBy: "user@example.com",
      commit: "mno345",
      branch: "main",
      stages: [
        { name: "Build", status: "success", duration: 115 },
        { name: "Test", status: "success", duration: 95 },
        { name: "Deploy", status: "success", duration: 90 },
      ],
    },
  ];

  const filteredExecutions = useMemo(() => {
    return executions.filter((execution) => {
      const matchesSearch =
        execution.pipelineName.toLowerCase().includes(searchText.toLowerCase()) ||
        execution.commit?.toLowerCase().includes(searchText.toLowerCase()) ||
        execution.branch?.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || execution.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [executions, searchText, statusFilter]);

  const totalPages = Math.ceil(filteredExecutions.length / pageSize);
  const paginatedExecutions = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredExecutions.slice(startIndex, startIndex + pageSize);
  }, [filteredExecutions, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchText, statusFilter]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.value}
            label={opt.label}
            dotTone={opt.dotTone}
            active={statusFilter === opt.value}
            onClick={() => setStatusFilter(opt.value)}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Search pipeline, commit, branch…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-8 w-[260px] pl-3 text-[13px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table panel */}
      <Panel>
        <PanelHeader
          title="Pipeline runs"
          sub={`${filteredExecutions.length} of ${executions.length} runs · project ${projectId}`}
        />

        {filteredExecutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[13px] text-fg-muted">
            No pipeline executions match your filters.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHead>Pipeline</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Commit</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Branch</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Duration</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Triggered by</ColumnHead></TableHead>
                  <TableHead className="text-right"><ColumnHead>Started</ColumnHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusDot
                          tone={statusToDotTone(execution.status)}
                          pulse={execution.status === "running"}
                        />
                        <Link
                          to={`/projects/${projectId}/pipelines/${execution.pipelineId}`}
                          className="font-medium hover:text-brand-signal transition-colors"
                        >
                          {execution.pipelineName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-fg-subtle">
                      {execution.commit
                        ? execution.commit.substring(0, 7)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {execution.branch ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-fg-muted">
                          <GitBranch className="h-3 w-3 shrink-0" />
                          {execution.branch}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusToBadgeTone(execution.status)}>
                        {execution.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] tabular-nums text-fg-muted">
                      {formatDuration(execution.duration)}
                    </TableCell>
                    <TableCell className="text-[13px] text-fg-muted">
                      {execution.triggeredBy}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-fg-subtle">
                      {formatCompactDate(execution.startedAt)}
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
                  total={filteredExecutions.length}
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

export default PipelineHistory;
