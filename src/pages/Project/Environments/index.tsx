/**
 * Project Environments 页面
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Globe, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";

const Environments: FC = () => {
  const [environments] = useState([
    { name: "Production", status: "active", url: "https://prod.example.com" },
    { name: "Staging", status: "active", url: "https://staging.example.com" },
    { name: "Development", status: "active", url: "https://dev.example.com" },
    { name: "Testing", status: "active", url: "https://test.example.com" },
    { name: "QA", status: "inactive", url: "https://qa.example.com" },
    { name: "Preview", status: "active", url: "https://preview.example.com" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

  // 筛选逻辑
  const filteredEnvironments = useMemo(() => {
    return environments.filter((env) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          env.name.toLowerCase().includes(term) ||
          env.url.toLowerCase().includes(term) ||
          env.status.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [environments, searchTerm]);

  // 分页计算
  const totalPages = Math.ceil(filteredEnvironments.length / pageSize);
  const paginatedEnvironments = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredEnvironments.slice(startIndex, startIndex + pageSize);
  }, [filteredEnvironments, pageNum, pageSize]);

  // 当搜索条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Globe className="h-8 w-8 text-green-500" />
            Environments
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your deployment environments
          </p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search environments by name, URL, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedEnvironments.map((env) => (
          <Card key={env.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" />
                {env.name}
              </CardTitle>
              <CardDescription>{env.url}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge
                variant="default"
                className={
                  env.status === "active" ? "bg-green-500" : "bg-gray-500"
                }
              >
                {env.status}
              </Badge>
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
            total={filteredEnvironments.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </div>
  );
};

export default Environments;
