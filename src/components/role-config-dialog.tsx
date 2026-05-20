import { useState, useEffect, useMemo } from "react";
import { Plus, Save, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnnouncementDialog,
  AnnouncementDialogFooter,
} from "@/components/ui/announcement-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";
import type { Role, RoleScope } from "@/api/role/types";
import type {
  PermissionDictGroup,
  PermissionDictItem,
} from "@/api/permission/types";

interface RoleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  onSubmit: (data: {
    name: string;
    displayName?: string;
    description?: string;
    scope: RoleScope;
    priority: number;
    permissions?: string[];
    isEnabled?: number;
  }) => Promise<void>;
}

export function RoleConfigDialog({
  open,
  onOpenChange,
  role,
  onSubmit,
}: RoleConfigDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    scope: "org" as RoleScope,
    priority: 0,
    isEnabled: true,
  });

  const [permissions, setPermissions] = useState<string[]>([]);
  const [newPermission, setNewPermission] = useState("");
  const [loading, setLoading] = useState(false);
  const [permissionGroups, setPermissionGroups] = useState<
    PermissionDictGroup[]
  >([]);
  const [permissionDictLoading, setPermissionDictLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPermissionDictLoading(true);
    Apis.permission
      .listPermissions()
      .then((response) => {
        if (cancelled) return;
        setPermissionGroups(response.groups ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Failed to load permission dictionary", error);
      })
      .finally(() => {
        if (!cancelled) setPermissionDictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const dictPermissionIds = useMemo(() => {
    const set = new Set<string>();
    permissionGroups.forEach((group) =>
      group.permissions.forEach((item) => set.add(item.permissionId)),
    );
    return set;
  }, [permissionGroups]);

  const customPermissions = useMemo(
    () => permissions.filter((p) => !dictPermissionIds.has(p)),
    [permissions, dictPermissionIds],
  );

  useEffect(() => {
    if (open) {
      if (role) {
        // 编辑模式：加载角色数据
        setFormData({
          name: role.name || "",
          displayName: role.displayName || "",
          description: role.description || "",
          scope: role.scope || "org",
          priority: role.priority || 0,
          isEnabled: role.isEnabled === 1,
        });
        setPermissions(role.permissions || []);
      } else {
        // 创建模式：重置表单
        setFormData({
          name: "",
          displayName: "",
          description: "",
          scope: "org",
          priority: 0,
          isEnabled: true,
        });
        setPermissions([]);
      }
    }
  }, [role, open]);

  const handleAddPermission = () => {
    if (newPermission && !permissions.includes(newPermission)) {
      setPermissions([...permissions, newPermission]);
      setNewPermission("");
    }
  };

  const handleRemovePermission = (permission: string) => {
    setPermissions(permissions.filter((p) => p !== permission));
  };

  const handleTogglePermission = (item: PermissionDictItem) => {
    if (isBuiltin) return;
    setPermissions((prev) =>
      prev.includes(item.permissionId)
        ? prev.filter((p) => p !== item.permissionId)
        : [...prev, item.permissionId],
    );
  };

  const handleToggleGroup = (group: PermissionDictGroup, allOn: boolean) => {
    if (isBuiltin) return;
    setPermissions((prev) => {
      const set = new Set(prev);
      if (allOn) {
        group.permissions.forEach((item) => set.delete(item.permissionId));
      } else {
        group.permissions.forEach((item) => set.add(item.permissionId));
      }
      return Array.from(set);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        ...formData,
        displayName: formData.displayName || undefined,
        description: formData.description || undefined,
        permissions: permissions.length > 0 ? permissions : undefined,
        isEnabled: formData.isEnabled ? 1 : 0,
      });

      toast.success(
        role ? "Role updated successfully" : "Role created successfully",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(role ? "Failed to update role" : "Failed to create role");
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const isBuiltin = role?.isBuiltin === 1;

  return (
    <AnnouncementDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      iconTone="info"
      title={role ? "Edit role" : "Create role"}
      description={
        role
          ? "Update role information and permissions."
          : "Create a new role with specific permissions."
      }
      size="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g.: developer"
                required
                disabled={isBuiltin}
              />
              {isBuiltin && (
                <p className="text-xs text-muted-foreground">
                  Built-in role name cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="e.g.: Developer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of this role"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scope">Scope *</Label>
              <Select
                value={formData.scope}
                onValueChange={(value: RoleScope) =>
                  setFormData({ ...formData, scope: value })
                }
                disabled={isBuiltin}
              >
                <SelectTrigger id="scope">
                  <SelectValue>
                    {formData.scope === "org"
                      ? "Organization"
                      : formData.scope === "team"
                        ? "Team"
                        : formData.scope === "project"
                          ? "Project"
                          : formData.scope}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Organization</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
              {isBuiltin && (
                <p className="text-xs text-muted-foreground">
                  Built-in role scope cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority.toString()}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="Higher number = higher priority"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Permissions</Label>
              <span className="text-xs text-muted-foreground">
                {permissions.length} selected
                {permissionDictLoading ? " · loading dictionary..." : ""}
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto rounded-md border p-3">
              {permissionGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {permissionDictLoading
                    ? "Loading permission dictionary..."
                    : "No permission dictionary available."}
                </p>
              ) : (
                permissionGroups
                  .slice()
                  .sort((a, b) => a.resourceType.localeCompare(b.resourceType))
                  .map((group) => {
                    const groupSelectedCount = group.permissions.filter((item) =>
                      permissions.includes(item.permissionId),
                    ).length;
                    const allOn =
                      groupSelectedCount === group.permissions.length &&
                      group.permissions.length > 0;
                    return (
                      <div key={group.resourceType} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            {group.resourceType}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
                            onClick={() => handleToggleGroup(group, allOn)}
                            disabled={isBuiltin}
                          >
                            {allOn ? "Clear" : "Select all"}
                          </button>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {group.permissions
                            .slice()
                            .sort((a, b) =>
                              a.permissionId.localeCompare(b.permissionId),
                            )
                            .map((item) => {
                              const checked = permissions.includes(
                                item.permissionId,
                              );
                              return (
                                <label
                                  key={item.permissionId}
                                  className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-1 hover:border-border"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    disabled={isBuiltin}
                                    onChange={() =>
                                      handleTogglePermission(item)
                                    }
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate font-mono text-xs">
                                      {item.permissionId}
                                    </div>
                                    {item.description ? (
                                      <div className="truncate text-xs text-muted-foreground">
                                        {item.description}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Custom permission
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newPermission}
                  onChange={(e) => setNewPermission(e.target.value)}
                  placeholder="e.g.: pipeline:custom_action"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPermission();
                    }
                  }}
                  disabled={isBuiltin}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddPermission}
                  disabled={isBuiltin}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {customPermissions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
                  {customPermissions.map((permission) => (
                    <div
                      key={permission}
                      className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      <span className="font-mono">{permission}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePermission(permission)}
                        className="hover:text-destructive disabled:text-muted-foreground"
                        disabled={isBuiltin}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pick from the dictionary above, or add a custom action ID here.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isEnabled: checked })
              }
            />
            <Label htmlFor="isEnabled" className="cursor-pointer">
              Enable this role
            </Label>
          </div>

          <AnnouncementDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-1" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </AnnouncementDialogFooter>
        </form>
      </AnnouncementDialog>
  );
}
