import { useNavigate } from "react-router-dom";
import { ArrowRight, History, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { uiShellStore } from "@/store/ui-shell";

const DEFAULT_WORKSPACE = "ML Model Training";

const SUGGESTED_PROMPTS = [
  "Why did this pipeline fail?",
  "Generate a deploy config for staging.",
  "Explain recent failures across projects.",
  "Create a GitOps app from this repo.",
  "Summarize last 24h of pipeline activity.",
];

function CopilotFab() {
  const { copilotOpen } = uiShellStore.useState();

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ask AI"
          onClick={() => uiShellStore.toggleCopilot()}
          className={cn(
            "fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border bg-background shadow-lg transition-colors duration-150 cursor-pointer",
            "hover:bg-accent/60 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            copilotOpen && "bg-accent/60",
          )}
        >
          <Sparkles className="h-5 w-5 text-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        Ask AI
      </TooltipContent>
    </Tooltip>
  );
}

export function CopilotPanel() {
  const navigate = useNavigate();
  const { copilotOpen } = uiShellStore.useState();

  const openFullChat = (prompt?: string) => {
    uiShellStore.closeCopilot();
    const search = prompt ? `?title=${encodeURIComponent(prompt)}` : "";
    navigate(
      `/workspace/${encodeURIComponent(DEFAULT_WORKSPACE)}/chat${search}`,
    );
  };

  return (
    <>
      <CopilotFab />
      <Sheet open={copilotOpen} onOpenChange={uiShellStore.setCopilotOpen}>
        <SheetContent
          side="right"
          className="flex w-[420px] flex-col gap-0 p-0 sm:max-w-[420px]"
        >
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Ask AI
            </SheetTitle>
            <SheetDescription>
              Talk to your platform — ask about pipelines, deployments, agents,
              or generate config.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested prompts
              </div>
              <ul className="grid gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => openFullChat(prompt)}
                      className="group flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-accent/60 cursor-pointer"
                    >
                      <span className="line-clamp-1">{prompt}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              The full conversation experience lives in workspace chat. Pick a
              prompt above or open the full chat below to keep context across
              sessions.
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t p-4">
            <Button size="sm" className="gap-2" onClick={() => openFullChat()}>
              <MessageSquare className="h-4 w-4" />
              Open full chat
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                uiShellStore.closeCopilot();
                navigate(
                  `/workspace/${encodeURIComponent(DEFAULT_WORKSPACE)}/history`,
                );
              }}
            >
              <History className="h-4 w-4" />
              View history
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
