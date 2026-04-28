import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Search,
  Power,
  PowerOff,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RoleConfigDialog } from "@/components/role-config-dialog";
import { DataTablePagination } from "@/components/data-table-pagination";
import { toast } from "@/lib/toast";
import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from "@/api/role/types";
import { Apis } from "@/api";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const loadingRef = useRef(false);
  const paramsRef = useRef<string>("");

  // 当搜索或筛选条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
  }, [searchTerm, filterScope, filterStatus]);

  // 统一的数据加载逻辑：当页码、搜索条件或筛选条件变化时加载
  useEffect(() => {
    // 如果有搜索或筛选条件，加载所有数据（使用较大的 pageSize）用于前端筛选
    // 否则使用正常的分页
    const params =
      searchTerm || filterScope !== "all" || filterStatus !== "all"
        ? { pageNum: 1, pageSize: 1000 } // 加载足够多的数据用于前端筛选
        : { pageNum, pageSize };

    // 生成参数的唯一标识，用于防止重复请求
    const paramsKey = JSON.stringify({
      ...params,
      filterScope: filterScope !== "all" ? filterScope : undefined,
    });

    // 防止重复请求：如果正在加载或参数没有变化，则跳过
    if (loadingRef.current || paramsRef.current === paramsKey) {
      return;
    }

    loadingRef.current = true;
    paramsRef.current = paramsKey;
    setLoading(true);

    Apis.role
      .listRoles(
        params.pageNum,
        params.pageSize,
        filterScope !== "all" ? filterScope : undefined,
      )
      .then((response) => {
        // 确保参数仍然匹配（防止快速切换导致的状态混乱）
        if (paramsRef.current === paramsKey) {
          setRoles(response.roles.sort((a, b) => b.priority - a.priority));
          setTotalCount(response.total);
        }
      })
      .catch((error) => {
        if (paramsRef.current === paramsKey) {
          toast.error("Failed to load roles");
          console.error("Load failed:", error);
        }
      })
      .finally(() => {
        if (paramsRef.current === paramsKey) {
          setLoading(false);
          loadingRef.current = false;
        }
      });

    // 清理函数：当参数变化时，取消之前的请求
    return () => {
      if (paramsRef.current !== paramsKey) {
        loadingRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pageSize, searchTerm, filterScope, filterStatus]);

  const handleCreate = () => {
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const handleEdit = async (role: Role) => {
    try {
      // 先设置选中角色并打开对话框，使用列表中的角色数据
      setSelectedRole(role);
      setDialogOpen(true);

      // 然后异步加载完整角色详情
      try {
        const fullRole = await Apis.role.getRole(role.roleId);
        setSelectedRole(fullRole);
      } catch (error) {
        console.warn(
          "Failed to load full role details, using list data:",
          error,
        );
        // 如果加载失败，继续使用列表中的角色数据
      }
    } catch (error) {
      toast.error("Failed to open edit dialog");
      console.error("Edit failed:", error);
    }
  };

  const reloadRoles = async () => {
    // 重置 ref 以允许重新加载
    const oldParamsKey = paramsRef.current;
    paramsRef.current = "";
    loadingRef.current = false;

    // 触发重新加载（通过触发 useEffect）
    const params =
      searchTerm || filterScope !== "all" || filterStatus !== "all"
        ? { pageNum: 1, pageSize: 1000 }
        : { pageNum, pageSize };

    const paramsKey = JSON.stringify({
      ...params,
      filterScope: filterScope !== "all" ? filterScope : undefined,
    });

    // 如果参数没有变化，不需要重新加载
    if (oldParamsKey === paramsKey) {
      return;
    }

    loadingRef.current = true;
    paramsRef.current = paramsKey;
    setLoading(true);

    try {
      const response = await Apis.role.listRoles(
        params.pageNum,
        params.pageSize,
        filterScope !== "all" ? filterScope : undefined,
      );
      if (paramsRef.current === paramsKey) {
        setRoles(response.roles.sort((a, b) => b.priority - a.priority));
        setTotalCount(response.total);
      }
    } catch (error) {
      if (paramsRef.current === paramsKey) {
        toast.error("Failed to reload roles");
        console.error("Reload failed:", error);
        // 确保即使出错也设置 loading 为 false，避免页面一直显示加载状态
        setLoading(false);
      }
    } finally {
      if (paramsRef.current === paramsKey) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const handleSubmit = async (data: CreateRoleRequest | UpdateRoleRequest) => {
    try {
      if (selectedRole) {
        await Apis.role.updateRole(
          selectedRole.roleId,
          data as UpdateRoleRequest,
        );
      } else {
        await Apis.role.createRole(data as CreateRoleRequest);
      }
      // 关闭对话框
      setDialogOpen(false);
      setSelectedRole(null);
      // 重新加载数据
      await reloadRoles();
    } catch (error) {
      // 错误已经在 API 调用中处理，这里不需要额外处理
      throw error;
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) {
      return;
    }

    try {
      await Apis.role.deleteRole(roleId);
      toast.success("Role deleted successfully");
      await reloadRoles();
    } catch (error) {
      toast.error("Failed to delete role");
      console.error("Delete failed:", error);
    }
  };

  const handleToggleStatus = async (role: Role) => {
    try {
      await Apis.role.toggleRole(role.roleId);
      toast.success(role.isEnabled === 1 ? "Role disabled" : "Role enabled");
      await reloadRoles();
    } catch (error) {
      toast.error("Failed to toggle role status");
      console.error("Toggle failed:", error);
    }
  };

  // 获取所有唯一的 scope 值
  const availableScopes = useMemo(() => {
    const scopes = Array.from(
      new Set(
        roles.map((role) => role.scope).filter((scope) => Boolean(scope)), // 过滤掉 undefined/null/空字符串
      ),
    ) as string[];
    return scopes.sort();
  }, [roles]);

  // 过滤和搜索
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      // 按作用域筛选
      if (filterScope !== "all" && role.scope !== filterScope) {
        return false;
      }

      // 按状态筛选
      if (filterStatus === "enabled" && role.isEnabled !== 1) {
        return false;
      }
      if (filterStatus === "disabled" && role.isEnabled !== 0) {
        return false;
      }

      // 按搜索词筛选
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          role.name.toLowerCase().includes(term) ||
          (role.displayName && role.displayName.toLowerCase().includes(term)) ||
          (role.description && role.description.toLowerCase().includes(term))
        );
      }

      return true;
    });
  }, [roles, filterScope, filterStatus, searchTerm]);

  // 如果有搜索或筛选条件，使用前端筛选后的结果进行分页
  // 否则使用服务端分页
  const hasFilters =
    searchTerm || filterScope !== "all" || filterStatus !== "all";
  const totalPages = hasFilters
    ? Math.ceil(filteredRoles.length / pageSize)
    : Math.ceil(totalCount / pageSize);

  // 如果有筛选条件，使用前端分页；否则使用服务端分页
  const displayRoles = hasFilters
    ? filteredRoles.slice((pageNum - 1) * pageSize, pageNum * pageSize)
    : filteredRoles;

  const getScopeBadge = (scope: string | undefined) => {
    // 统一使用低饱和灰调
    if (!scope) {
      return (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-600 border border-gray-200"
        >
          Unknown
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-gray-50 text-gray-600 border border-gray-200"
      >
        {scope}
      </Badge>
    );
  };

  const getScopeLabel = (scope: string) => {
    if (!scope) {
      return "Unknown";
    }
    const labels: Record<string, string> = {
      org: "Organization",
      team: "Team",
      project: "Project",
    };
    return labels[scope] || scope.charAt(0).toUpperCase() + scope.slice(1);
  };

  return (
    <>
      <section className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Role Management
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage roles and their permissions
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Roles
                </CardTitle>
                <CardDescription>
                  View and manage system roles and permissions
                </CardDescription>
              </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterScope} onValueChange={setFilterScope}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scopes</SelectItem>
                  {availableScopes.map((scope, idx) => (
                    <SelectItem key={`scope-${scope}-${idx}`} value={scope}>
                      {getScopeLabel(scope)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : displayRoles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {roles.length === 0
                    ? "No roles found"
                    : "No roles match your filters"}
                </p>
                {roles.length === 0 ? (
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Role
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterScope("all");
                      setFilterStatus("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {role.displayName || role.name}
                          </div>
                          {role.displayName && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {role.name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getScopeBadge(role.scope)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-gray-500 border border-gray-200 bg-gray-50"
                        >
                          {role.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {role.isBuiltin === 1 ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-700 border border-amber-200"
                          >
                            <Crown className="mr-1 h-3 w-3" />
                            Built-in
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-600 border border-gray-200"
                          >
                            Custom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.isEnabled === 1 ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-600 border border-emerald-200"
                          >
                            <Power className="mr-1 h-3 w-3" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-500 border border-gray-200"
                          >
                            <PowerOff className="mr-1 h-3 w-3" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.permissions && role.permissions.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                                {role.permissions.length} permissions
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">
                                  Permissions
                                </h4>
                                <div className="max-h-60 overflow-y-auto">
                                  <div className="flex flex-wrap gap-1.5">
                                    {role.permissions.map((permission, idx) => (
                                      <Badge
                                        key={`${role.roleId}-${permission}-${idx}`}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {permission}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No permissions
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {role.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(role)}
                            disabled={role.isBuiltin === 1}
                          >
                            {role.isEnabled === 1 ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(role.roleId)}
                            className="text-red-500 hover:text-red-700"
                            disabled={role.isBuiltin === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* 分页控件 */}
            {!loading && filteredRoles.length > 0 && (
              <div className="pt-4 border-t">
                {totalPages > 1 && (
                  <div className="mt-4 pt-4 border-t">
                    <DataTablePagination
                      page={pageNum}
                      pageSize={pageSize}
                      total={hasFilters ? filteredRoles.length : totalCount}
                      onPageChange={setPageNum}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RoleConfigDialog
        key={selectedRole?.roleId || "new"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // 关闭对话框时重置选中角色
            setSelectedRole(null);
          }
        }}
        role={selectedRole}
        onSubmit={handleSubmit}
      />
    </>
  );
}
