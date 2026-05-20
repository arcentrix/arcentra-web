/**
 * Copilot — Engineering-Blueprint 重做版
 *
 * 数据逻辑（state / effect / handler）完整保留自原文件，
 * 仅 JSX 与样式按 Engineering-Blueprint 设计系统重绘。
 *
 * 布局：侧栏 260px + 主聊天区，全高，无页面 padding（Chat 页专属规则）。
 */

import { useState, useRef, useEffect } from "react";
import type { FC, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  GitBranch,
  Plus,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import userStore from "@/store/user";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";

// ─────────────────────────── 子组件 ────────────────────────────

/** 助手头像：品牌信号色圆圈 + brain 图标 */
function AssistantAvatar() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: 28,
        height: 28,
        border: "1px solid var(--brand-signal-dim)",
        background: "color-mix(in oklab, var(--brand-signal) 8%, transparent)",
        color: "var(--brand-signal)",
      }}
    >
      <Brain className="h-3.5 w-3.5" />
    </span>
  );
}

/** 工具调用卡 */
interface ToolResult {
  name: string;
  args?: Record<string, unknown>;
  status: string;
  result?: [string, string, string][];
}

function ToolCard({ tool }: { tool: ToolResult }) {
  return (
    <div
      className="mb-2.5 overflow-hidden rounded-[8px] border"
      style={{ background: "var(--bg-elevated)" }}
    >
      {/* 工具头 */}
      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        <Zap
          className="h-3 w-3 shrink-0"
          style={{ color: "var(--brand-signal)" }}
        />
        <span style={{ color: "var(--brand-signal)" }}>tool</span>
        <span className="text-foreground">{tool.name}</span>
        <span
          className="ml-auto flex items-center gap-1"
          style={{ color: "var(--fg-subtle)" }}
        >
          {tool.status === "ok" ? (
            <>
              <Check
                className="h-3 w-3"
                style={{ color: "var(--accent-success)" }}
              />
              320ms
            </>
          ) : (
            tool.status
          )}
        </span>
      </div>
      {/* 工具体 */}
      <div
        className="px-3.5 py-2.5"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}
      >
        {tool.args && (
          <div className="mb-2" style={{ color: "var(--fg-subtle)" }}>
            <span style={{ color: "var(--fg-muted)" }}>args</span>
            {" = "}
            <span className="text-foreground">{JSON.stringify(tool.args)}</span>
          </div>
        )}
        {tool.result && tool.result.length > 0 && (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}
          >
            <thead>
              <tr style={{ color: "var(--fg-subtle)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>
                  Stage
                </th>
                <th style={{ padding: "4px 8px", fontWeight: 500 }}>
                  Duration
                </th>
                <th
                  style={{
                    padding: "4px 0 4px 8px",
                    fontWeight: 500,
                    textAlign: "right",
                  }}
                >
                  Δ vs median
                </th>
              </tr>
            </thead>
            <tbody>
              {tool.result.map((r, i) => {
                const isHighDelta =
                  r[2].startsWith("+") && parseInt(r[2]) > 20;
                return (
                  <tr key={i} className="border-t">
                    <td
                      style={{
                        padding: "4px 8px 4px 0",
                        color: "var(--fg)",
                      }}
                    >
                      {r[0]}
                    </td>
                    <td
                      style={{
                        padding: "4px 8px",
                        color: "var(--fg-muted)",
                      }}
                    >
                      {r[1]}
                    </td>
                    <td
                      style={{
                        padding: "4px 0 4px 8px",
                        textAlign: "right",
                        color: isHighDelta
                          ? "var(--accent-warn)"
                          : "var(--fg-muted)",
                      }}
                    >
                      {r[2]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** 代码块：带语言 + 路径 eyebrow + 复制按钮 */
interface CodePayload {
  language: string;
  path?: string;
  body: string;
}

function CodeBlock({ code }: { code: CodePayload }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="my-2 mb-3 overflow-hidden rounded-[8px] border"
      style={{ background: "var(--bg-elevated)" }}
    >
      {/* 文件眉 */}
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--fg-subtle)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>
          {code.language}
          {code.path ? ` · ${code.path}` : ""}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
          style={{
            border: 0,
            background: "transparent",
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
          }}
        >
          <Copy className="h-2.5 w-2.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.7,
          color: "var(--fg)",
          whiteSpace: "pre",
          overflowX: "auto",
        }}
      >
        {code.body}
      </pre>
    </div>
  );
}

/** 来源引用 chip 列表 */
function SourceChips({ sources }: { sources: [string, string][] }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: "10px 0 0",
        padding: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      {sources.map(([title, sub], i) => (
        <li
          key={i}
          style={{
            display: "inline-flex",
            flexDirection: "column",
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-elevated)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--fg)" }}>{title}</span>
          <span style={{ fontSize: 10.5, color: "var(--fg-subtle)" }}>
            {sub}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 单条聊天消息 */
interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** 以下字段为增强消息可选字段，用于工具卡 / 代码块 / 来源引用 */
  tool?: ToolResult;
  code?: CodePayload;
  contentNode?: ReactNode;
  sources?: [string, string][];
}

function ChatMessage({ msg }: { msg: MessageData }) {
  const at = msg.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          style={{
            maxWidth: "78%",
            padding: "10px 14px",
            borderRadius: 10,
            borderTopRightRadius: 4,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--fg)",
          }}
        >
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          <div
            style={{
              marginTop: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--fg-subtle)",
              textAlign: "right",
            }}
          >
            {at}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        {msg.tool && <ToolCard tool={msg.tool} />}
        {msg.code && <CodeBlock code={msg.code} />}
        {msg.contentNode ? (
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--fg)" }}>
            {msg.contentNode}
          </div>
        ) : msg.content ? (
          <div
            style={{ fontSize: 14, lineHeight: 1.65, color: "var(--fg)" }}
            className="whitespace-pre-wrap"
          >
            {msg.content}
          </div>
        ) : null}
        {msg.sources && <SourceChips sources={msg.sources} />}
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--fg-subtle)",
          }}
        >
          {at}
        </div>
      </div>
    </div>
  );
}

/** 打字中指示器 */
function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-3"
      style={{ color: "var(--fg-subtle)" }}
    >
      <AssistantAvatar />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
        }}
      >
        copilot is thinking…
      </span>
    </div>
  );
}

