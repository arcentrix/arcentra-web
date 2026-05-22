/**
 * Notifications 通知管理页面 - 管理通知渠道和模板
 */

import { useState, useMemo } from "react";
import {
  Plus,
  Mail,
  MessageSquare,
  Webhook,
  FileText,
  Edit,
  Trash2,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NotificationChannelDialog,
  type Channel,
} from "@/components/notification-channel-dialog";
import {
  NotificationTemplateDialog,
  type Template,
} from "@/components/notification-template-dialog";
import { SettingsCard, ColumnHead } from "@/components/blueprint";
import { toast } from "@/lib/toast";

// 模拟数据
let channels: Channel[] = [
  {
    id: "1",
    name: "Email Channel",
    type: "email",
    status: "active",
    description: "Send notifications via email",
    config: {
      smtp: "smtp.example.com",
      port: 587,
    },
  },
  {
    id: "2",
    name: "Slack Channel",
    type: "slack",
    status: "active",
    description: "Send notifications to Slack workspace",
    config: {
      webhook: "https://hooks.slack.com/services/...",
    },
  },
  {
    id: "3",
    name: "Webhook Channel",
    type: "webhook",
    status: "inactive",
    description: "Send notifications via webhook",
    config: {
      url: "https://api.example.com/webhook",
    },
  },
];

let templates: Template[] = [
  {
    id: "1",
    name: "Pipeline Success",
    channel: "email",
    title: "Pipeline {{.PipelineName}} completed successfully",
    content:
      "Your pipeline {{.PipelineName}} has completed successfully at {{.Timestamp}}.",
  },
  {
    id: "2",
    name: "Pipeline Failure",
    channel: "slack",
    title: "Pipeline {{.PipelineName}} failed",
    content:
      "Pipeline {{.PipelineName}} failed at stage {{.StageName}}. Error: {{.ErrorMessage}}",
  },
  {
    id: "3",
    name: "Deployment Notification",
    channel: "webhook",
    title: "Deployment {{.DeploymentName}} completed",
    content:
      "Deployment {{.DeploymentName}} to {{.Environment}} completed successfully.",
  },
];

const channelIcons = {
  email: Mail,
  slack: MessageSquare,
  webhook: Webhook,
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  slack: "Slack",
  webhook: "Webhook",
};

function getChannelConfigDisplay(channel: Channel): React.ReactNode {
  switch (channel.type) {
    case "email":
      return channel.config.smtp && channel.config.port
        ? `${channel.config.smtp}:${channel.config.port}`
        : "—";
    case "slack":
      return channel.config.webhook ? (
        <span className="font-mono text-[12px] text-fg-muted truncate max-w-xs block">
          {channel.config.webhook}
        </span>
      ) : "—";
    case "webhook":
      return channel.config.url ? (
        <span className="font-mono text-[12px] text-fg-muted truncate max-w-xs block">
          {channel.config.url}
        </span>
      ) : "—";
    default:
      return "—";
  }
}

