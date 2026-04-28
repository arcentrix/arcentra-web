import { useState, useEffect } from "react";
import {
  Edit,
  Users as UsersIcon,
  Search,
  Shield,
  Mail,
  UserPlus,
  Lock,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserManagementDialog } from "@/components/user-management-dialog";
import { ResetPasswordDialog } from "@/components/reset-password-dialog";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";
import type {
  User,
  UpdateUserRequest,
  UserListResponse,
} from "@/api/user-management/types";
import type { Role } from "@/api/role/types";
import { Apis } from "@/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("");

  // 只在首次加载时获取角色列表
  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    setPageNum(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterRole, filterStatus]);

  // 当页码、搜索条件或筛选条件变化时，加载用户列表
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, searchTerm, filterRole, filterStatus]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let response: UserListResponse;

      // 如果选择了角色筛选，使用按角色查询接口
      if (filterRole !== "all") {
        response = await Apis.user_management.listUsersByRole(
          filterRole,
          pageNum,
          pageSize,
        );
      } else {
        // 否则使用普通用户列表接口
        response = await Apis.user_management.listUsers(pageNum, pageSize, {
          search: searchTerm || undefined,
          status: filterStatus !== "all" ? filterStatus : undefined,
        });
      }

      // 如果有搜索词或状态筛选，在前端进行二次筛选
      let filteredUsers = response.users;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredUsers = filteredUsers.filter(
          (user) =>
            user.username.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term) ||
            (user.fullName && user.fullName.toLowerCase().includes(term)),
        );
      }
      if (filterStatus !== "all") {
        if (filterStatus === "active") {
          filteredUsers = filteredUsers.filter((user) => user.isEnabled === 1);
        } else if (filterStatus === "inactive") {
          filteredUsers = filteredUsers.filter((user) => user.isEnabled === 0);
        }
      }

      setUsers(filteredUsers);
      // 如果进行了前端筛选，使用筛选后的数量；否则使用后端返回的总数
      setTotalCount(
        searchTerm || filterStatus !== "all"
          ? filteredUsers.length
          : response.count || 0,
      );
    } catch (error) {
      toast.error("Failed to load users");
      console.error("Load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await Apis.role.listRoles(1, 100); // 获取所有角色
      setRoles(response.roles);
      // 设置默认角色为第一个可用角色
      if (response.roles.length > 0 && !inviteRole) {
        setInviteRole(response.roles[0].roleId);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await Apis.user_management.updateUser(user.userId, {
        isEnabled: user.isEnabled === 0 ? 1 : 0,
      });
      toast.success(user.isEnabled === 1 ? "User disabled" : "User enabled");
      await loadUsers();
    } catch (error) {
      toast.error("Failed to toggle user status");
      console.error("Toggle failed:", error);
    }
  };

  const handleSubmit = async (data: UpdateUserRequest) => {
    if (selectedUser) {
      await Apis.user_management.updateUser(selectedUser.userId, data);
    }
    await loadUsers();
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await Apis.user_management.inviteUser({
        email: inviteEmail,
        role: inviteRole as any,
      });
      toast.success("Invitation sent successfully");
      setInviteEmail("");
      setInviteRole("user");
      setInviteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to send invitation");
      console.error("Invite failed:", error);
    }
  };

  // 使用后端分页，直接使用返回的用户列表
  const totalPages = Math.ceil(totalCount / pageSize);

  const getRoleVariant = (
    priority: number,
  ): "critical" | "warning" | "info" | "secondary" => {
    if (priority >= 50) return "critical";
    if (priority >= 40) return "warning";
    if (priority >= 30) return "info";
    return "secondary";
  };

  const getRoleBadge = (user: User) => {
    const roleName = user.roleName;
    const roleValue = user.role;

    const findRole = () => {
      if (roleName) {
        return roles.find(
          (r) => r.name === roleName || r.displayName === roleName,
        );
      }
      if (!roleValue) return undefined;
      return (
        roles.find((r) => r.roleId === roleValue) ||
        roles.find((r) => r.name === roleValue) ||
        roles.find(
          (r) =>
            r.roleId.toLowerCase() === roleValue.toLowerCase() ||
            r.name.toLowerCase() === roleValue.toLowerCase(),
        )
      );
    };

    const role = findRole();
    const displayName = roleName || roleValue || "Unknown";
    const Icon = role?.isBuiltin === 1 ? Crown : Shield;
    const variant = role ? getRoleVariant(role.priority) : "secondary";

    return (
      <Badge variant={variant}>
        <Icon className="mr-1 h-3 w-3" />
        {role?.name || displayName}
      </Badge>
    );
  };

  const getInvitationStatusBadge = (status?: string) => {
    if (!status) return null;

    const variantMap: Record<
      string,
      {
        label: string;
        variant: "warning" | "success" | "secondary" | "critical";
      }
    > = {
      pending: { label: "Pending", variant: "warning" },
      accepted: { label: "Accepted", variant: "success" },
      expired: { label: "Expired", variant: "secondary" },
      revoked: { label: "Revoked", variant: "critical" },
    };
    const mapped = variantMap[status] || {
      label: status,
      variant: "secondary" as const,
    };
    return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
  };

  return (
    <>
      <section className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              User Management
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage system users and their permissions
            </p>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Users
                </CardTitle>
                <CardDescription>
                  View and manage all system users
                </CardDescription>
              </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, email, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.roleId} value={role.roleId}>
                      {role.name}
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[160px]" />
                    </div>
                    <Skeleton className="h-6 w-[80px] rounded-full" />
                    <Skeleton className="h-6 w-[60px] rounded-full" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <UsersIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {totalCount === 0
                    ? "No users found"
                    : "No users match your filters"}
                </p>
                {totalCount === 0 ? (
                  <Button onClick={() => setInviteDialogOpen(true)}>
                    <Mail className="mr-2 h-4 w-4" />
                    Invite Your First User
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterRole("all");
                      setFilterStatus("all");
                      setPageNum(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invitation</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.avatar || DEFAULT_USER_AVATAR}
                              />
                              <AvatarFallback>
                                {user.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.username}</div>
                              {user.fullName && (
                                <div className="text-sm text-muted-foreground">
                                  {user.fullName}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user)}</TableCell>
                        <TableCell>
                          {user.isEnabled === 1 ? (
                            <Badge variant="success">
                              <Power className="mr-1 h-3 w-3" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <PowerOff className="mr-1 h-3 w-3" />
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getInvitationStatusBadge(user.invitationStatus)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lastLoginAt && user.lastLoginAt !== "null"
                            ? (() => {
                                const date = new Date(user.lastLoginAt);
                                const year = date.getFullYear();
                                const month = date.getMonth() + 1;
                                const day = date.getDate();
                                const hours = date
                                  .getHours()
                                  .toString()
                                  .padStart(2, "0");
                                const minutes = date
                                  .getMinutes()
                                  .toString()
                                  .padStart(2, "0");
                                const seconds = date
                                  .getSeconds()
                                  .toString()
                                  .padStart(2, "0");
                                return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
                              })()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(user)}
                              aria-label={
                                user.isEnabled === 1
                                  ? "Disable user"
                                  : "Enable user"
                              }
                            >
                              {user.isEnabled === 1 ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleResetPassword(user)}
                              aria-label="Reset password"
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(user)}
                              aria-label="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="mt-4 pt-4 border-t">
                    <DataTablePagination
                      page={pageNum}
                      pageSize={pageSize}
                      total={totalCount}
                      onPageChange={setPageNum}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <UserManagementDialog
        key={selectedUser?.userId || "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        roles={roles}
        onSubmit={handleSubmit}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        userId={selectedUser?.userId || null}
        username={selectedUser?.username || null}
      />

      {/* 邀请用户对话框 */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email *</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="inviteRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => {
                    const scopeLabel =
                      role.scope === "org"
                        ? "Organization"
                        : role.scope === "team"
                          ? "Team"
                          : role.scope === "project"
                            ? "Project"
                            : role.scope;
                    return (
                      <SelectItem key={role.roleId} value={role.roleId}>
                        {role.name} ({scopeLabel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite}>
              <UserPlus className="h-4 w-4 mr-1" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
