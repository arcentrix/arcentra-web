/**
 * Notification Channel 对话框组件 - 创建/编辑通知渠道
 */

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";

export interface Channel {
  id?: string;
  name: string;
  type: "email" | "slack" | "webhook";
  status: "active" | "inactive";
  description: string;
  config: {
    smtp?: string;
    port?: number;
    webhook?: string;
    url?: string;
  };
}

interface NotificationChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: Channel | null;
  onSubmit: (data: Channel) => Promise<void>;
}

export function NotificationChannelDialog({
  open,
  onOpenChange,
  channel,
  onSubmit,
}: NotificationChannelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Channel>({
    name: "",
    type: "email",
    status: "active",
    description: "",
    config: {},
  });

  useEffect(() => {
    if (channel && open) {
      setFormData(channel);
    } else if (open) {
      setFormData({
        name: "",
        type: "email",
        status: "active",
        description: "",
        config: {},
      });
    }
  }, [channel, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(formData);
      toast.success(
        channel
          ? "Channel updated successfully"
          : "Channel created successfully",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        channel ? "Failed to update channel" : "Failed to create channel",
      );
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderConfigFields = () => {
    switch (formData.type) {
      case "email":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="smtp">SMTP Server *</Label>
              <Input
                id="smtp"
                value={formData.config.smtp || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, smtp: e.target.value },
                  })
                }
                placeholder="e.g.: smtp.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={formData.config.port || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      port: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                placeholder="e.g.: 587"
                required
              />
            </div>
          </>
        );
      case "slack":
        return (
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL *</Label>
            <Input
              id="webhook"
              type="url"
              value={formData.config.webhook || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  config: { ...formData.config, webhook: e.target.value },
                })
              }
              placeholder="https://hooks.slack.com/services/..."
              required
            />
          </div>
        );
      case "webhook":
        return (
          <div className="space-y-2">
            <Label htmlFor="url">Webhook URL *</Label>
            <Input
              id="url"
              type="url"
              value={formData.config.url || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  config: { ...formData.config, url: e.target.value },
                })
              }
              placeholder="https://api.example.com/webhook"
              required
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {channel ? "Edit Channel" : "Create Channel"}
          </DialogTitle>
          <DialogDescription>
            {channel
              ? "Update notification channel configuration"
              : "Create a new notification channel"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Channel Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g.: Email Channel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this channel"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Channel Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "email" | "slack" | "webhook") =>
                    setFormData({
                      ...formData,
                      type: value,
                      config: {}, // Reset config when type changes
                    })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "inactive") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold">Configuration</h3>
              {renderConfigFields()}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : channel ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
