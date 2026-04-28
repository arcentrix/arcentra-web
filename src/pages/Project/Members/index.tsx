/**
 * Project Members 页面
 */

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/data-table-pagination";

const Members: FC = () => {
  const [members] = useState([
    {
      name: "John Doe",
      email: "john@example.com",
      role: "Owner",
      avatar: "JD",
    },
    {
      name: "Jane Smith",
      email: "jane@example.com",
      role: "Admin",
      avatar: "JS",
    },
    {
      name: "Bob Johnson",
      email: "bob@example.com",
      role: "Member",
      avatar: "BJ",
    },
    {
      name: "Alice Brown",
      email: "alice@example.com",
      role: "Member",
      avatar: "AB",
    },
    {
      name: "Charlie Wilson",
      email: "charlie@example.com",
      role: "Admin",
      avatar: "CW",
    },
    {
      name: "Diana Prince",
      email: "diana@example.com",
      role: "Member",
      avatar: "DP",
    },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(5);

  // 筛选逻辑
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

  // 分页计算
  const totalPages = Math.ceil(filteredMembers.length / pageSize);
  const paginatedMembers = useMemo(() => {
    const startIndex = (pageNum - 1) * pageSize;
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, pageNum, pageSize]);

  // 当搜索条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchTerm]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            Members
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage project team members
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members by name, email, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-4">
        {paginatedMembers.map((member) => (
          <Card key={member.email}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>{member.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{member.name}</CardTitle>
                    <CardDescription>{member.email}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant={member.role === "Owner" ? "default" : "secondary"}
                >
                  {member.role}
                </Badge>
              </div>
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
            total={filteredMembers.length}
            onPageChange={setPageNum}
          />
        </div>
      )}
    </div>
  );
};

export default Members;
