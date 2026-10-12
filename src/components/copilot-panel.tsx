import { Link } from "react-router-dom";
import { Bot, Hammer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/blueprint";
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

  return (
    <Sheet open={copilotOpen} onOpenChange={uiShellStore.setCopilotOpen}>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Copilot status"
              className={cn(
                "fixed bottom-6 right-6 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border bg-background shadow-lg transition-colors duration-150",
                "outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                copilotOpen && "bg-accent/60",
              )}
            >
              <Sparkles className="h-5 w-5 text-foreground" aria-hidden />
            </button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Copilot status · Not integrated
        </TooltipContent>
      </Tooltip>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b p-4 pr-10 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" aria-hidden />
            Copilot status
          </SheetTitle>
          <SheetDescription>
            AI chat is not integrated in this build.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div>
            <StatusBadge tone="muted">Not integrated</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            Messages, conversation history, and AI tool actions are unavailable.
            This panel does not send prompts or project data to an AI provider.
          </p>
          <nav aria-label="Available platform tools" className="grid gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/build" onClick={uiShellStore.closeCopilot}>
                <Hammer aria-hidden />
                Open Build
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/agents" onClick={uiShellStore.closeCopilot}>
                <Bot aria-hidden />
                View Agents
              </Link>
            </Button>
          </nav>
        </div>
        <div className="border-t p-4">
          <Button asChild size="sm" className="w-full">
            <Link
              to="/workspace/Copilot/chat"
              onClick={uiShellStore.closeCopilot}
            >
              View Copilot status
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
