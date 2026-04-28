import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bot,
  ExternalLink,
  Hammer,
  LayoutDashboard,
  type LucideIcon,
  Play,
  Plus,
  Rocket,
  Search,
  Settings2,
  Shield,
  Sparkles,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { uiShellStore } from "@/store/ui-shell";

type CommandItem = {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  group: "Pages" | "Actions" | "Documentation";
  /** keywords used for filtering */
  keywords?: string[];
  /** internal route */
  to?: string;
  /** external href */
  href?: string;
  /** custom action */
  onSelect?: () => void;
};

const PAGE_ITEMS: Omit<CommandItem, "group">[] = [
  {
    id: "overview",
    title: "Overview",
    description: "Dashboard",
    icon: LayoutDashboard,
    to: "/",
  },
  {
    id: "build",
    title: "Build",
    description: "Pipelines · Runs · Artifacts",
    icon: Hammer,
    to: "/build",
  },
  {
    id: "deploy",
    title: "Deploy",
    description: "Deployments · Environments · Releases",
    icon: Rocket,
    to: "/deploy",
  },
  {
    id: "agents",
    title: "Agents",
    description: "Runtime · Marketplace · Runners",
    icon: Bot,
    to: "/agents",
  },
  {
    id: "observe",
    title: "Observe",
    description: "Logs · Metrics · Traces · Audit",
    icon: Activity,
    to: "/observe",
  },
  {
    id: "secure",
    title: "Secure",
    description: "Access · Secrets · Policies",
    icon: Shield,
    to: "/secure",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Workspace · Integrations · Billing",
    icon: Settings2,
    to: "/settings",
  },
];

const ACTION_ITEMS: Omit<CommandItem, "group">[] = [
  {
    id: "action-trigger-pipeline",
    title: "Trigger Pipeline",
    description: "Run a pipeline now",
    icon: Play,
    to: "/build",
    keywords: ["run", "execute", "start"],
  },
  {
    id: "action-create-project",
    title: "Create Project",
    description: "Open the projects page",
    icon: Plus,
    to: "/projects",
  },
  {
    id: "action-ask-arcentra",
    title: "Ask AI",
    description: "Open the AI copilot panel",
    icon: Sparkles,
    onSelect: () => uiShellStore.openCopilot(),
    keywords: ["ai", "copilot", "llm", "chat"],
  },
];

const DOC_ITEMS: Omit<CommandItem, "group">[] = [
  {
    id: "doc-getting-started",
    title: "Getting Started",
    description: "Learn how to get started with Arcentra",
    icon: ExternalLink,
    href: "https://docs.arcentra.io/getting-started",
  },
  {
    id: "doc-pipelines",
    title: "Pipeline Configuration",
    description: "Guide on configuring and managing pipelines",
    icon: ExternalLink,
    href: "https://docs.arcentra.io/pipelines/configuration",
  },
  {
    id: "doc-agents",
    title: "Agent Management",
    description: "Creating and managing AI agents",
    icon: ExternalLink,
    href: "https://docs.arcentra.io/agents/management",
  },
  {
    id: "doc-api",
    title: "API Reference",
    description: "Complete API reference",
    icon: ExternalLink,
    href: "https://docs.arcentra.io/api/reference",
  },
  {
    id: "doc-deploy",
    title: "Deployment Guide",
    description: "Step-by-step deployment guide",
    icon: ExternalLink,
    href: "https://docs.arcentra.io/deployment/guide",
  },
];

const ALL_ITEMS: CommandItem[] = [
  ...PAGE_ITEMS.map((i) => ({ ...i, group: "Pages" as const })),
  ...ACTION_ITEMS.map((i) => ({ ...i, group: "Actions" as const })),
  ...DOC_ITEMS.map((i) => ({ ...i, group: "Documentation" as const })),
];

function matches(item: CommandItem, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystack = [
    item.title,
    item.description ?? "",
    item.group,
    ...(item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { paletteOpen } = uiShellStore.useState();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // global ⌘K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        uiShellStore.togglePalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // reset when closed
  useEffect(() => {
    if (!paletteOpen) {
      setQuery("");
      setActiveIndex(0);
    } else {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [paletteOpen]);

  const filtered = useMemo(
    () => ALL_ITEMS.filter((i) => matches(i, query)),
    [query],
  );

  // group filtered items
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      groups[item.group] = groups[item.group] ?? [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filtered]);

  // flat list of items in render order, used for keyboard nav
  const flat = useMemo(() => {
    return ["Pages", "Actions", "Documentation"].flatMap(
      (g) => grouped[g] ?? [],
    );
  }, [grouped]);

  // clamp activeIndex when filtered changes
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(0);
  }, [flat.length, activeIndex]);

  const runItem = useCallback(
    (item: CommandItem) => {
      uiShellStore.closePalette();
      if (item.onSelect) {
        item.onSelect();
        return;
      }
      if (item.href) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        return;
      }
      if (item.to) {
        navigate(item.to);
      }
    },
    [navigate],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) runItem(item);
    }
  };

  return (
    <Dialog open={paletteOpen} onOpenChange={uiShellStore.setPaletteOpen}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[18vh] z-50 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <DialogPrimitive.Title className="sr-only">
            Command Palette
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search projects, pipelines, agents…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center justify-center rounded border border-border/40 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              esc
            </kbd>
          </div>

          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              {flat.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              )}

              {(["Pages", "Actions", "Documentation"] as const).map(
                (groupName) => {
                  const items = grouped[groupName];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={groupName} className="mb-2 last:mb-0">
                      <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {groupName}
                      </div>
                      <ul className="grid gap-0.5">
                        {items.map((item) => {
                          const flatIndex = flat.indexOf(item);
                          const isActive = flatIndex === activeIndex;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onMouseEnter={() => setActiveIndex(flatIndex)}
                                onClick={() => runItem(item)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors cursor-pointer",
                                  isActive
                                    ? "bg-accent text-accent-foreground"
                                    : "text-foreground hover:bg-accent/60",
                                )}
                              >
                                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-1 font-medium">
                                    {item.title}
                                  </div>
                                  {item.description && (
                                    <div className="line-clamp-1 text-xs text-muted-foreground">
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                },
              )}
            </div>
          </ScrollArea>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