export default function NotificationsPage({
  headless = false,
}: {
  /** 嵌入 Settings 侧栏分区时启用：去掉页头与外层留白。 */
  headless?: boolean;
}) {
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [channelsList, setChannelsList] = useState<Channel[]>(channels);
  const [templatesList, setTemplatesList] = useState<Template[]>(templates);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [templateFilterChannel, setTemplateFilterChannel] =
    useState<string>("all");

  const handleCreateChannel = () => {
    setEditingChannel(null);
    setChannelDialogOpen(true);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setChannelDialogOpen(true);
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (confirm("Are you sure you want to delete this channel?")) {
      setChannelsList(channelsList.filter((ch) => ch.id !== channelId));
      toast.success("Channel deleted successfully");
    }
  };

  const handleChannelSubmit = async (data: Channel) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (editingChannel) {
      setChannelsList(
        channelsList.map((ch) =>
          ch.id === editingChannel.id ? { ...data, id: ch.id } : ch,
        ),
      );
    } else {
      setChannelsList([
        ...channelsList,
        { ...data, id: Date.now().toString() },
      ]);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      setTemplatesList(templatesList.filter((t) => t.id !== templateId));
      toast.success("Template deleted successfully");
    }
  };

  const handleTemplateSubmit = async (data: Template) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (editingTemplate) {
      setTemplatesList(
        templatesList.map((t) =>
          t.id === editingTemplate.id ? { ...data, id: t.id } : t,
        ),
      );
    } else {
      setTemplatesList([
        ...templatesList,
        { ...data, id: Date.now().toString() },
      ]);
    }
  };

  const handleToggleChannel = async (channel: Channel) => {
    const newStatus = channel.status === "active" ? "inactive" : "active";
    setChannelsList(
      channelsList.map((ch) =>
        ch.id === channel.id ? { ...ch, status: newStatus } : ch,
      ),
    );
    toast.success(`Channel ${newStatus === "active" ? "enabled" : "disabled"}`);
  };

  // 筛选逻辑
  const filteredChannels = useMemo(() => {
    return channelsList.filter((channel) => {
      if (filterType !== "all" && channel.type !== filterType) return false;
      if (filterStatus === "active" && channel.status !== "active") return false;
      if (filterStatus === "inactive" && channel.status !== "inactive") return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          channel.name.toLowerCase().includes(term) ||
          (channel.description &&
            channel.description.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [channelsList, filterType, filterStatus, searchTerm]);

  // 模板筛选逻辑
  const filteredTemplates = useMemo(() => {
    return templatesList.filter((template) => {
      if (
        templateFilterChannel !== "all" &&
        template.channel !== templateFilterChannel
      ) {
        return false;
      }
      if (templateSearchTerm) {
        const term = templateSearchTerm.toLowerCase();
        return (
          template.name.toLowerCase().includes(term) ||
          template.title.toLowerCase().includes(term) ||
          template.content.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [templatesList, templateFilterChannel, templateSearchTerm]);

  const outer = headless ? "flex flex-col gap-4" : "flex-1 flex flex-col gap-4 p-4 md:p-8 pt-6";

  return (
    <div className={outer}>
      {/* ── Channels card ────────────────────────────────────────── */}
      <SettingsCard
        title="Channels"
        sub="Where Arcentra sends events."
        action={
          <Button size="sm" onClick={handleCreateChannel} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add channel
          </Button>
        }
      >
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder="Search channels…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-[34px] text-[13px]"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] h-[34px] text-[13px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-[34px] text-[13px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
            <MessageSquare className="h-8 w-8 text-fg-subtle" />
            <div>
              <div className="text-[13px] font-medium">
                {channelsList.length === 0
                  ? "No notification channels configured"
                  : "No channels match your filters"}
              </div>
            </div>
            {channelsList.length === 0 ? (
              <Button size="sm" onClick={handleCreateChannel} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add your first channel
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                  setFilterStatus("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {/* Column header row */}
            <li className="grid items-center gap-4 border-b pb-2 [grid-template-columns:32px_1fr_auto_auto_auto]">
              <span />
              <ColumnHead>Channel</ColumnHead>
              <ColumnHead>Type</ColumnHead>
              <ColumnHead>Enabled</ColumnHead>
              <span />
            </li>
            {filteredChannels.map((channel) => {
              const Icon =
                channelIcons[channel.type as keyof typeof channelIcons] ||
                MessageSquare;
              return (
                <li
                  key={channel.id}
                  className="grid items-center gap-4 border-b py-3 last:border-b-0 [grid-template-columns:32px_1fr_auto_auto_auto]"
                >
                  {/* Icon tile */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-bg-elevated">
                    <Icon className="h-3.5 w-3.5 text-fg-muted" />
                  </div>

                  {/* Name + config */}
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{channel.name}</div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-fg-subtle truncate">
                      {getChannelConfigDisplay(channel)}
                    </div>
                  </div>

                  {/* Type badge */}
                  <Badge
                    variant="outline"
                    className="font-mono text-[10.5px] uppercase tracking-[0.04em]"
                  >
                    {CHANNEL_TYPE_LABELS[channel.type] ?? channel.type}
                  </Badge>

                  {/* Toggle */}
                  <Switch
                    checked={channel.status === "active"}
                    onCheckedChange={() => handleToggleChannel(channel)}
                    aria-label={`Toggle ${channel.name}`}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditChannel(channel)}
                      className="h-7 px-2 text-[12.5px]"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => channel.id && handleDeleteChannel(channel.id)}
                      className="h-7 px-2 text-accent-danger hover:text-accent-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {/* ── Templates card ────────────────────────────────────────── */}
      <SettingsCard
        title="Templates"
        sub="Notification message templates for different channels."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateTemplate}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New template
          </Button>
        }
      >
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder="Search templates…"
              value={templateSearchTerm}
              onChange={(e) => setTemplateSearchTerm(e.target.value)}
              className="pl-8 h-[34px] text-[13px]"
            />
          </div>
          <Select
            value={templateFilterChannel}
            onValueChange={setTemplateFilterChannel}
          >
            <SelectTrigger className="w-[160px] h-[34px] text-[13px]">
              <SelectValue placeholder="Filter by channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
            <FileText className="h-8 w-8 text-fg-subtle" />
            <div className="text-[13px] font-medium">
              {templatesList.length === 0
                ? "No notification templates configured"
                : "No templates match your filters"}
            </div>
            {templatesList.length === 0 ? (
              <Button size="sm" onClick={handleCreateTemplate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create your first template
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTemplateSearchTerm("");
                  setTemplateFilterChannel("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b">
                <th className="pb-2 text-left">
                  <ColumnHead>Name</ColumnHead>
                </th>
                <th className="pb-2 px-3 text-left">
                  <ColumnHead>Channel</ColumnHead>
                </th>
                <th className="pb-2 px-3 text-left">
                  <ColumnHead>Title</ColumnHead>
                </th>
                <th className="pb-2 text-right">
                  <ColumnHead>Actions</ColumnHead>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => {
                const Icon =
                  channelIcons[
                    template.channel as keyof typeof channelIcons
                  ] || FileText;
                return (
                  <tr key={template.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                        {template.name}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10.5px] uppercase tracking-[0.04em]"
                      >
                        {CHANNEL_TYPE_LABELS[template.channel] ?? template.channel}
                      </Badge>
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-3 text-fg-muted">
                      {template.title}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTemplate(template)}
                          className="h-7 px-2"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            template.id && handleDeleteTemplate(template.id)
                          }
                          className="h-7 px-2 text-accent-danger hover:text-accent-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SettingsCard>

      {/* ── Routing rules card ───────────────────────────────────── */}
      <SettingsCard
        title="Routing rules"
        sub="Map platform events to notification channels and templates."
      >
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-elevated">
            <Send className="h-5 w-5 text-fg-muted" />
          </div>
          <div>
            <div className="text-[13px] font-medium">No routing rules yet</div>
            <p className="mt-1 max-w-sm text-[12px] text-fg-muted">
              Define which events trigger which channels — for example, send
              pipeline failures to Slack, or notify owners of production
              deployments.
            </p>
          </div>
          <p className="text-[12px] text-fg-subtle">
            Rules API is not yet available. This section is reserved for future
            configuration.
          </p>
        </div>
      </SettingsCard>

      <NotificationChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={editingChannel}
        onSubmit={handleChannelSubmit}
      />

      <NotificationTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        template={editingTemplate}
        channels={channelsList.map((ch) => ({
          id: ch.id || "",
          name: ch.name,
          type: ch.type,
        }))}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}
