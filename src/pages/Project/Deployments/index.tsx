/**
 * Project Deployments 标签面板 — Engineering Blueprint 重做
 * Panel + 表格：Version / Env / Status / When / By / Strategy。
 * 保留全部原有筛选/分页/搜索状态逻辑。
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Search } from "lucide-react";
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
  StatusBadge,
  ColumnHead,
  type BadgeTone,
} from "@/components/blueprint";

interface Deployment {
  id: string;
  name: string;
  status: string;
  date: string;
}

function statusToBadgeTone(status: string): BadgeTone {
  switch (status) {
    case "success":
    case "ok":
      return "ok";
    case "running":
    case "info":
      return "info";
    case "failed":
    case "fail":
      return "fail";
    case "warn":
      return "warn";
    default:
      return "muted";
  }
}

/** Map old deployment name to a version string */
function nameToVersion(_name: string, idx: number): string {
  const versions = [
    "v2.4.0-rc.3",
    "v2.4.0-rc.2",
    "v2.3.8",
    "v2.3.7",
    "v2.3.6",
    "v2.3.5",
  ];
  return versions[idx] ?? `v0.${idx}.0`;
}

/** Map name to environment */
function nameToEnv(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("prod")) return "production";
  if (lower.includes("stag")) return "staging";
  if (lower.includes("dev")) return "dev";
  if (lower.includes("test")) return "dev";
  if (lower.includes("qa")) return "staging";
  if (lower.includes("preview")) return "dev";
  return "dev";
}

const Deployments: FC = () => {
  const [deployments] = useState<Deployment[]>([
    { id: "1", name: "Production Deployment", status: "success", date: "2024-01-20" },
    { id: "2", name: "Staging Deployment",    status: "success", date: "2024-01-19" },
    { id: "3", name: "Development Deployment",status: "running", date: "2024-01-20" },
    { id: "4", name: "Test Deployment",       status: "success", date: "2024-01-18" },
    { id: "5", name: "QA Deployment",         status: "failed",  date: "2024-01-17" },
    { id: "6", name: "Preview Deployment",    status: "success", date: "2024-01-16" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(5);

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

  const totalPages = Math.ceil(filteredDeployments.length / pageSize);
  const paginatedDeployments = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredDeployments.slice(startIndex, startIndex + pageSize);
  }, [filteredDeployments, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Search deployments…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Deployments"
          sub={`Last ${filteredDeployments.length} of ${deployments.length} deployments`}
        />

        {filteredDeployments.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
            No deployments match your search.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHead>Version</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Env</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Status</ColumnHead></TableHead>
                  <TableHead><ColumnHead>When</ColumnHead></TableHead>
                  <TableHead className="text-right"><ColumnHead>Strategy</ColumnHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeployments.map((deployment, idx) => (
                  <TableRow key={deployment.id}>
                    <TableCell className="font-mono text-[12.5px] font-medium">
                      {nameToVersion(deployment.name, (pageNum - 1) * pageSize + idx)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {nameToEnv(deployment.name)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusToBadgeTone(deployment.status)}>
                        {deployment.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-[13px] text-fg-muted">
                      {deployment.date}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-fg-muted">
                      rolling
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
                  total={filteredDeployments.length}
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

export default Deployments;
