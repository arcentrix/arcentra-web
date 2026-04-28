/**
 * Notification Template 对话框组件 - 创建/编辑通知模板
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";

export interface Template {
  id?: string;
  name: string;
  channel: "email" | "slack" | "webhook";
  title: string;
  content: string;
}

interface NotificationTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  channels: Array<{ id: string; name: string; type: string }>;
  onSubmit: (data: Template) => Promise<void>;
}

export function NotificationTemplateDialog({
  open,
  onOpenChange,
  template,
  channels,
  onSubmit,
}: NotificationTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Template>({
    name: "",
    channel: "email",
    title: "",
    content: "",
  });

  useEffect(() => {
    if (template && open) {
      setFormData(template);
    } else if (open) {
      setFormData({
        name: "",
        channel: "email",
        title: "",
        content: "",
      });
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(formData);
      toast.success(
        template
          ? "Template updated successfully"
          : "Template created successfully",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        template ? "Failed to update template" : "Failed to create template",
      );
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update notification template configuration"
              : "Create a new notification template"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g.: Pipeline Success"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel">Channel *</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value: "email" | "slack" | "webhook") =>
                    setFormData({ ...formData, channel: value })
                  }
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channels
                      .filter(
                        (ch) =>
                          ch.type === "email" ||
                          ch.type === "slack" ||
                          ch.type === "webhook",
                      )
                      .map((ch) => (
                        <SelectItem key={ch.id} value={ch.type}>
                          {ch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g.: Pipeline {{.PipelineName}} completed successfully"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use Go template syntax (e.g., {"{{.VariableName}}"}) for
                variables
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="e.g.: Your pipeline {{.PipelineName}} has completed successfully at {{.Timestamp}}."
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use Go template syntax (e.g., {"{{.VariableName}}"}) for
                variables. Templates are rendered by the backend.
              </p>
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
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
