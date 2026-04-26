/**
 * Notifications 通知管理页面 - 管理通知渠道和模板
 */

import { useState, useMemo } from 'react';
import {
  Bell,
  Plus,
  Mail,
  MessageSquare,
  Webhook,
  FileText,
  Edit,
  Trash2,
  Search,
  Power,
  PowerOff,
  AlertTriangle,
  Clock,
  GitMerge,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationChannelDialog, type Channel } from '@/components/notification-channel-dialog';
import { NotificationTemplateDialog, type Template } from '@/components/notification-template-dialog';
import { toast } from '@/lib/toast';

// 模拟数据
let channels: Channel[] = [
  {
    id: '1',
    name: 'Email Channel',
    type: 'email',
    status: 'active',
    description: 'Send notifications via email',
    config: {
      smtp: 'smtp.example.com',
      port: 587,
    },
  },
  {
    id: '2',
    name: 'Slack Channel',
    type: 'slack',
    status: 'active',
    description: 'Send notifications to Slack workspace',
    config: {
      webhook: 'https://hooks.slack.com/services/...',
    },
  },
  {
    id: '3',
    name: 'Webhook Channel',
    type: 'webhook',
    status: 'inactive',
    description: 'Send notifications via webhook',
    config: {
      url: 'https://api.example.com/webhook',
    },
  },
];

let templates: Template[] = [
  {
    id: '1',
    name: 'Pipeline Success',
    channel: 'email',
    title: 'Pipeline {{.PipelineName}} completed successfully',
    content: 'Your pipeline {{.PipelineName}} has completed successfully at {{.Timestamp}}.',
  },
  {
    id: '2',
    name: 'Pipeline Failure',
    channel: 'slack',
    title: 'Pipeline {{.PipelineName}} failed',
    content: 'Pipeline {{.PipelineName}} failed at stage {{.StageName}}. Error: {{.ErrorMessage}}',
  },
  {
    id: '3',
    name: 'Deployment Notification',
    channel: 'webhook',
    title: 'Deployment {{.DeploymentName}} completed',
    content: 'Deployment {{.DeploymentName}} to {{.Environment}} completed successfully.',
  },
];

