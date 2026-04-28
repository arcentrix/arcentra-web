/**
 * LLM Dialogue Chat 页面 - AI对话页面
 */

import type { FC } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useEffect } from "react";
import userStore from "@/store/user";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";

const Chat: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const historyId = searchParams.get("historyId");
  const userState = userStore.useState();
  const userAvatar = userState.userinfo?.avatar || DEFAULT_USER_AVATAR;

  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: Date;
    }>
  >([]);
  // 从 URL 查询参数中读取 title，如果没有则默认为 'New chat'
  const [chatTitle, setChatTitle] = useState(
    searchParams.get("title") || "New chat",
  );
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "claude-3-opus", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载历史对话
  useEffect(() => {
    if (historyId) {
      setLoading(true);
      // 模拟加载历史对话数据
      setTimeout(() => {
        // 根据 historyId 加载对应的历史消息
        // 这里使用模拟数据，实际应该调用 API
        const mockHistoryMessages = [
          {
            id: "1",
            role: "user" as const,
            content: "如何优化模型的训练速度？",
            timestamp: new Date("2024-01-20T14:25:00Z"),
          },
          {
            id: "2",
            role: "assistant" as const,
            content:
              "优化模型训练速度可以从以下几个方面入手：\n\n1. **数据预处理优化**：使用数据管道并行处理，减少I/O等待时间\n2. **模型架构优化**：使用更高效的网络结构，如MobileNet、EfficientNet等\n3. **训练策略优化**：使用混合精度训练、梯度累积等技术\n4. **硬件优化**：使用GPU加速，合理设置batch size\n5. **分布式训练**：使用多GPU或多机训练来加速",
            timestamp: new Date("2024-01-20T14:26:00Z"),
          },
          {
            id: "3",
            role: "user" as const,
            content: "能详细说说混合精度训练吗？",
            timestamp: new Date("2024-01-20T14:27:00Z"),
          },
          {
            id: "4",
            role: "assistant" as const,
            content:
              "混合精度训练（Mixed Precision Training）是一种使用半精度（FP16）和单精度（FP32）混合进行训练的技术。主要优势包括：\n\n- **内存节省**：FP16占用内存是FP32的一半，可以训练更大的模型\n- **速度提升**：现代GPU对FP16运算有专门优化，速度可提升1.5-2倍\n- **精度保持**：关键操作仍使用FP32，保证训练稳定性\n\n实现方式通常使用框架提供的自动混合精度（AMP）功能，如PyTorch的`torch.cuda.amp`或TensorFlow的`tf.train.experimental.enable_mixed_precision_graph_rewrite`。",
            timestamp: new Date("2024-01-20T14:28:00Z"),
          },
        ];

        setMessages(mockHistoryMessages);
        const title = "关于机器学习模型的讨论";
        setChatTitle(title);
        setLoading(false);
      }, 500);
    } else {
      // 新对话，重置状态
      setMessages([]);
      setChatTitle("New chat");
    }
  }, [historyId]);

  // 当 chatTitle 变化时，更新 URL 中的 title 参数
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    const currentTitle = newSearchParams.get("title");
    if (currentTitle !== chatTitle) {
      newSearchParams.set("title", chatTitle);
      navigate(`?${newSearchParams.toString()}`, { replace: true });
    }
  }, [chatTitle, navigate, searchParams]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setMessage("");

    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 模拟AI回复
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content:
          "这是一个模拟的AI回复。实际应用中，这里会调用AI API来生成回复。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="border-b bg-background px-3 sm:px-4 py-2 sm:py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold truncate">
              {loading ? "Loading..." : chatTitle}
            </h2>
          </div>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 消息区域 - 占据剩余空间 */}
      <div
        className={`flex-1 min-h-0 ${
          messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full px-3 sm:px-4 py-4 sm:py-6">
            <div className="text-center text-muted-foreground px-4">
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-base sm:text-lg font-medium">
                Loading conversation...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-3 sm:px-4 py-4 sm:py-6">
            <div className="text-center text-muted-foreground px-4">
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-base sm:text-lg font-medium">
                Start your conversation
              </p>
              <p className="text-xs sm:text-sm mt-2">
                Enter your message to start a conversation with AI
              </p>
            </div>
          </div>
        ) : (
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 sm:gap-4 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`flex-1 max-w-[85%] sm:max-w-[80%] ${
                      msg.role === "user" ? "order-2" : ""
                    }`}
                  >
                    <div
                      className={`rounded-lg px-3 py-2 sm:px-4 sm:py-3 ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white ml-auto"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 order-3">
                      <AvatarImage src={userAvatar} alt="User avatar" />
                      <AvatarFallback className="bg-gray-500 text-white text-[10px] sm:text-xs font-medium">
                        {userState.userinfo?.username
                          ?.charAt(0)
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 - 固定在底部 */}
      <div className="border-t bg-background px-3 sm:px-4 pt-3 sm:pt-4 pb-6 sm:pb-8 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative min-w-0">
              <Textarea
                ref={textareaRef}
                placeholder="Enter your message..."
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                className="min-h-[44px] max-h-[200px] resize-none pr-10 sm:pr-12 py-2.5 sm:py-3 text-sm sm:text-base"
                rows={1}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim()}
              size="icon"
              className="h-[44px] w-[44px] sm:h-11 sm:w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
            AI may make mistakes. Please check important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
