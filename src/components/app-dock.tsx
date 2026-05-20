import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Bot,
  Frame,
  Github,
  Hammer,
  LayoutDashboard,
  MessageCircle,
  type LucideIcon,
  PanelLeft,
  PanelLeftClose,
  Rocket,
  Search,
  Settings2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ENV } from "@/constants/env";
import { NavUserDockTrigger } from "@/components/nav-user-dock-trigger";
import { uiShellStore } from "@/store/ui-shell";
import permissionStore from "@/store/permission";

type DockItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
};

const FALLBACK_ITEMS: DockItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Projects", url: "/projects", icon: Frame },
  { title: "Build", url: "/build", icon: Hammer },
  { title: "Deploy", url: "/deploy", icon: Rocket },
  { title: "Agents", url: "/agents", icon: Bot },
  { title: "Observe", url: "/observe", icon: Activity },
  { title: "Secure", url: "/secure", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings2 },
];

const PEEK_DELAY_MS = 300;

const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard,
  Frame,
  Hammer,
  Rocket,
  Bot,
  Activity,
  Shield,
  Settings2,
};

function resolveIcon(iconName?: string): LucideIcon {
  if (!iconName) return Frame;
  return iconRegistry[iconName] ?? Frame;
}

function isActive(pathname: string, item: DockItem) {
  if (item.exact) return pathname === item.url;
  return pathname === item.url || pathname.startsWith(`${item.url}/`);
}

function ItemLabel({
  expanded,
  children,
  className,
}: {
  expanded: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 flex-1 truncate text-left transition-opacity duration-150",
        expanded ? "opacity-100 delay-75" : "opacity-0",
        className,
      )}
      aria-hidden={!expanded}
    >
      {children}
    </span>
  );
}

function DockButton({
  item,
  active,
  expanded,
}: {
  item: DockItem;
  active: boolean;
  expanded: boolean;
}) {
  const content = (
    <Link
      to={item.url}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-[12.5px] transition-colors duration-150 cursor-pointer",
        "text-muted-foreground hover:text-foreground hover:bg-accent/40",
        active && "text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-r-full bg-brand-signal"
          style={{
            boxShadow:
              "0 0 6px color-mix(in oklab, var(--brand-signal) 50%, transparent)",
          }}
        />
      )}
      <item.icon className="h-4 w-4 shrink-0" />
      <ItemLabel expanded={expanded}>{item.title}</ItemLabel>
    </Link>
  );

  if (expanded) return content;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
}

function ActionButton({
  label,
  icon: Icon,
  iconClassName,
  ariaLabel,
  expanded,
  onClick,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  iconClassName?: string;
  ariaLabel?: string;
  expanded: boolean;
  onClick: () => void;
  hint?: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={cn(
        "flex h-9 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-[12.5px] transition-colors duration-150 cursor-pointer",
        "text-muted-foreground hover:text-foreground hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
      <ItemLabel expanded={expanded}>{label}</ItemLabel>
      {hint && (
        <span
          className={cn(
            "shrink-0 transition-opacity duration-150",
            expanded ? "opacity-100 delay-75" : "opacity-0",
          )}
          aria-hidden={!expanded}
        >
          {hint}
        </span>
      )}
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ExternalLinkButton({
  label,
  icon: Icon,
  href,
  expanded,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  expanded: boolean;
}) {
  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "flex h-9 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-[12.5px] transition-colors duration-150 cursor-pointer",
        "text-muted-foreground hover:text-foreground hover:bg-accent/40",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <ItemLabel expanded={expanded}>{label}</ItemLabel>
    </a>
  );

  if (expanded) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppDock() {
  const location = useLocation();
  const permission = permissionStore.useState();
  const { dockPinned } = uiShellStore.useState();
  // 悬停预览：未固定时鼠标移入短暂展开（覆盖在内容上，不挤压内容）
  const [peeking, setPeeking] = useState(false);
  const enterTimer = useRef<number | null>(null);

  // 视觉展开 = 已固定展开 或 悬停预览中
  const expanded = dockPinned || peeking;

  const primaryItems: DockItem[] =
    permission.menus.length > 0
      ? permission.menus
          .filter((menu) => menu.isVisible !== false && !!menu.path)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((menu) => ({
            title: menu.title || menu.name,
            url: menu.path,
            icon: resolveIcon(menu.icon),
            exact: menu.path === "/",
          }))
      : FALLBACK_ITEMS;

  useEffect(() => {
    return () => {
      if (enterTimer.current) window.clearTimeout(enterTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (dockPinned) return; // 已固定展开，无需悬停预览
    if (enterTimer.current) window.clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(
      () => setPeeking(true),
      PEEK_DELAY_MS,
    );
  };

  const handleMouseLeave = () => {
    if (enterTimer.current) {
      window.clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    setPeeking(false);
  };

  return (
    <nav
      aria-label="Primary"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-background pt-0 pb-2 shadow-[1px_0_0_0_transparent] transition-[width] duration-200 ease-out",
        expanded ? "w-[180px] shadow-md" : "w-14",
      )}
    >
      {/* 顶部仅作收起/展开开关 —— 工作区名称由顶栏承载，此处不再重复品牌名 */}
      <div className="flex h-12 items-center px-1">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => uiShellStore.toggleDockPinned()}
              aria-label={dockPinned ? "Collapse sidebar" : "Expand sidebar"}
              aria-pressed={dockPinned}
              className={cn(
                "flex h-9 w-full items-center rounded-md px-[18px] text-fg-subtle transition-colors duration-150 cursor-pointer",
                "hover:bg-accent/40 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {dockPinned ? (
                <PanelLeftClose className="h-4 w-4 shrink-0" />
              ) : (
                <PanelLeft className="h-4 w-4 shrink-0" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {dockPinned ? "Collapse sidebar" : "Expand sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mx-2 h-px bg-border/60" aria-hidden />

      <div className="pt-2 px-1">
        <ActionButton
          label="Search"
          icon={Search}
          expanded={expanded}
          onClick={() => uiShellStore.openPalette()}
          hint={
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <kbd className="rounded border border-border/40 bg-background px-1 py-px font-mono">
                ⌘
              </kbd>
              <kbd className="rounded border border-border/40 bg-background px-1 py-px font-mono">
                K
              </kbd>
            </span>
          }
        />
      </div>

      <ul className="mt-1 flex flex-col gap-0.5 px-1">
        {primaryItems.map((item) => (
          <li key={item.url}>
            <DockButton
              item={item}
              active={isActive(location.pathname, item)}
              expanded={expanded}
            />
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-0.5 px-1">
        <ExternalLinkButton
          label="Discord"
          icon={MessageCircle}
          href={ENV.DISCORD_INVITE_URL}
          expanded={expanded}
        />
        <ExternalLinkButton
          label="GitHub"
          icon={Github}
          href={`https://github.com/${ENV.GITHUB_REPO}`}
          expanded={expanded}
        />
        <NavUserDockTrigger expanded={expanded} />
      </div>
    </nav>
  );
}
