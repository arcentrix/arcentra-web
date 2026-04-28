import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
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
import type {
  User,
  UserRole,
  UpdateUserRequest,
} from "@/api/user-management/types";
import type { Role } from "@/api/role/types";

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
  onSubmit: (data: UpdateUserRequest) => Promise<void>;
}

export function UserManagementDialog({
  open,
  onOpenChange,
  user,
  roles,
  onSubmit,
}: UserManagementDialogProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    role: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      // 确保 role 是 roleId，如果 user.role 是 name，需要找到对应的 roleId
      let roleId = user.role || "";
      if (roleId && roles.length > 0) {
        const matchedRole = roles.find(
          (r) => r.roleId === roleId || r.name === roleId,
        );
        roleId = matchedRole
          ? matchedRole.roleId
          : roles.length > 0
            ? roles[0].roleId
            : "";
      } else if (!roleId && roles.length > 0) {
        roleId = roles[0].roleId;
      }

      setFormData({
        username: user.username,
        email: user.email,
        fullName: user.fullName || "",
        phone: user.phone || "",
        role: roleId,
        isActive: user.isEnabled === 1,
      });
    } else if (open && roles.length > 0 && !formData.role) {
      // 设置默认角色为第一个可用角色
      setFormData((prev) => ({ ...prev, role: roles[0].roleId }));
    }
  }, [user, open, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: UpdateUserRequest = {
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName || undefined,
        phone: formData.phone || undefined,
        role: formData.role as UserRole,
        isEnabled: formData.isActive ? 1 : 0,
      };
      await onSubmit(updateData);

      toast.success("User updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update user");
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="e.g.: johndoe"
                required
                disabled={!!user}
              />
              {user && (
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="e.g.: john@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              placeholder="Enter full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue>
                    {formData.role
                      ? roles.find((r) => r.roleId === formData.role)?.name ||
                        formData.role
                      : "Select a role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.roleId} value={role.roleId}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active user
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
