import type { FC } from "react";
import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDock } from "@/components/app-dock";
import { TopCommandBar } from "@/components/top-command-bar";
import { CommandPalette } from "@/components/command-palette";
import { CopilotPanel } from "@/components/copilot-panel";

const DockLayout: FC = () => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <AppDock />
        <div className="flex min-h-screen flex-col pl-14">
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
