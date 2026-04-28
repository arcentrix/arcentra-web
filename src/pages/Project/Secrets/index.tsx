/**
 * Project Secrets 页面
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Key, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";

const Secrets: FC = () => {
  const [secrets] = useState([
    { name: "API_KEY", description: "Main API key", lastUpdated: "2024-01-15" },
    {
      name: "DATABASE_URL",
      description: "Database connection string",
      lastUpdated: "2024-01-10",
    },
    {
      name: "SECRET_TOKEN",
      description: "Authentication token",
      lastUpdated: "2024-01-20",
    },
    {
      name: "AWS_ACCESS_KEY",
      description: "AWS access key",
      lastUpdated: "2024-01-18",
    },
    {
      name: "GITHUB_TOKEN",
      description: "GitHub access token",
      lastUpdated: "2024-01-12",
    },
    {
      name: "SLACK_WEBHOOK",
      description: "Slack webhook URL",
      lastUpdated: "2024-01-08",
    },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

  // 筛选逻辑
  const filteredSecrets = useMemo(() => {
    return secrets.filter((secret) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          secret.name.toLowerCase().includes(term) ||
          secret.description.toLowerCase().includes(term) ||
          secret.lastUpdated.includes(term)
        );
      }
      return true;
    });
  }, [secrets, searchTerm]);

  // 分页计算
  const totalPages = Math.ceil(filteredSecrets.length / pageSize);
  const paginatedSecrets = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredSecrets.slice(startIndex, startIndex + pageSize);
  }, [filteredSecrets, pageNum, pageSize]);

  // 当搜索条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Key className="h-8 w-8 text-yellow-500" />
            Secrets
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your project secrets and credentials
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Secret
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search secrets by name, description, or date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedSecrets.map((secret) => (
          <Card key={secret.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-yellow-500" />
                {secret.name}
              </CardTitle>
              <CardDescription>{secret.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Last updated: {secret.lastUpdated}
              </p>
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
            total={filteredSecrets.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </div>
  );
};

export default Secrets;
