import { useEffect, useState, type FC } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Bot,
  Crown,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import { UserManagementDialog } from "@/components/user-management-dialog";
import { ResetPasswordDialog } from "@/components/reset-password-dialog";
import { Apis } from "@/api";
import { toast } from "@/lib/toast";
import type { User, UpdateUserRequest } from "@/api/user-management/types";
import type { Role } from "@/api/role/types";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";

dayjs.extend(relativeTime);

function formatRelative(value?: string | null) {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.fromNow() : "—";
}

function getInitials(user: User) {
  const source = user.fullName || user.username || user.email || "??";
  return source.slice(0, 2).toUpperCase();
}

function userStatusBadge(user: User) {
  if (user.invitationStatus === "pending")
    return <Badge variant="warning">Invited</Badge>;
  if (user.invitationStatus === "expired")
    return <Badge variant="secondary">Expired</Badge>;
  if (user.invitationStatus === "revoked")
    return <Badge variant="destructive">Revoked</Badge>;
  if (user.isEnabled === 0) return <Badge variant="secondary">Disabled</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    const response = await Apis.user_management.listUsers(1, 50);
    setUsers(response.users ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersResponse, rolesResponse] = await Promise.all([
          Apis.user_management.listUsers(1, 50),
          Apis.role.listRoles(1, 100).catch(() => ({ roles: [] as Role[] })),
        ]);
        if (!cancelled) {
          setUsers(usersResponse.users ?? []);
          setRoles(rolesResponse.roles ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          const message = (err as Error)?.message || "Failed to load users";
          setError(message);
          toast.error("Failed to load users", message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEdit = (user: User) => {
    setEditTarget(user);
    setEditOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setResetTarget(user);
    setResetOpen(true);
  };

  const handleEditSubmit = async (data: UpdateUserRequest) => {
    if (!editTarget) return;
    await Apis.user_management.updateUser(editTarget.userId, data);
    await fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    const next = user.isEnabled === 1 ? 0 : 1;
    setTogglingId(user.userId);
    // optimistic update
    setUsers((prev) =>
      prev.map((u) =>
        u.userId === user.userId ? { ...u, isEnabled: next } : u,
      ),
    );
    try {
      await Apis.user_management.updateUser(user.userId, { isEnabled: next });
      toast.success(
        next === 1 ? "User enabled" : "User disabled",
        `${user.fullName || user.username} is now ${next === 1 ? "active" : "disabled"}.`,
      );
    } catch (err) {
      // rollback
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === user.userId ? { ...u, isEnabled: user.isEnabled } : u,
        ),
      );
      toast.error(
        "Failed to update status",
        (err as Error)?.message || "Unknown error",
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <PlaceholderPanel
        icon={UsersRound}
        title="Could not load users"
        description={error}
      />
    );
  }

  if (users.length === 0) {
    return (
      <PlaceholderPanel
        icon={UsersRound}
        title="No users yet"
        description="Invite teammates to start collaborating in this workspace."
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const displayName = user.fullName || user.username;
            const role = user.roleName || user.role || "—";
            const isAdmin = user.isSuperAdmin === 1 || user.role === "admin";
            return (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        alt={displayName}
                        src={user.avatar || DEFAULT_USER_AVATAR}
                      />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium">
                        {displayName}
                      </div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                      {role}
                    </span>
                  ) : (
                    <span className="text-sm capitalize">{role}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelative(user.lastLoginAt)}
                </TableCell>
                <TableCell>{userStatusBadge(user)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        aria-label="Manage user"
                        disabled={togglingId === user.userId}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                        Edit user
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleResetPassword(user)}
                      >
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        Reset password
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.isEnabled === 1 ? (
                          <>
                            <PowerOff className="h-4 w-4 text-muted-foreground" />
                            Disable user
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 text-muted-foreground" />
                            Enable user
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UserManagementDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTarget(null);
        }}
        user={editTarget}
        roles={roles}
        onSubmit={handleEditSubmit}
      />
      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setResetTarget(null);
        }}
        userId={resetTarget?.userId ?? null}
        username={resetTarget?.username ?? null}
      />
    </div>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await Apis.role.listRoles(1, 50);
        if (!cancelled) setRoles(response.roles ?? []);
      } catch (err) {
        if (!cancelled) {
          const message = (err as Error)?.message || "Failed to load roles";
          setError(message);
          toast.error("Failed to load roles", message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && roles.length === 0) {
    return (
      <PlaceholderPanel
        icon={ShieldCheck}
        title="Could not load roles"
        description={error}
      />
    );
  }

  if (roles.length === 0) {
    return (
      <PlaceholderPanel
        icon={ShieldCheck}
        title="No roles yet"
        description="Define roles and permissions to start managing access."
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.roleId}>
              <TableCell>
                <div className="font-medium">
                  {role.displayName || role.name}
                </div>
                {role.description && (
                  <div className="line-clamp-1 text-xs text-muted-foreground">
                    {role.description}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {role.scope}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {role.permissions?.length ?? 0} permissions
              </TableCell>
              <TableCell>
                {role.isBuiltin === 1 ? (
                  <Badge variant="secondary">Built-in</Badge>
                ) : (
                  <Badge variant="info">Custom</Badge>
                )}
              </TableCell>
              <TableCell>
                {role.isEnabled === 1 ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const SecureIdentity: FC = () => {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="service-accounts">Service Accounts</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="mt-4">
        <UsersPanel />
      </TabsContent>

      <TabsContent value="teams" className="mt-4">
        <PlaceholderPanel
          icon={UsersRound}
          title="Teams"
          description="Group users into teams and assign permissions in bulk. API not yet available."
        />
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <RolesPanel />
      </TabsContent>

      <TabsContent value="service-accounts" className="mt-4">
        <PlaceholderPanel
          icon={Bot}
          title="Service accounts"
          description="Machine identities used by pipelines, agents and integrations. API not yet available."
        />
      </TabsContent>

      <TabsContent value="tokens" className="mt-4">
        <PlaceholderPanel
          icon={KeyRound}
          title="Personal & runner tokens"
          description="Create scoped tokens with expiry and rotation policies. API not yet available."
        />
      </TabsContent>
    </Tabs>
  );
};

export default SecureIdentity;
