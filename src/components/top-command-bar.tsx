import { useNavigate } from "react-router-dom";
import {
  Bell,
  Frame,
  Moon,
  Play,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { useTheme } from "@/hooks/use-theme";
import { APP_LOGO_ICON } from "@/constants/assets";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { uiShellStore } from "@/store/ui-shell";

// 暂无后端工作区接口，名称先固定；接入工作区后替换为真实数据。
const WORKSPACE_NAME = "Arcentra";

/** 当前工作区标识 —— 仅展示名称，无组织切换。 */
function WorkspaceLabel() {
  return (
    <div
      className="flex shrink-0 items-center gap-2 px-1"
      aria-label={`Workspace: ${WORKSPACE_NAME}`}
    >
      <img
        src={APP_LOGO_ICON}
        alt=""
        className="h-5 w-5 shrink-0 rounded-sm"
      />
      <span className="font-mono text-[13px] font-medium">
        {WORKSPACE_NAME}
      </span>
    </div>
  );
}

export function TopCommandBar() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  // 暂无收件箱 store，未读数先用占位；接入 Inbox 后替换为真实计数。
  const unreadCount: number = 0;

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <WorkspaceLabel />
      <div className="h-4 w-px bg-border/60" aria-hidden />
      <Breadcrumb className="min-w-0" />

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => uiShellStore.openPalette()}
        aria-label="Open command palette"
        className="inline-flex h-8 w-64 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Search…</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>

      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label={
          resolvedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme"
        }
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground cursor-pointer"
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-3.5 w-3.5" />
        ) : (
          <Moon className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={() => navigate("/inbox")}
        aria-label="Inbox"
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground cursor-pointer"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-brand-signal px-1 font-mono text-[10px] font-semibold tabular-nums text-background">
            {unreadCount}
          </span>
        )}
      </button>

      {/* 创建入口：「+」按钮，下拉常用操作 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Create new"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground data-[state=open]:bg-accent/40 data-[state=open]:text-foreground cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-56">
          <DropdownMenuLabel className="eyebrow eyebrow-arrow">
            Quick actions
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => navigate("/build")}
          >
            <Play className="h-4 w-4 text-muted-foreground" />
            Trigger pipeline
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => navigate("/deploy")}
          >
            <Rocket className="h-4 w-4 text-muted-foreground" />
            New deployment
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => navigate("/projects")}
          >
            <Frame className="h-4 w-4 text-muted-foreground" />
            New project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => uiShellStore.toggleCopilot()}
          >
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Ask AI
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
