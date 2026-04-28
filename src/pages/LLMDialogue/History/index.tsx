/**
 * LLM Dialogue History 页面 - 对话历史
 */

import type { FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { History, MessageSquare, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface DialogueHistory {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

const DialogueHistory: FC = () => {
  const { workspaceName } = useParams<{ workspaceName: string }>();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // 模拟数据
  const histories: DialogueHistory[] = [
    {
      id: "1",
      title: "关于机器学习模型的讨论",
      lastMessage: "如何优化模型的训练速度？",
      messageCount: 15,
      updatedAt: "2024-01-20T14:30:00Z",
    },
    {
      id: "2",
      title: "数据管道设计咨询",
      lastMessage: "ETL流程的最佳实践是什么？",
      messageCount: 8,
      updatedAt: "2024-01-19T10:15:00Z",
    },
    {
      id: "3",
      title: "模型部署问题",
      lastMessage: "如何在生产环境中部署模型？",
      messageCount: 12,
      updatedAt: "2024-01-18T16:45:00Z",
    },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredHistories = histories.filter(
    (history) =>
      history.title.toLowerCase().includes(searchText.toLowerCase()) ||
      history.lastMessage.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleHistoryClick = (historyId: string) => {
    navigate(`/workspace/${workspaceName}/chat?historyId=${historyId}`);
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <History className="h-8 w-8 text-blue-500" />
            Dialogue History - {workspaceName}
          </h2>
          <p className="text-muted-foreground mt-1">
            View your conversation history
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search conversations..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* 历史记录列表 */}
      {filteredHistories.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No conversation history found
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistories.map((history) => (
            <Card
              key={history.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleHistoryClick(history.id)}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  {history.title}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-2">
                  {history.lastMessage}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(history.updatedAt)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {history.messageCount} messages
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DialogueHistory;
