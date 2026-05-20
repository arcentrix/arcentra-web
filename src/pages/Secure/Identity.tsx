import { useEffect, useState, type FC } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Bot,
  Crown,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AnnouncementDialog,
  AnnouncementDialogFooter,
} from "@/components/ui/announcement-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { RoleConfigDialog } from "@/components/role-config-dialog";
import { Apis } from "@/api";
import { toast } from "@/lib/toast";
import type { User, UpdateUserRequest } from "@/api/user-management/types";
import type { Role } from "@/api/role/types";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";

function slugifyRoleId(name: string): string {
  const base = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `role-${Date.now()}`;
}

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


interface UsersPanelProps {
  /**
   * Whether the invite-user dialog should be open. Owned by the parent
   * (`Secure/index.tsx`) so the global "Invite Member" header button can drive
   * it from outside this panel.
   */
  inviteOpen?: boolean;
  onInviteOpenChange?: (open: boolean) => void;
}

function UsersPanel({
  inviteOpen = false,
  onInviteOpenChange,
}: UsersPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchUsers = async () => {
    const response = await Apis.user_management.listUsers(1, 50);
    setUsers(response.users ?? []);
  };

  // Default the invite role to the first available role once roles load.
  useEffect(() => {
    if (inviteOpen && roles.length > 0 && !inviteRoleId) {
      setInviteRoleId(roles[0].roleId);
    }
  }, [inviteOpen, roles, inviteRoleId]);

  // Reset the email field whenever the dialog closes, no matter who closed it
  // (Cancel button, Esc/overlay, or the parent driving it externally).
  useEffect(() => {
    if (!inviteOpen) setInviteEmail("");
  }, [inviteOpen]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Email required", "Please enter an email address.");
      return;
    }
    setInviting(true);
    try {
      await Apis.user_management.inviteUser({
        email,
        // Backend expects a role identifier; the typed `UserRole` union is
        // narrower than the actual accepted values so we widen here.
        role: (inviteRoleId || undefined) as never,
      });
      toast.success("Invitation sent", `An invite was emailed to ${email}.`);
      onInviteOpenChange?.(false);
      setInviteEmail("");
      await fetchUsers();
    } catch (err) {
      toast.error(
        "Failed to send invitation",
        (err as Error)?.message || undefined,
      );
    } finally {
      setInviting(false);
    }
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

  const renderContent = () => {
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
            {users.map((user, idx) => {
            const displayName = user.fullName || user.username;
            const role = user.roleName || user.role || "—";
            const isAdmin = user.isSuperAdmin === 1 || user.role === "admin";
            // Backend has occasionally returned rows without `userId` or with
            // duplicate ids; fall back to the row index so React can still
            // diff the list reliably.
            return (
              <TableRow key={`${user.userId || "row"}-${idx}`}>
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
                <TableCell>
                  <Switch
                    checked={user.isEnabled === 1}
                    onCheckedChange={() => handleToggleStatus(user)}
                    disabled={togglingId === user.userId}
                    aria-label={`Toggle ${user.fullName || user.username}`}
                  />
                </TableCell>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

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

      <AnnouncementDialog
        open={inviteOpen}
        onOpenChange={(open) => onInviteOpenChange?.(open)}
        icon={UserPlus}
        iconTone="info"
        title="Invite member"
        description="Send an invitation email to add a new member to this workspace."
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identity-invite-email">Email *</Label>
            <Input
              id="identity-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="identity-invite-role">Role</Label>
            <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
              <SelectTrigger id="identity-invite-role">
                <SelectValue placeholder="Select a role" />
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
          <AnnouncementDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onInviteOpenChange?.(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviting || !inviteEmail.trim() || roles.length === 0}
              className="gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              {inviting ? "Sending…" : "Send invitation"}
            </Button>
          </AnnouncementDialogFooter>
        </form>
      </AnnouncementDialog>
    </>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchRoles = async () => {
    const response = await Apis.role.listRoles(1, 50);
    setRoles(response.roles ?? []);
  };

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

  const handleAddRole = () => {
    setEditingRole(null);
    setConfigOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setConfigOpen(true);
  };

  const handleConfigSubmit = async (data: {
    name: string;
    displayName?: string;
    description?: string;
    scope: Role["scope"];
    priority: number;
    permissions?: string[];
    isEnabled?: number;
  }) => {
    if (editingRole) {
      await Apis.role.updateRole(editingRole.roleId, data);
    } else {
      const roleId = slugifyRoleId(data.name);
      await Apis.role.createRole({ ...data, roleId });
    }
    await fetchRoles();
  };

  const handleToggleRole = async (role: Role) => {
    if (role.isBuiltin === 1) {
      toast.error(
        "Cannot toggle built-in role",
        "Built-in roles cannot be disabled.",
      );
      return;
    }
    setTogglingId(role.roleId);
    setRoles((prev) =>
      prev.map((r) =>
        r.roleId === role.roleId
          ? { ...r, isEnabled: r.isEnabled === 1 ? 0 : 1 }
          : r,
      ),
    );
    try {
      await Apis.role.toggleRole(role.roleId);
      toast.success(role.isEnabled === 1 ? "Role disabled" : "Role enabled");
    } catch (err) {
      // rollback
      setRoles((prev) =>
        prev.map((r) =>
          r.roleId === role.roleId ? { ...r, isEnabled: role.isEnabled } : r,
        ),
      );
      toast.error(
        "Failed to toggle role",
        (err as Error)?.message || undefined,
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isBuiltin === 1) {
      toast.error(
        "Cannot delete built-in role",
        "Built-in roles cannot be deleted.",
      );
      return;
    }
    const confirmed = window.confirm(
      `Delete role "${role.displayName || role.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await Apis.role.deleteRole(role.roleId);
      toast.success("Role deleted");
      await fetchRoles();
    } catch (err) {
      toast.error(
        "Failed to delete role",
        (err as Error)?.message || undefined,
      );
    }
  };

  const renderContent = () => {
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
            {roles.map((role, idx) => (
              <TableRow key={`${role.roleId || "row"}-${idx}`}>
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
                  <Switch
                    checked={role.isEnabled === 1}
                    onCheckedChange={() => handleToggleRole(role)}
                    disabled={togglingId === role.roleId || role.isBuiltin === 1}
                    aria-label={`Toggle ${role.displayName || role.name}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        aria-label="Manage role"
                        disabled={togglingId === role.roleId}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleEditRole(role)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                        Edit role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => handleDeleteRole(role)}
                        disabled={role.isBuiltin === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete role
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={handleAddRole}
          disabled={loading}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New role
        </Button>
      </div>

      {renderContent()}

      <RoleConfigDialog
        open={configOpen}
        onOpenChange={(open) => {
          setConfigOpen(open);
          if (!open) setEditingRole(null);
        }}
        role={editingRole}
        onSubmit={handleConfigSubmit}
      />
    </div>
  );
}

interface SecureIdentityProps {
  /** Controlled state for the global "Invite Member" dialog. */
  inviteOpen?: boolean;
  onInviteOpenChange?: (open: boolean) => void;
}

const SecureIdentity: FC<SecureIdentityProps> = ({
  inviteOpen,
  onInviteOpenChange,
}) => {
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
        <UsersPanel
          inviteOpen={inviteOpen}
          onInviteOpenChange={onInviteOpenChange}
        />
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
