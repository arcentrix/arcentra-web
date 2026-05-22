/**
 * Project Members 标签面板 — Engineering Blueprint 重做
 * Panel + 表格：User (avatar) / Role chip / Email / Action。
 * 保留全部搜索/分页/Add Member 按钮逻辑。
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface Member {
  name: string;
  email: string;
  role: string;
  avatar: string;
}

const Members: FC = () => {
  const [members] = useState<Member[]>([
    { name: "John Doe",       email: "john@example.com",    role: "Owner",  avatar: "JD" },
    { name: "Jane Smith",     email: "jane@example.com",    role: "Admin",  avatar: "JS" },
    { name: "Bob Johnson",    email: "bob@example.com",     role: "Member", avatar: "BJ" },
    { name: "Alice Brown",    email: "alice@example.com",   role: "Member", avatar: "AB" },
    { name: "Charlie Wilson", email: "charlie@example.com", role: "Admin",  avatar: "CW" },
    { name: "Diana Prince",   email: "diana@example.com",   role: "Member", avatar: "DP" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(5);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          member.name.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term) ||
          member.role.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [members, searchTerm]);

  const totalPages = Math.ceil(filteredMembers.length / pageSize);
  const paginatedMembers = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, pageNum, pageSize]);

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
            placeholder="Search members…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Button size="sm" className="ml-auto gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add member
        </Button>
      </div>

      <Panel>
        <PanelHeader
          title="Members"
          sub={`${filteredMembers.length} with access to this project`}
        />

        {filteredMembers.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-fg-muted">
            No members match your search.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColumnHead>User</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Role</ColumnHead></TableHead>
                  <TableHead><ColumnHead>Email</ColumnHead></TableHead>
                  <TableHead className="text-right"><ColumnHead>Action</ColumnHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.map((member) => {
                  const isOwner = member.role === "Owner";
                  return (
                    <TableRow key={member.email}>
                      {/* User cell: avatar + name */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="font-mono text-[10px]">
                              {member.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-[13px]">{member.name}</span>
                        </div>
                      </TableCell>
                      {/* Role chip */}
                      <TableCell>
                        <span
                          className="inline-flex h-[22px] items-center rounded px-2 font-mono text-[11px] font-medium"
                          style={{
                            color: isOwner
                              ? "var(--brand-signal)"
                              : "var(--fg-muted)",
                            border: `1px solid ${
                              isOwner
                                ? "var(--brand-signal-dim)"
                                : "var(--border)"
                            }`,
                          }}
                        >
                          {member.role}
                        </span>
                      </TableCell>
                      {/* Email */}
                      <TableCell className="text-[13px] text-fg-muted">
                        {member.email}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-[12px]">
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[12px] text-accent-danger hover:text-accent-danger"
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="border-t px-5 py-3">
                <DataTablePagination
                  page={pageNum}
                  pageSize={pageSize}
                  total={filteredMembers.length}
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

export default Members;