/** 编辑器附件小 chip */
function ComposerChip({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--fg-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      <Icon style={{ width: 11, height: 11 }} />
      {label}
      {typeof count === "number" && (
        <span style={{ color: "var(--fg-subtle)" }}>· {count}</span>
      )}
    </button>
  );
}

/** 对话编辑器 */
function Composer({
  draft,
  setDraft,
  onSend,
  onKeyDown,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height =
      Math.min(ref.current.scrollHeight, 200) + "px";
  }, [draft]);

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask copilot anything · type / for commands"
        rows={1}
        style={{
          width: "100%",
          resize: "none",
          border: 0,
          outline: "none",
          background: "transparent",
          color: "var(--fg)",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.55,
          padding: "4px 6px",
        }}
      />
      <div className="flex items-center gap-2">
        <ComposerChip icon={Plus} label="Attach" />
        <ComposerChip icon={GitBranch} label="api·main" />
        <ComposerChip icon={Zap} label="Tools" count={14} />
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={onSend}
          disabled={!draft.trim()}
          className="gap-1.5"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────── 主页面 ────────────────────────────

/**
 * 静态会话列表（对话历史），侧栏只读展示用。
 * 实际数据层接入时可替换为 API 数据，组件不变。
 */
const SIDEBAR_CONVOS = [
  {
    id: "c1",
    title: "Why is the api·main pipeline slow today?",
    date: "2m ago",
  },
  {
    id: "c2",
    title: "Draft a postmortem for v2.3.6 rollback",
    date: "1h ago",
  },
  {
    id: "c3",
    title: "Refactor approval-gate to support time windows",
    date: "yesterday",
  },
  {
    id: "c4",
    title: "Compare release strategies: canary vs blue-green",
    date: "yesterday",
  },
  {
    id: "c5",
    title: "Explain MTTR drop over past 7 days",
    date: "2 days ago",
  },
  {
    id: "c6",
    title: "Help me write a Spark job for backfill",
    date: "3 days ago",
  },
  { id: "c7", title: "Onboarding script for new SRE", date: "1 week ago" },
];

