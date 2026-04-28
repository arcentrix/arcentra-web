/**
 * Pipeline History 页面 - 显示 pipeline 的执行历史记录
 */

import type { FC } from "react";
import { useParams, Link } from "react-router-dom";
import {
  History,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";

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
  duration?: number; // 秒
  triggeredBy: string;
  commit?: string;
  branch?: string;
  stages?: {
    name: string;
    status: PipelineExecutionStatus;
    duration?: number;
  }[];
}

const PipelineHistory: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);

  // 模拟数据 - 实际应该从 API 获取
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

  const getStatusIcon = (status: PipelineExecutionStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClassName = (status: PipelineExecutionStatus) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200 text-green-700 hover:bg-green-100";
      case "failed":
        return "bg-red-50 border-red-200 text-red-700 hover:bg-red-100";
      case "running":
        return "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100";
      case "cancelled":
        return "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100";
      case "pending":
        return "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const filteredExecutions = useMemo(() => {
    return executions.filter((execution) => {
      const matchesSearch =
        execution.pipelineName
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        execution.commit?.toLowerCase().includes(searchText.toLowerCase()) ||
        execution.branch?.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || execution.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [executions, searchText, statusFilter]);

  // 分页计算
  const totalPages = Math.ceil(filteredExecutions.length / pageSize);
  const paginatedExecutions = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredExecutions.slice(startIndex, startIndex + pageSize);
  }, [filteredExecutions, pageNum, pageSize]);

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchText, statusFilter]);

  const handleRefresh = () => {
    setLoading(true);
    // 模拟 API 调用
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <History className="h-8 w-8 text-blue-500" />
            Pipeline Runs
          </h2>
          <p className="text-muted-foreground mt-1">
            View execution runs for all pipelines in project {projectId}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by pipeline name, commit, or branch..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[150px] gap-1.5">
                <Filter className="h-4 w-4 shrink-0" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 历史记录列表 */}
      {filteredExecutions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No pipeline executions found
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedExecutions.map((execution) => {
              const getStageClassName = (status: PipelineExecutionStatus) => {
                switch (status) {
                  case "success":
                    return "bg-green-50 border-green-200 text-green-700";
                  case "failed":
                    return "bg-red-50 border-red-200 text-red-700";
                  case "running":
                    return "bg-blue-50 border-blue-200 text-blue-700";
                  case "cancelled":
                    return "bg-gray-50 border-gray-200 text-gray-700";
                  case "pending":
                    return "bg-yellow-50 border-yellow-200 text-yellow-700";
                  default:
                    return "bg-gray-50 border-gray-200 text-gray-700";
                }
              };

              // 格式化日期为 YYYY/MM/DD HH:mm
              const formatCompactDate = (dateString: string) => {
                const date = new Date(dateString);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                const hours = String(date.getHours()).padStart(2, "0");
                const minutes = String(date.getMinutes()).padStart(2, "0");
                return `${year}/${month}/${day} ${hours}:${minutes}`;
              };

              return (
                <Card
                  key={execution.id}
                  className="border shadow-none hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-3 px-4 space-y-1.5">
                    {/* Row 1: Pipeline Name + Status */}
                    <div
                      className="flex items-center justify-between"
                      style={{ lineHeight: "20px" }}
                    >
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(execution.status)}
                        <Link
                          to={`/projects/${projectId}/pipelines/${execution.pipelineId}`}
                          className="font-semibold text-base hover:text-primary transition-colors"
                        >
                          {execution.pipelineName}
                        </Link>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeClassName(execution.status)}
                      >
                        <span className="flex items-center gap-1">
                          {getStatusIcon(execution.status)}
                          {execution.status.toUpperCase()}
                        </span>
                      </Badge>
                    </div>

                    {/* Row 2: Metadata (分开显示，强调 commit id) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Commit ID - 强调显示 */}
                      {execution.commit && (
                        <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-900 px-2 py-0.5 rounded border border-gray-300">
                          {execution.commit.substring(0, 7)}
                        </span>
                      )}

                      {/* Branch - 单独显示 */}
                      {execution.branch && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {execution.branch}
                        </Badge>
                      )}

                      {/* 触发人员 - 单独显示 */}
                      <span className="text-sm text-gray-600">
                        {execution.triggeredBy}
                      </span>

                      {/* 耗时 - 单独显示，强调 */}
                      {execution.duration && (
                        <span className="text-sm font-medium text-gray-700">
                          {formatDuration(execution.duration)}
                        </span>
                      )}

                      {/* 开始时间 - 灰色小字 */}
                      <span className="text-xs text-gray-400">
                        {formatCompactDate(execution.startedAt)}
                      </span>
                    </div>

                    {/* Row 3: Stages (单行展示，24px高度) */}
                    {execution.stages && execution.stages.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {execution.stages.map((stage, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border h-6 ${getStageClassName(stage.status)}`}
                            style={{ height: "24px" }}
                          >
                            {getStatusIcon(stage.status)}
                            <span className="text-xs font-medium">
                              {stage.name}
                            </span>
                            {stage.duration && (
                              <span className="text-xs opacity-80">
                                ({formatDuration(stage.duration)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="pt-4 border-t">
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
    </div>
  );
};

export default PipelineHistory;
