/**
 * 站内通知页面 - 显示用户收到的通知消息
 */

import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  Circle,
  Workflow,
  Rocket,
  ClipboardList,
  Lock,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);

// 通知类型
export type NotificationType = 'system' | 'pipeline' | 'deployment' | 'task' | 'security' | 'other';

// 通知接口
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  metadata?: Record<string, any>;
}

// 模拟数据（后续替换为 API 调用）
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'pipeline',
    title: 'Pipeline 执行成功',
    content: 'Pipeline "build-frontend" 已成功完成执行',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    link: '/projects/proj-123/pipelines/run-456',
  },
  {
    id: '2',
    type: 'deployment',
    title: '部署完成',
    content: '应用 "web-app" 已成功部署到生产环境',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    link: '/projects/proj-123/deployments/deploy-789',
  },
  {
    id: '3',
    type: 'system',
    title: '系统维护通知',
    content: '系统将于今晚 22:00-24:00 进行维护，期间服务可能短暂中断',
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'task',
    title: '任务分配',
    content: '您已被分配到项目 "Project Alpha" 的开发任务',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    link: '/projects/proj-alpha',
  },
  {
    id: '5',
    type: 'security',
    title: '安全警告',
    content: '检测到异常登录尝试，如非本人操作请立即修改密码',
    isRead: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// 通知类型配置
const notificationTypeConfig: Record<
  NotificationType,
  { label: string; color: string; icon: LucideIcon }
> = {
  system: { label: '系统通知', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Bell },
  pipeline: { label: '流水线', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: Workflow },
  deployment: { label: '部署', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Rocket },
  task: { label: '任务', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: ClipboardList },
  security: { label: '安全', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: Lock },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300', icon: Pin },
};

export default function InboxPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [language] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const hasFetchedRef = useRef(false);

  // 加载通知数据
  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        // TODO: 调用 API 获取通知
        // const response = await Apis.notification.listNotifications();
        // setNotifications(response.notifications);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        toast.error('加载通知失败');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  // 过滤通知
  const filteredNotifications = notifications.filter((notification) => {
    // Tab 过滤
    if (activeTab === 'unread' && notification.isRead) {
      return false;
    }

    // 类型过滤
    if (filterType !== 'all' && notification.type !== filterType) {
      return false;
    }

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        notification.title.toLowerCase().includes(term) ||
        notification.content.toLowerCase().includes(term)
      );
    }

    return true;
  });

  // 未读数量
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // 标记为已读
  const markAsRead = async (id: string) => {
    try {
      // TODO: 调用 API 标记已读
      // await Apis.notification.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      toast.success('已标记为已读');
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('标记失败');
    }
  };

  // 全部标记为已读
  const markAllAsRead = async () => {
    try {
      // TODO: 调用 API 全部标记已读
      // await Apis.notification.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('已全部标记为已读');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('标记失败');
    }
  };

  // 删除通知
  const deleteNotification = async (id: string) => {
    try {
      // TODO: 调用 API 删除通知
      // await Apis.notification.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('已删除');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('删除失败');
    }
  };

  // 清空已读
  const clearRead = async () => {
    try {
      // TODO: 调用 API 清空已读
      // await Apis.notification.clearRead();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      toast.success('已清空已读通知');
    } catch (error) {
      console.error('Failed to clear read:', error);
      toast.error('清空失败');
    }
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const locale = language === 'zh-CN' ? 'zh-cn' : 'en';
    return dayjs(dateString).locale(locale).fromNow();
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-500" />
            站内通知
          </h2>
          <p className="text-muted-foreground mt-1">
            查看和管理您的通知消息
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {unreadCount} 条未读
            </Badge>
          )}
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              全部已读
            </Button>
          )}
          {notifications.filter((n) => n.isRead).length > 0 && (
            <Button size="sm" variant="outline" onClick={clearRead}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              清空已读
            </Button>
          )}
        </div>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索通知..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(notificationTypeConfig).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 通知列表 */}
      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}>
            <TabsList>
              <TabsTrigger value="all" className="text-sm">
                全部 ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-sm">
                未读 ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}>
            <TabsContent value={activeTab} className="mt-0">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>
              ) : filteredNotifications.length > 0 ? (
                <div className="space-y-0 border rounded-lg divide-y">
                  {filteredNotifications.map((notification) => {
                    const typeConfig = notificationTypeConfig[notification.type];
                    return (
                      <div
                        key={notification.id}
                        className={`group flex items-start gap-4 px-4 py-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                          !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* 未读指示器 */}
                        {!notification.isRead && (
                          <Circle className="h-2 w-2 mt-2 fill-blue-500 text-blue-500 flex-shrink-0" />
                        )}
                        {notification.isRead && (
                          <div className="h-2 w-2 mt-2 flex-shrink-0" />
                        )}

                        {/* 通知图标 */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            {(() => {
                              const Icon = typeConfig.icon;
                              return <Icon className="h-5 w-5 text-muted-foreground" />;
                            })()}
                          </div>
                        </div>

                        {/* 通知内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h3 className="text-sm font-medium truncate">{notification.title}</h3>
                              <Badge variant="secondary" className={`text-xs ${typeConfig.color}`}>
                                {typeConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.isRead && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatTime(notification.createdAt)}</span>
                            {notification.link && (
                              <>
                                <span>·</span>
                                <span className="text-blue-600 dark:text-blue-400 hover:underline">
                                  查看详情
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {searchTerm || filterType !== 'all' || activeTab === 'unread'
                    ? '没有找到匹配的通知'
                    : '暂无通知'}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

