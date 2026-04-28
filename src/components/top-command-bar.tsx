import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronsUpDown,
  Eclipse,
  Play,
  Plus,
  Rabbit,
  Search,
  Settings,
  Workflow,
} from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { APP_LOGO_ICON } from "@/constants/assets";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrgSettingsDialog } from "@/components/org-settings-dialog";
import { uiShellStore } from "@/store/ui-shell";

type Org = {
  name: string;
  logo: React.ElementType;
  plan: string;
};

const ORGS: Org[] = [
  { name: "Arcentra", logo: Workflow, plan: "Enterprise" },
  { name: "Acme Corp.", logo: Eclipse, plan: "Startup" },
  { name: "Evil Corp.", logo: Rabbit, plan: "Free" },
];

function CompactOrgSwitcher() {
  const [activeOrganization, setActiveOrganization] = React.useState(ORGS[0]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsMode, setSettingsMode] = React.useState<"create" | "edit">(
    "create",
  );
  const [selectedOrgId, setSelectedOrgId] = React.useState<
    string | undefined
  >();

  const handleCreateOrg = () => {
    setSettingsMode("create");
    setSelectedOrgId(undefined);
    setSettingsOpen(true);
  };

  const handleCurrentOrgSettings = () => {
    setSettingsMode("edit");
    setSelectedOrgId(activeOrganization.name);
    setSettingsOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none ring-ring transition-colors hover:bg-accent focus-visible:ring-2 data-[state=open]:bg-accent cursor-pointer">
          <img
            src={APP_LOGO_ICON}
            alt="Arcentra"
            className="h-5 w-5 shrink-0 rounded-sm"
          />
          <span className="line-clamp-1 max-w-[140px]">
            {activeOrganization.name}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64" sideOffset={6}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          {ORGS.map((org) => {
            const Logo = org.logo;
            return (
              <DropdownMenuItem
                className="items-start gap-2 px-1.5"
                key={org.name}
                onClick={() => setActiveOrganization(org)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                  <Logo className="h-5 w-5 shrink-0" />
                </div>
                <div className="grid flex-1 leading-tight">
                  <div className="line-clamp-1 font-medium">{org.name}</div>
                  <div className="overflow-hidden text-xs text-muted-foreground">
                    <div className="line-clamp-1">{org.plan}</div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 px-1.5" onClick={handleCreateOrg}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              <Plus className="h-4 w-4" />
            </div>
            <div className="font-medium text-muted-foreground">
              Create Organization
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 px-1.5"
            onClick={handleCurrentOrgSettings}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              <Settings className="h-4 w-4" />
            </div>
            <div className="font-medium text-muted-foreground">
              Organization Settings
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OrgSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode={settingsMode}
        organizationId={selectedOrgId}
      />
    </>
  );
}

export function TopCommandBar() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <CompactOrgSwitcher />
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

      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => {
          navigate("/build");
        }}
      >
        <Play className="h-4 w-4" />
        Trigger Pipeline
      </Button>
    </header>
  );
}
