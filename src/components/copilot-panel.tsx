import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopilotConsole } from "@/components/copilot-console";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { uiShellStore } from "@/store/ui-shell";

export function CopilotPanel() {
  const { copilotOpen } = uiShellStore.useState();
  const location = useLocation();
  const previousLocation = useRef(location);
  const routeChanged = previousLocation.current !== location;
  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      uiShellStore.closeCopilot();
    }
  }, [location]);
  return (
    <Sheet
      open={copilotOpen && !routeChanged}
      onOpenChange={uiShellStore.setCopilotOpen}
    >
      {/* Mobile reserves a row outside the scrollport so no action is covered. */}
      <div className="flex shrink-0 justify-end border-t bg-background py-2 pl-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:contents">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open Copilot"
                className={cn(
                  "z-30 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-background shadow-lg transition-colors duration-150 sm:fixed sm:bottom-6 sm:right-6",
                  "outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                  copilotOpen && "bg-accent/60",
                )}
              >
                <Sparkles className="h-5 w-5 text-foreground" aria-hidden />
              </button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            Copilot · Read-only analysis
          </TooltipContent>
        </Tooltip>
      </div>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]"
      >
        <SheetHeader className="border-b p-4 pr-10 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" aria-hidden />
            Copilot
          </SheetTitle>
          <SheetDescription>
            Analyze selected run context with an approved provider.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {copilotOpen && !routeChanged && <CopilotConsole />}
        </div>
        <nav
          className="flex gap-2 border-t p-4"
          aria-label="Available platform tools"
        >
          <Button asChild size="sm" variant="outline">
            <Link to="/build" onClick={uiShellStore.closeCopilot}>
              Open Build
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/workspace/Copilot/chat"
              onClick={uiShellStore.closeCopilot}
            >
              Open full Copilot
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
