/**
 * Project Deployments 页面
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Rocket, Search } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";

const Deployments: FC = () => {
  const [deployments] = useState([
    {
      id: "1",
      name: "Production Deployment",
      status: "success",
      date: "2024-01-20",
    },
    {
      id: "2",
      name: "Staging Deployment",
      status: "success",
      date: "2024-01-19",
    },
    {
      id: "3",
      name: "Development Deployment",
      status: "running",
      date: "2024-01-20",
    },
    { id: "4", name: "Test Deployment", status: "success", date: "2024-01-18" },
    { id: "5", name: "QA Deployment", status: "failed", date: "2024-01-17" },
    {
      id: "6",
      name: "Preview Deployment",
      status: "success",
      date: "2024-01-16",
    },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(5);

  // 筛选逻辑
  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          deployment.name.toLowerCase().includes(term) ||
          deployment.status.toLowerCase().includes(term) ||
          deployment.date.includes(term)
        );
      }
      return true;
    });
  }, [deployments, searchTerm]);

  // 分页计算
  const totalPages = Math.ceil(filteredDeployments.length / pageSize);
  const paginatedDeployments = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredDeployments.slice(startIndex, startIndex + pageSize);
  }, [filteredDeployments, pageNum, pageSize]);

  // 当搜索条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Rocket className="h-8 w-8 text-purple-500" />
            Deployments
          </h2>
          <p className="text-muted-foreground mt-1">
            View and manage your deployments
          </p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search deployments by name, status, or date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-4">
        {paginatedDeployments.map((deployment) => (
          <Card key={deployment.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{deployment.name}</CardTitle>
                <Badge
                  variant={
                    deployment.status === "success"
                      ? "default"
                      : deployment.status === "running"
                        ? "secondary"
                        : "destructive"
                  }
                  className={
                    deployment.status === "success"
                      ? "bg-green-500"
                      : deployment.status === "running"
                        ? "bg-blue-500"
                        : ""
                  }
                >
                  {deployment.status}
                </Badge>
              </div>
              <CardDescription>Deployed on {deployment.date}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="pt-4 border-t">
          <DataTablePagination
            page={pageNum}
            pageSize={pageSize}
            total={filteredDeployments.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </div>
  );
};

export default Deployments;
