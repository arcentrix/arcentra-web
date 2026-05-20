import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronsUpDown,
  HelpCircle,
  KeyRound,
  LogOut,
  Megaphone,
  Settings,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Apis } from "@/api";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { logout as globalLogout } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { ENV } from "@/constants/env";
import { cn } from "@/lib/utils";
import { DEFAULT_USER_AVATAR } from "@/constants/assets";

interface DockUser {
  name: string;
  email: string;
  avatar: string;
  role?: string;
  workspace?: string;
}

const DEFAULT_USER: DockUser = {
  name: "User",
  email: "user@example.com",
  avatar: DEFAULT_USER_AVATAR,
  workspace: "Arcentra",
};

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getRoleLabel(rawRole?: string, isSuperAdmin?: number) {
  if (isSuperAdmin === 1) return "Owner";
  if (!rawRole) return "Member";
  const r = rawRole.toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "viewer") return "Viewer";
  return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
  destructive?: boolean;
}

function MenuItem({
  icon,
  label,
  hint,
  destructive,
  className,
  ...rest
}: MenuItemProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-[13px] outline-none transition-colors duration-150 cursor-pointer",
        destructive
          ? "text-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-foreground hover:bg-accent/60",
        "focus-visible:bg-accent/60",
        className,
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {hint && (
        <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
      )}
    </button>
  );
}

export function NavUserDockTrigger({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  const navigate = useNavigate();
  const [user, setUser] = useState<DockUser>(DEFAULT_USER);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchUserInfo = async () => {
      const storedUserInfo = userStore.getState().userinfo;
      if (storedUserInfo) {
        const displayName = storedUserInfo.fullName || storedUserInfo.username;
        setUser({
          name: displayName,
          email: storedUserInfo.email,
          avatar: storedUserInfo.avatar || DEFAULT_USER_AVATAR,
          role: getRoleLabel(
            (storedUserInfo as { role?: string }).role,
            (storedUserInfo as { isSuperAdmin?: number }).isSuperAdmin,
          ),
          workspace: "Arcentra",
        });
        return;
      }

      const authState = authStore.getState();
      if (!authState.accessToken) return;

      try {
        const userInfo = await Apis.user.getUserInfo();
        const displayName = userInfo.fullName || userInfo.username;
        setUser({
          name: displayName,
          email: userInfo.email,
          avatar: userInfo.avatar || DEFAULT_USER_AVATAR,
          role: getRoleLabel(
            (userInfo as { role?: string }).role,
            (userInfo as { isSuperAdmin?: number }).isSuperAdmin,
          ),
          workspace: "Arcentra",
        });
        userStore.updateState((state) => {
          state.userinfo = userInfo;
        });
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    setPopoverOpen(false);
    try {
      await globalLogout();
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed", (error as Error).message);
    }
  };

  /** 关闭菜单后跳转应用内路由。 */
  const goTo = (path: string) => () => {
    setPopoverOpen(false);
    navigate(path);
  };

  /** 关闭菜单后打开外部链接。 */
  const openExternal = (url: string) => () => {
    setPopoverOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const initials = getInitials(user.name);

  const triggerButton = (
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={user.name}
        className={cn(
          "flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[14px] pr-3 cursor-pointer outline-none transition-colors duration-150",
          "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent/40",
        )}
      >
        <Avatar className="h-7 w-7 shrink-0 rounded-md border">
          <AvatarImage alt={user.name} src={user.avatar} />
          <AvatarFallback className="rounded-md text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm font-medium transition-opacity duration-150",
            expanded ? "opacity-100 delay-75" : "opacity-0",
          )}
          aria-hidden={!expanded}
        >
          {user.name}
        </span>
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      {expanded ? (
        triggerButton
      ) : (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {user.name}
          </TooltipContent>
        </Tooltip>
      )}

      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-72 rounded-xl p-2 shadow-xl"
      >
        {/* 身份块 */}
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="relative">
            <Avatar className="h-10 w-10 rounded-md border">
              <AvatarImage alt={user.name} src={user.avatar} />
              <AvatarFallback className="rounded-md text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold leading-tight">
                {user.name}
              </span>
              {user.role && (
                <Badge
                  variant="outline"
                  className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
                >
                  {user.role}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>

        {/* 工作区切换器 */}
        <div className="mt-1 px-2">
          <div className="eyebrow mb-1.5">Workspace</div>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-bg-elevated px-1.5 py-1.5 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-signal text-[9px] font-bold text-background">
              {(user.workspace ?? "A").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {user.workspace}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-fg-subtle" />
          </button>
        </div>

        <div className="my-1.5 h-px bg-border" />

        {/* 账户相关 */}
        <div className="grid gap-0.5">
          <MenuItem
            icon={<UserRound className="h-4 w-4" />}
            label="Account"
            onClick={goTo("/account")}
          />
          <MenuItem
            icon={<Settings className="h-4 w-4" />}
            label="Preferences"
            onClick={goTo("/account?tab=preferences")}
          />
          <MenuItem
            icon={<KeyRound className="h-4 w-4" />}
            label="API tokens"
            onClick={goTo("/account?tab=tokens")}
          />
          <MenuItem
            icon={<UserPlus className="h-4 w-4" />}
            label="Invite teammates"
            onClick={goTo("/secure?tab=users")}
          />
        </div>

        <div className="my-1.5 h-px bg-border" />

        {/* 帮助 */}
        <div className="grid gap-0.5">
          <MenuItem
            icon={<HelpCircle className="h-4 w-4" />}
            label="Help & docs"
            onClick={openExternal("https://docs.arcentra.io/")}
          />
          <MenuItem
            icon={<Megaphone className="h-4 w-4" />}
            label="What's new"
            onClick={openExternal(
              `https://github.com/${ENV.GITHUB_REPO}/releases`,
            )}
          />
        </div>

        <div className="my-1.5 h-px bg-border" />

        <MenuItem
          icon={<LogOut className="h-4 w-4" />}
          label="Sign out"
          onClick={handleLogout}
          destructive
        />
      </PopoverContent>
    </Popover>
  );
}
