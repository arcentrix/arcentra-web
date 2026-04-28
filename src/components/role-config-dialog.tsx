import { useState, useEffect } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Role, RoleScope } from "@/api/role/types";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {role
              ? "Update role information and permissions"
              : "Create a new role with specific permissions"}
          </DialogDescription>
        </DialogHeader>

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

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="flex gap-2">
              <Input
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
                placeholder="e.g.: users.read"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPermission();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPermission}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {permissions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-md">
                {permissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                  >
                    <span>{permission}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePermission(permission)}
                      className="hover:text-destructive"
                      disabled={isBuiltin}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add permissions one by one. Press Enter or click + to add.
            </p>
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

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