const channelIcons = {
  email: Mail,
  slack: MessageSquare,
  webhook: Webhook,
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('channels');
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [channelsList, setChannelsList] = useState<Channel[]>(channels);
  const [templatesList, setTemplatesList] = useState<Template[]>(templates);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateFilterChannel, setTemplateFilterChannel] = useState<string>('all');

  const handleCreateChannel = () => {
    setEditingChannel(null);
    setChannelDialogOpen(true);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setChannelDialogOpen(true);
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (confirm('Are you sure you want to delete this channel?')) {
      setChannelsList(channelsList.filter((ch) => ch.id !== channelId));
      toast.success('Channel deleted successfully');
    }
  };

  const handleChannelSubmit = async (data: Channel) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    if (editingChannel) {
      setChannelsList(
        channelsList.map((ch) => (ch.id === editingChannel.id ? { ...data, id: ch.id } : ch))
      );
    } else {
      setChannelsList([...channelsList, { ...data, id: Date.now().toString() }]);
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
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplatesList(templatesList.filter((t) => t.id !== templateId));
      toast.success('Template deleted successfully');
    }
  };

  const handleTemplateSubmit = async (data: Template) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    if (editingTemplate) {
      setTemplatesList(
        templatesList.map((t) => (t.id === editingTemplate.id ? { ...data, id: t.id } : t))
      );
    } else {
      setTemplatesList([...templatesList, { ...data, id: Date.now().toString() }]);
    }
  };

  const handleToggleChannel = async (channel: Channel) => {
    const newStatus = channel.status === 'active' ? 'inactive' : 'active';
    setChannelsList(
      channelsList.map((ch) =>
        ch.id === channel.id ? { ...ch, status: newStatus } : ch
      )
    );
    toast.success(`Channel ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
  };

  // 筛选逻辑
  const filteredChannels = useMemo(() => {
    return channelsList.filter((channel) => {
      // 按类型筛选
      if (filterType !== 'all' && channel.type !== filterType) {
        return false;
      }
      
      // 按状态筛选
      if (filterStatus === 'active' && channel.status !== 'active') {
        return false;
      }
      if (filterStatus === 'inactive' && channel.status !== 'inactive') {
        return false;
      }
      
      // 按名称或描述搜索
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          channel.name.toLowerCase().includes(term) ||
          (channel.description && channel.description.toLowerCase().includes(term))
        );
      }
      
      return true;
    });
  }, [channelsList, filterType, filterStatus, searchTerm]);

  const getChannelTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      email: { label: 'Email', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
      slack: { label: 'Slack', className: 'bg-purple-50 text-purple-600 border border-purple-200' },
      webhook: { label: 'Webhook', className: 'bg-green-50 text-green-600 border border-green-200' },
    };
    const variant = variants[type] || { label: type.toUpperCase(), className: 'bg-gray-100 text-gray-600 border border-gray-200' };
    return (
      <Badge variant='outline' className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getChannelConfigDisplay = (channel: Channel) => {
    switch (channel.type) {
      case 'email':
        return channel.config.smtp && channel.config.port
          ? `${channel.config.smtp}:${channel.config.port}`
          : '-';
      case 'slack':
        return channel.config.webhook ? (
          <span className="font-mono text-xs truncate max-w-xs">{channel.config.webhook}</span>
        ) : '-';
      case 'webhook':
        return channel.config.url ? (
          <span className="font-mono text-xs truncate max-w-xs">{channel.config.url}</span>
        ) : '-';
      default:
        return '-';
    }
  };

  // 模板筛选逻辑
  const filteredTemplates = useMemo(() => {
    return templatesList.filter((template) => {
      // 按渠道筛选
      if (templateFilterChannel !== 'all' && template.channel !== templateFilterChannel) {
        return false;
      }
      
      // 按名称、标题或内容搜索
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

  const getTemplateChannelBadge = (channel: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      email: { label: 'Email', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
      slack: { label: 'Slack', className: 'bg-purple-50 text-purple-600 border border-purple-200' },
      webhook: { label: 'Webhook', className: 'bg-green-50 text-green-600 border border-green-200' },
    };
    const variant = variants[channel] || { label: channel.toUpperCase(), className: 'bg-gray-100 text-gray-600 border border-gray-200' };
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const activeChannelCount = channelsList.filter((c) => c.status === 'active').length
  const inactiveChannelCount = channelsList.length - activeChannelCount
  const templateCount = templatesList.length
  const ruleCount: number = 0 // TODO: replace with real Apis.notifications.listRules() when backend ready

  const headerActionLabel =
    activeTab === 'channels' ? 'Add Channel' :
    activeTab === 'templates' ? 'Create Template' :
    activeTab === 'rules' ? 'New Rule' : null

  const headerAction = () => {
    if (activeTab === 'channels') return handleCreateChannel()
    if (activeTab === 'templates') return handleCreateTemplate()
    // rules: not wired yet
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-green-500" />
            Notifications
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage notification channels, templates and routing rules.
          </p>
        </div>
        {headerActionLabel && (
          <Button onClick={headerAction} disabled={activeTab === 'rules'}>
            <Plus className="mr-2 h-4 w-4" />
            {headerActionLabel}
          </Button>
        )}
      </div>

      {/* Top overview cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
            <Power className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeChannelCount}</div>
            <p className="text-xs text-muted-foreground">
              {inactiveChannelCount} inactive · {channelsList.length} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">In the last 24h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateCount}</div>
            <p className="text-xs text-muted-foreground">
              {ruleCount} routing rule{ruleCount === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sent</CardTitle>
            <Clock className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting events</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Channels
                  </CardTitle>
                  <CardDescription>Configure and manage notification channels (Email, Slack, Webhook)</CardDescription>
                </div>
              </div>
              
              {/* 筛选栏 */}
              <div className="flex gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
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
              {filteredChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {channelsList.length === 0 ? 'No notification channels configured' : 'No channels match your filters'}
                  </p>
                  {channelsList.length === 0 ? (
                    <Button onClick={handleCreateChannel}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Channel
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterStatus('all'); }}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChannels.map((channel) => {
                      const Icon = channelIcons[channel.type as keyof typeof channelIcons] || Bell;
                      return (
                        <TableRow key={channel.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {channel.name}
                            </div>
                          </TableCell>
                          <TableCell>{getChannelTypeBadge(channel.type)}</TableCell>
                          <TableCell className="max-w-xs">{getChannelConfigDisplay(channel)}</TableCell>
                          <TableCell>
                            {channel.status === 'active' ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <Power className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-100 text-gray-500 border border-gray-200">
                                <PowerOff className="mr-1 h-3 w-3" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{channel.description || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleToggleChannel(channel)}>
                                {channel.status === 'active' ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEditChannel(channel)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => channel.id && handleDeleteChannel(channel.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notification Templates
                  </CardTitle>
                  <CardDescription>Create and manage notification templates for different channels</CardDescription>
                </div>
              </div>
              
              {/* 筛选栏 */}
              <div className="flex gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, title or content..."
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={templateFilterChannel} onValueChange={setTemplateFilterChannel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {templatesList.length === 0 ? 'No notification templates configured' : 'No templates match your filters'}
                  </p>
                  {templatesList.length === 0 ? (
                    <Button onClick={handleCreateTemplate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Template
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { setTemplateSearchTerm(''); setTemplateFilterChannel('all'); }}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => {
                      const Icon = channelIcons[template.channel as keyof typeof channelIcons] || FileText;
                      return (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {template.name}
                            </div>
                          </TableCell>
                          <TableCell>{getTemplateChannelBadge(template.channel)}</TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm truncate block">{template.title}</span>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm truncate block">{template.content}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleEditTemplate(template)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => template.id && handleDeleteTemplate(template.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="h-5 w-5" />
                Routing Rules
              </CardTitle>
              <CardDescription>
                Map platform events to notification channels and templates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                  <Send className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-base font-medium">No routing rules yet</div>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Define which events trigger which channels — for example, send pipeline
                    failures to a Slack channel, or notify owners of production deployments.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rules API is not yet available. This tab is reserved for future configuration.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        channels={channelsList.map((ch) => ({ id: ch.id || '', name: ch.name, type: ch.type }))}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}

