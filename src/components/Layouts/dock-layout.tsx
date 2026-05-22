import type { FC } from "react";
import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDock } from "@/components/app-dock";
import { TopCommandBar } from "@/components/top-command-bar";
import { CommandPalette } from "@/components/command-palette";
import { CopilotPanel } from "@/components/copilot-panel";
import { uiShellStore } from "@/store/ui-shell";
import { cn } from "@/lib/utils";

const DockLayout: FC = () => {
  // dock 固定展开时，内容区左内边距随之扩大，页面自动收缩让位给菜单栏
  const { dockPinned } = uiShellStore.useState();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <AppDock />
        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-200 ease-out",
            dockPinned ? "pl-[180px]" : "pl-14",
          )}
        >
          <TopCommandBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        <CommandPalette />
        <CopilotPanel />
      </div>
    </TooltipProvider>
  );
};

export default DockLayout;
