/**
 * Project Secrets 标签面板 — Engineering Blueprint 重做
 * Panel + 表格：Key / Description / Last Updated。
 * 保留全部搜索/分页/Add Secret 按钮逻辑。
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Plus, Search } from "lucide-react";
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
import { Panel, PanelHeader, ColumnHead } from "@/components/blueprint";

interface Secret {
  name: string;
  description: string;
  lastUpdated: string;
}

/** Derive a scope label from secret name */
function secretToScope(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("stripe") || lower.includes("sentry")) return "production";
  if (lower.includes("github") || lower.includes("aws")) return "all envs";
  if (lower.includes("slack")) return "all envs";
  return "all envs";
}

const Secrets: FC = () => {
  const [secrets] = useState<Secret[]>([
    { name: "API_KEY",        description: "Main API key",                lastUpdated: "2024-01-15" },
    { name: "DATABASE_URL",   description: "Database connection string",  lastUpdated: "2024-01-10" },
    { name: "SECRET_TOKEN",   description: "Authentication token",        lastUpdated: "2024-01-20" },
    { name: "AWS_ACCESS_KEY", description: "AWS access key",              lastUpdated: "2024-01-18" },
    { name: "GITHUB_TOKEN",   description: "GitHub access token",         lastUpdated: "2024-01-12" },
    { name: "SLACK_WEBHOOK",  description: "Slack webhook URL",           lastUpdated: "2024-01-08" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

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

  const totalPages = Math.ceil(filteredSecrets.length / pageSize);
  const paginatedSecrets = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredSecrets.slice(startIndex, startIndex + pageSize);
  }, [filteredSecrets, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search + action */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Search secrets…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Button size="sm" className="ml-auto gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add secret
        </Button>
      </div>

      <Panel>
        <PanelHeader
          title="Project secrets"
          sub={`${filteredSecrets.length} keys · scoped to this project`}
        />

        {filteredSecrets.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
            No secrets match your search.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHead>Key</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Description</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Scope</ColumnHead></TableHead>
                  <TableHead className="text-right"><ColumnHead>Rotated</ColumnHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSecrets.map((secret) => (
                  <TableRow key={secret.name}>
                    <TableCell className="font-mono text-[12.5px] font-medium">
                      {secret.name}
                    </TableCell>
                    <TableCell className="text-[13px] text-fg-muted">
                      {secret.description}
                    </TableCell>
                    <TableCell className="text-[13px] text-fg-muted">
                      {secretToScope(secret.name)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11.5px] text-fg-subtle">
                      {secret.lastUpdated}
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
                  total={filteredSecrets.length}
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

export default Secrets;
