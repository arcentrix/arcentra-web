/**
 * Project Environments 标签面板 — Engineering Blueprint 重做
 * 3列环境卡片网格（参照 Deploy.jsx 环境卡模式）。
 * 保留全部筛选/搜索/分页状态逻辑。
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Panel,
  MetaRow,
  SectionEyebrow,
  StatusDot,
  type DotTone,
} from "@/components/blueprint";

interface Environment {
  name: string;
  status: string;
  url: string;
}

function statusToDotTone(status: string): DotTone {
  switch (status) {
    case "active":
    case "ok":
      return "ok";
    case "rolling":
    case "info":
      return "running";
    case "inactive":
      return "muted";
    case "warn":
      return "warn";
    default:
      return "muted";
  }
}

/** Derive a region label from env name */
function envToRegion(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "production") return "eu-west-1";
  if (lower === "staging") return "eu-west-1";
  if (lower === "development") return "us-east-2";
  if (lower === "testing") return "us-east-2";
  if (lower === "qa") return "us-east-2";
  if (lower === "preview") return "us-east-2";
  return "—";
}

/** Derive a revision label */
function envToRevision(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "production") return "v2.3.7";
  if (lower === "staging") return "v2.4.0-rc.2";
  return "v2.4.0-rc.3";
}

/** Derive a deploy strategy */
function envToStrategy(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "production") return "canary 25%";
  if (lower === "staging") return "rolling";
  return "recreate";
}

const Environments: FC = () => {
  const [environments] = useState<Environment[]>([
    { name: "Production",  status: "active",   url: "https://prod.example.com" },
    { name: "Staging",     status: "active",   url: "https://staging.example.com" },
    { name: "Development", status: "active",   url: "https://dev.example.com" },
    { name: "Testing",     status: "active",   url: "https://test.example.com" },
    { name: "QA",          status: "inactive", url: "https://qa.example.com" },
    { name: "Preview",     status: "active",   url: "https://preview.example.com" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(6);

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

  const totalPages = Math.ceil(filteredEnvironments.length / pageSize);
  const paginatedEnvironments = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredEnvironments.slice(startIndex, startIndex + pageSize);
  }, [filteredEnvironments, pageNum, pageSize]);

  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Search environments…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {/* 3-col env card grid */}
      {filteredEnvironments.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
          No environments match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedEnvironments.map((env) => {
            const isProd = env.name.toLowerCase() === "production";
            const isRolling = isProd && env.status === "active";
            const dotTone = isRolling ? "running" : statusToDotTone(env.status);
            const pulse = isRolling;

            return (
              <Panel key={env.name}>
                {/* Card body */}
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <SectionEyebrow>{envToRegion(env.name)}</SectionEyebrow>
                    <StatusDot tone={dotTone} pulse={pulse} />
                  </div>
                  <h3 className="display mt-2.5 text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                    {env.name.toLowerCase()}
                  </h3>
                  <div className="mt-1 font-mono text-[11.5px] text-fg-subtle truncate">
                    {env.url}
                  </div>
                  <div className="mt-4 flex flex-col gap-1.5">
                    <MetaRow label="Revision" value={envToRevision(env.name)} mono />
                    <MetaRow
                      label="State"
                      value={isRolling ? "rolling 4/8" : env.status}
                      mono={false}
                    />
                    <MetaRow label="Strategy" value={envToStrategy(env.name)} mono={false} />
                    <MetaRow
                      label="Protect"
                      value={isProd ? "yes" : "no"}
                      mono
                    />
                  </div>
                </div>
                {/* Card footer actions */}
                <div className="flex items-center gap-1.5 border-t px-4 py-3">
                  <Button variant="outline" size="sm">Open</Button>
                  <Button variant="ghost" size="sm">Promote</Button>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Logs
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="border-t pt-3">
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