/**
 * 可选模型 —— 暂用 mock 数据；接入后端模型列表后替换 MODELS 即可，组件不变。
 */
interface ModelOption {
  id: string;
  label: string;
  vendor: string;
}

const MODELS: ModelOption[] = [
  { id: "gpt-4o", label: "GPT-4o", vendor: "OpenAI" },
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6", vendor: "Anthropic" },
  { id: "claude-opus-4.7", label: "Claude Opus 4.7", vendor: "Anthropic" },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", vendor: "Meta · self-hosted" },
];

/** 会话 header 内的模型切换下拉。 */
function ModelSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch model"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] text-fg-muted transition-colors hover:bg-accent/40 hover:text-foreground data-[state=open]:bg-accent/40 data-[state=open]:text-foreground"
        >
          <Cpu className="h-3.5 w-3.5 text-fg-subtle" />
          <span className="font-medium text-foreground">{current.label}</span>
          <ChevronDown className="h-3 w-3 text-fg-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="eyebrow eyebrow-arrow">
          Model
        </DropdownMenuLabel>
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="gap-2"
          >
            <span className="flex-1">
              <span className="block text-[13px]">{m.label}</span>
              <span className="block font-mono text-[10.5px] text-fg-subtle">
                {m.vendor}
              </span>
            </span>
            {m.id === value && (
              <Check className="h-3.5 w-3.5 text-brand-signal" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const Copilot: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const historyId = searchParams.get("historyId");
  const userState = userStore.useState();
  // userAvatar 数据层保留，待后续用户气泡头像接入时使用
  const userAvatar = userState.userinfo?.avatar || DEFAULT_USER_AVATAR;
  void userAvatar;

  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [chatTitle, setChatTitle] = useState(
    searchParams.get("title") || "New chat",
  );
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // 侧栏当前会话
  const [activeConvoId, setActiveConvoId] = useState("c1");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 加载历史对话（原有逻辑保留）
  useEffect(() => {
    if (historyId) {
      setLoading(true);
      setTimeout(() => {
        const mockHistoryMessages: MessageData[] = [
          {
            id: "1",
            role: "user",
            content: "如何优化模型的训练速度？",
            timestamp: new Date("2024-01-20T14:25:00Z"),
          },
          {
            id: "2",
            role: "assistant",
            content:
              "优化模型训练速度可以从以下几个方面入手：\n\n1. 数据预处理优化：使用数据管道并行处理，减少 I/O 等待时间\n2. 模型架构优化：使用更高效的网络结构\n3. 训练策略优化：使用混合精度训练、梯度累积等技术\n4. 硬件优化：使用 GPU 加速，合理设置 batch size\n5. 分布式训练：使用多 GPU 或多机训练来加速",
            timestamp: new Date("2024-01-20T14:26:00Z"),
          },
          {
            id: "3",
            role: "user",
            content: "能详细说说混合精度训练吗？",
            timestamp: new Date("2024-01-20T14:27:00Z"),
          },
          {
            id: "4",
            role: "assistant",
            content:
              "混合精度训练（Mixed Precision Training）是一种使用半精度（FP16）和单精度（FP32）混合进行训练的技术。主要优势包括：\n\n- 内存节省：FP16 占用内存是 FP32 的一半，可以训练更大的模型\n- 速度提升：现代 GPU 对 FP16 运算有专门优化，速度可提升 1.5–2 倍\n- 精度保持：关键操作仍使用 FP32，保证训练稳定性",
            timestamp: new Date("2024-01-20T14:28:00Z"),
          },
        ];

        setMessages(mockHistoryMessages);
        setChatTitle("关于机器学习模型的讨论");
        setLoading(false);
      }, 500);
    } else {
      setMessages([]);
      setChatTitle("New chat");
    }
  }, [historyId]);

  // 同步 chatTitle 到 URL（原有逻辑保留）
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

    const newMessage: MessageData = {
      id: Date.now().toString(),
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    setIsTyping(true);

    // 模拟 AI 回复
    setTimeout(() => {
      const aiResponse: MessageData = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "这是一个模拟的 AI 回复。实际应用中，这里会调用 AI API 来生成回复。",
        timestamp: new Date(),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 当前会话标题
  const activeTitle =
    messages.length > 0
      ? chatTitle
      : (SIDEBAR_CONVOS.find((c) => c.id === activeConvoId)?.title ??
        "New conversation");

  return (
    <>
      {/* ars-mono-inline 样式，供助手消息富文本引用使用 */}
      <style>{`
        .ars-mono-inline {
          font-family: var(--font-mono);
          font-size: 0.92em;
          padding: 1px 5px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--fg);
        }
      `}</style>

      <section
        style={{
          padding: 0,
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          height: "calc(100dvh - 56px)",
          minHeight: 600,
        }}
      >
        {/* ── 侧栏 ── */}
        <aside
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 标题区 */}
          <div
            style={{ padding: 16, borderBottom: "1px solid var(--border)" }}
          >
            <div className="eyebrow eyebrow-arrow">copilot</div>
            <h2
              className="display"
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "8px 0 12px",
              }}
            >
              Arcentra Copilot
            </h2>
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={() => {
                setMessages([]);
                setChatTitle("New chat");
                navigate("?", { replace: true });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New conversation
            </Button>
          </div>

          {/* 会话列表 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            <div
              className="eyebrow"
              style={{ padding: "8px 16px 4px" }}
            >
              History
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {SIDEBAR_CONVOS.map((c) => {
                const active = c.id === activeConvoId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveConvoId(c.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 16px",
                        border: 0,
                        background: active
                          ? "var(--bg-elevated)"
                          : "transparent",
                        boxShadow: active
                          ? "inset 2px 0 0 0 var(--brand-signal)"
                          : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          color: active ? "var(--fg)" : "var(--fg-muted)",
                          fontFamily: "var(--font-sans)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.title}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          color: "var(--fg-subtle)",
                          marginTop: 2,
                        }}
                      >
                        {c.date}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 底部状态 */}
          <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                background:
                  "color-mix(in oklab, var(--brand-signal) 6%, transparent)",
                border: "1px solid var(--brand-signal-dim)",
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: "var(--brand-signal)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--brand-signal)",
                }}
              >
                connected · {selectedModel} · 14 tools
              </span>
            </div>
          </div>
        </aside>

        {/* ── 主聊天区 ── */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {/* 会话 header */}
          <header
            style={{
              padding: "14px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                className="display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                {loading ? "Loading…" : activeTitle}
              </h3>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-subtle)",
                  marginTop: 2,
                }}
              >
                {messages.length} messages · 14 tool calls available
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <ModelSwitcher
                value={selectedModel}
                onChange={setSelectedModel}
              />
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Copy className="h-3 w-3" />
                Share
              </Button>
              <Button variant="ghost" size="sm">
                Archive
              </Button>
            </div>
          </header>

          {/* 消息滚动区 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
            <div
              style={{
                maxWidth: 760,
                margin: "0 auto",
                padding: "0 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {loading ? (
                <div
                  className="flex items-center justify-center py-16"
                  style={{ color: "var(--fg-subtle)" }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    Loading conversation…
                  </span>
                </div>
              ) : messages.length === 0 ? (
                /* 空态 */
                <div
                  className="flex flex-col items-center justify-center py-24 text-center"
                  style={{ gap: 16 }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{
                      width: 48,
                      height: 48,
                      border: "1px solid var(--brand-signal-dim)",
                      background:
                        "color-mix(in oklab, var(--brand-signal) 8%, transparent)",
                      color: "var(--brand-signal)",
                    }}
                  >
                    <Brain className="h-6 w-6" />
                  </span>
                  <div>
                    <p
                      className="display"
                      style={{ fontSize: 16, margin: 0 }}
                    >
                      Start your conversation
                    </p>
                    <p
                      style={{
                        marginTop: 6,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        color: "var(--fg-subtle)",
                      }}
                    >
                      Ask copilot anything · type / for commands
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
              )}

              {/* 打字中指示器 */}
              {isTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 编辑器区 */}
          <div style={{ padding: "16px 24px 24px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <Composer
                draft={message}
                setDraft={setMessage}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
              />
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-subtle)",
                }}
              >
                <span>↵ send · ⇧↵ newline · / for commands</span>
                <span>copilot may make mistakes — verify before applying to prod</span>
              </div>
            </div>
          </div>
        </main>
      </section>
    </>
  );
};

export default Copilot;
