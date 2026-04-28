/**
 * Pipeline Log Viewer - 实时日志查看器组件
 * 使用 SSE (Server-Sent Events) 接收后端推送的日志
 */

import { useEffect, useRef, useState } from "react";
import { Download, Copy, Check, ArrowDown, WrapText, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";

interface PipelineLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  pipelineId?: string;
  executionId?: string;
  stageName?: string;
  stepName?: string;
}

interface LogLine {
  content: string;
  lineNumber: number;
  isStageHeader: boolean;
  stageName?: string;
  isError: boolean;
}

export function PipelineLogViewer({
  open,
  onOpenChange,
  projectId,
  pipelineId,
  executionId,
  stageName,
  stepName,
}: PipelineLogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followTail, setFollowTail] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Mock 日志数据
  const mockLogs = [
    "[2024-01-20 14:30:15] Starting pipeline execution...",
    "[2024-01-20 14:30:16] Cloning repository from git@github.com:example/repo.git",
    "[2024-01-20 14:30:18] Checking out branch: main",
    "[2024-01-20 14:30:19] HEAD is now at abc1234 Initial commit",
    "",
    "[2024-01-20 14:30:20] ===== Stage: Build =====",
    "[2024-01-20 14:30:20] Running step: Install dependencies",
    "[2024-01-20 14:30:21] npm install",
    "[2024-01-20 14:30:22] npm WARN deprecated package@1.0.0: This package is no longer maintained",
    "[2024-01-20 14:30:25] added 1234 packages in 4.2s",
    "[2024-01-20 14:30:25] ✓ Dependencies installed successfully",
    "",
    "[2024-01-20 14:30:26] Running step: Build project",
    "[2024-01-20 14:30:26] npm run build",
    "[2024-01-20 14:30:27] > project@1.0.0 build",
    "[2024-01-20 14:30:27] > vite build",
    "[2024-01-20 14:30:28] vite v5.0.0 building for production...",
    "[2024-01-20 14:30:30] ✓ 156 modules transformed.",
    "[2024-01-20 14:30:32] dist/index.html                   0.45 kB",
    "[2024-01-20 14:30:32] dist/assets/index-abc123.js       245.67 kB",
    "[2024-01-20 14:30:32] dist/assets/index-def456.css        12.34 kB",
    "[2024-01-20 14:30:32] ✓ Build completed in 6.1s",
    "[2024-01-20 14:30:32] ✓ Stage Build completed successfully",
    "",
    "[2024-01-20 14:30:33] ===== Stage: Test =====",
    "[2024-01-20 14:30:33] Running step: Run unit tests",
    "[2024-01-20 14:30:33] npm test",
    "[2024-01-20 14:30:34] > project@1.0.0 test",
    "[2024-01-20 14:30:34] > jest",
    "[2024-01-20 14:30:35] PASS src/components/Button.test.tsx",
    "[2024-01-20 14:30:35] PASS src/components/Card.test.tsx",
    "[2024-01-20 14:30:36] PASS src/utils/format.test.ts",
    "[2024-01-20 14:30:36] Test Suites: 3 passed, 3 total",
    "[2024-01-20 14:30:36] Tests:       45 passed, 45 total",
    "[2024-01-20 14:30:36] Snapshots:   12 passed, 12 total",
    "[2024-01-20 14:30:36] Time:        2.456 s",
    "[2024-01-20 14:30:36] ✓ All tests passed",
    "",
    "[2024-01-20 14:30:37] Running step: Run integration tests",
    "[2024-01-20 14:30:37] npm run test:integration",
    "[2024-01-20 14:30:38] > project@1.0.0 test:integration",
    "[2024-01-20 14:30:38] > jest --config jest.integration.config.js",
    "[2024-01-20 14:30:40] PASS tests/integration/api.test.ts",
    "[2024-01-20 14:30:41] PASS tests/integration/auth.test.ts",
    "[2024-01-20 14:30:42] Test Suites: 2 passed, 2 total",
    "[2024-01-20 14:30:42] Tests:       18 passed, 18 total",
    "[2024-01-20 14:30:42] Time:        4.123 s",
    "[2024-01-20 14:30:42] ✓ Integration tests passed",
    "[2024-01-20 14:30:42] ✓ Stage Test completed successfully",
    "",
    "[2024-01-20 14:30:43] ===== Stage: Deploy =====",
    "[2024-01-20 14:30:43] Running step: Deploy to staging",
    "[2024-01-20 14:30:43] npm run deploy:staging",
    "[2024-01-20 14:30:44] > project@1.0.0 deploy:staging",
    "[2024-01-20 14:30:44] > deploy.sh staging",
    "[2024-01-20 14:30:45] Uploading files to staging server...",
    "[2024-01-20 14:30:47] ✓ Files uploaded successfully",
    "[2024-01-20 14:30:48] Restarting application server...",
    "[2024-01-20 14:30:50] ✓ Server restarted",
    "[2024-01-20 14:30:51] Health check: http://staging.example.com/health",
    "[2024-01-20 14:30:52] ✓ Health check passed",
    "[2024-01-20 14:30:52] ✓ Deployment completed successfully",
    "[2024-01-20 14:30:52] ✓ Stage Deploy completed successfully",
    "",
    "[2024-01-20 14:30:53] ===== Pipeline Execution Summary =====",
    "[2024-01-20 14:30:53] Status: SUCCESS",
    "[2024-01-20 14:30:53] Duration: 38.2s",
    "[2024-01-20 14:30:53] Stages: 3/3 passed",
    "[2024-01-20 14:30:53] Steps: 5/5 passed",
    "[2024-01-20 14:30:53] Pipeline execution completed successfully!",
  ];

  // 提取阶段列表
  const extractStages = (logs: string[]): string[] => {
    const stages: string[] = [];
    logs.forEach((log) => {
      const match = log.match(/=====\s*Stage:\s*(\w+)\s*=====/);
      if (match && !stages.includes(match[1])) {
        stages.push(match[1]);
      }
    });
    return stages;
  };

  const stages = extractStages(logs);

  // 解析日志行
  const parseLogLines = (logs: string[]): LogLine[] => {
    return logs.map((log, index) => {
      const isStageHeader = /=====\s*Stage:\s*(\w+)\s*=====/.test(log);
      const stageMatch = log.match(/=====\s*Stage:\s*(\w+)\s*=====/);
      const stageName = stageMatch ? stageMatch[1] : undefined;
      const isError = /ERROR|FAILED|FAILURE|exit code [^0]|Error:|Failed:/.test(
        log,
      );

      return {
        content: log,
        lineNumber: index + 1,
        isStageHeader,
        stageName,
        isError,
      };
    });
  };

  const logLines = parseLogLines(logs);

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollContainerRef.current && followTail) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (followTail) {
      scrollToBottom();
    }
  }, [logs, followTail]);

  // 跳转到指定阶段
  const scrollToStage = (stageName: string) => {
    const stageElement = stageRefs.current.get(stageName);
    if (stageElement && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const elementTop = stageElement.offsetTop;
      container.scrollTo({
        top: elementTop - 20,
        behavior: "smooth",
      });
      setFollowTail(false); // 跳转后关闭自动跟随
    }
  };

  // 建立 SSE 连接
  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoading(true);
    setLogs([]);
    setIsConnected(false);
    setFollowTail(true);

    // Mock 日志（用于演示和测试）
    const addMockLogs = () => {
      let index = 0;
      const interval = setInterval(() => {
        if (index < mockLogs.length) {
          setLogs((prev) => [...prev, mockLogs[index]]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    };

    const timeout = setTimeout(() => {
      setIsConnected(true);
      setIsLoading(false);
      addMockLogs();
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, [open, projectId, pipelineId, executionId, stageName, stepName]);

  // 关闭对话框时清理连接
  const handleClose = () => {
    setLogs([]);
    setIsConnected(false);
    onOpenChange(false);
  };

  // 复制日志
  const handleCopy = async () => {
    const logText = logs.join("\n");
    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      toast.success("日志已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("复制失败");
    }
  };

  // 下载日志
  const handleDownload = () => {
    const logText = logs.join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-logs-${executionId || pipelineId || "logs"}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("日志已下载");
  };

  // 格式化日志行
  const formatLogLine = (line: LogLine) => {
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    const cleanLine = line.content.replace(ansiRegex, "");

    // 如果是阶段标题，仍然设置 ref 用于导航，但不做特殊视觉处理
    if (line.isStageHeader && line.stageName) {
      return (
        <div
          key={line.lineNumber}
          ref={(el) => {
            if (el && line.stageName) {
              stageRefs.current.set(line.stageName, el);
            }
          }}
          className={`font-mono text-sm leading-relaxed ${
            wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre"
          } ${
            line.isError
              ? "bg-red-50 text-red-900 border-l-2 border-red-500 pl-2"
              : "text-gray-900"
          }`}
        >
          <span className="text-gray-400 select-none mr-3 w-12 inline-block text-right">
            {line.lineNumber}
          </span>
          <span>{cleanLine || " "}</span>
        </div>
      );
    }

    return (
      <div
        key={line.lineNumber}
        className={`font-mono text-sm leading-relaxed ${
          wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre"
        } ${
          line.isError
            ? "bg-red-50 text-red-900 border-l-2 border-red-500 pl-2"
            : "text-gray-900"
        }`}
      >
        <span className="text-gray-400 select-none mr-3 w-12 inline-block text-right">
          {line.lineNumber}
        </span>
        <span>{cleanLine || " "}</span>
      </div>
    );
  };

  const displayTitle = executionId
    ? `Pipeline Run ${executionId.slice(0, 8)}`
    : pipelineId
      ? `Pipeline ${pipelineId}`
      : "Real Time Logs";

  // 获取连接状态
  const getConnectionStatus = () => {
    if (isLoading) {
      return { color: "bg-yellow-500", text: "连接中..." };
    }
    if (isConnected) {
      return { color: "bg-green-500", text: "Connected" };
    }
    return { color: "bg-red-500", text: "Disconnected" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 [&>button]:hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          {/* Left: Title + Run ID */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {displayTitle}
            </h2>
            {executionId && (
              <p className="text-xs text-gray-500 mt-0.5">
                Execution ID: {executionId}
              </p>
            )}
          </div>

          {/* Middle: Stage Navigation */}
          {stages.length > 0 && (
            <div className="flex items-center gap-2 mx-4">
              {stages.map((stage) => (
                <Badge
                  key={stage}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => scrollToStage(stage)}
                >
                  {stage}
                </Badge>
              ))}
            </div>
          )}

          {/* Right: Status + Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${connectionStatus.color}`}
              ></span>
              <span className="text-gray-600">{connectionStatus.text}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={logs.length === 0}
                className="h-8 px-2"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={logs.length === 0}
                className="h-8 px-2"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Log Viewer Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={followTail ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFollowTail(!followTail);
                  if (!followTail) {
                    scrollToBottom();
                  }
                }}
                className="h-7 text-xs"
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                Follow
              </Button>
              <Button
                variant={wrapLines ? "default" : "outline"}
                size="sm"
                onClick={() => setWrapLines(!wrapLines)}
                className="h-7 text-xs"
              >
                <WrapText className="h-3 w-3 mr-1" />
                Wrap
              </Button>
            </div>
            <div className="text-xs text-gray-500">{logs.length} lines</div>
          </div>

          {/* Log Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-2 min-h-0"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                {isLoading
                  ? "正在连接..."
                  : isConnected
                    ? "等待日志输出..."
                    : "暂无日志"}
              </div>
            ) : (
              <div className="space-y-0">
                {logLines.map((line) => formatLogLine(line))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
