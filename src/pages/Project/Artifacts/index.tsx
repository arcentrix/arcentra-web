/**
 * Project Artifacts 页面
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { RefreshCw, Download, Filter } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";

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

const Artifacts: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);

  // 模拟数据 - 实际应该从 API 获取
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "available":
        return "default";
      case "expired":
        return "destructive";
      case "archived":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-50 border-green-200 text-green-700 hover:bg-green-100";
      case "expired":
        return "bg-red-50 border-red-200 text-red-700 hover:bg-red-100";
      case "archived":
        return "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      const matchesSearch =
        artifact.name.toLowerCase().includes(searchText.toLowerCase()) ||
        artifact.pipelineName?.toLowerCase().includes(searchText.toLowerCase());
      const matchesType = typeFilter === "all" || artifact.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || artifact.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [artifacts, searchText, typeFilter, statusFilter]);

  // 分页计算
  const totalPages = Math.ceil(filteredArtifacts.length / pageSize);
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredArtifacts.slice(startIndex, startIndex + pageSize);
  }, [filteredArtifacts, pageNum, pageSize]);

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchText, typeFilter, statusFilter]);

  const handleRefresh = () => {
    setLoading(true);
    // 模拟 API 调用
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleDownload = (artifact: Artifact) => {
    // 模拟下载
    console.log("Downloading artifact:", artifact.name);
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-500" />
            Artifacts
          </h2>
          <p className="text-muted-foreground mt-1">
            View and manage build artifacts for project {projectId}
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
                placeholder="Search by artifact name or pipeline..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-auto min-w-[150px] gap-1.5">
                <Filter className="h-4 w-4 shrink-0" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="docker">Docker</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="yaml">YAML</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[150px] gap-1.5">
                <Filter className="h-4 w-4 shrink-0" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Artifacts 列表 */}
      {filteredArtifacts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No artifacts found
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedArtifacts.map((artifact) => (
              <Card
                key={artifact.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">
                        {artifact.name}
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {artifact.type}
                          </Badge>
                          <Badge
                            variant={getStatusBadgeVariant(artifact.status)}
                            className={getStatusBadgeClassName(artifact.status)}
                          >
                            {artifact.status}
                          </Badge>
                        </div>
                        {artifact.pipelineName && (
                          <div className="text-xs text-muted-foreground">
                            Pipeline: {artifact.pipelineName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Size: {artifact.size}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {formatDate(artifact.createdAt)}
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDownload(artifact)}
                    disabled={artifact.status !== "available"}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="pt-4 border-t">
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
    </div>
  );
};

export default Artifacts;
