import { useState, useEffect } from "react";
import { KeyRound, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnnouncementDialog,
  AnnouncementDialogFooter,
} from "@/components/ui/announcement-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { Apis } from "@/api";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  username: string | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  username,
}: ResetPasswordDialogProps) {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({ newPassword: "", confirmPassword: "" });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("User ID is required");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await Apis.user_management.resetUserPassword(
        userId,
        formData.newPassword,
      );
      toast.success(`Password reset successfully for ${username}`);
      setFormData({ newPassword: "", confirmPassword: "" });
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to reset password");
      console.error("Reset password failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnnouncementDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={KeyRound}
      iconTone="warning"
      title={username ? `Reset password for ${username}` : "Reset password"}
      description="Set a new password for this user. The user will need to use the new password the next time they sign in."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password *</Label>
          <Input
            id="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={(e) =>
              setFormData({ ...formData, newPassword: e.target.value })
            }
            placeholder="Enter new password (min 6 characters)"
            required
            disabled={loading}
            minLength={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password *</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            placeholder="Re-enter new password"
            required
            disabled={loading}
            minLength={6}
          />
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
            {loading ? "Updating..." : "Update password"}
          </Button>
        </AnnouncementDialogFooter>
      </form>
    </AnnouncementDialog>
  );
}
