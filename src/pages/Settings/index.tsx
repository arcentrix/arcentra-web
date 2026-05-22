/**
 * Settings —— 左侧分区导航 + 右侧分区主体的单页配置中心。
 * 各分区复用既有功能页（headless 模式），独立路由仍可单独访问。
 */

import { type FC } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Fingerprint,
  Info,
  KeyRound,
  type LucideIcon,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { PlaceholderPanel } from "@/components/placeholder-panel";
import GeneralSettingsPage from "@/pages/GeneralSettings";
import NotificationsPage from "@/pages/Settings/Notifications";
import IdentityPage from "@/pages/Identity";
import SystemInfoPage from "@/pages/Settings/SystemInfo";

type SectionId =
  | "general"
  | "notifications"
  | "identity"
  | "system"
  | "tokens";

interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: SectionDef[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "identity", label: "Identity", icon: Fingerprint },
  { id: "system", label: "System info", icon: Info },
  { id: "tokens", label: "API tokens", icon: KeyRound },
];

const VALID_SECTIONS = SECTIONS.map((s) => s.id);

function isSection(value: string | null): value is SectionId {
  return !!value && (VALID_SECTIONS as string[]).includes(value);
}

const SettingsPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get("section");
  const section: SectionId = isSection(rawSection) ? rawSection : "general";

  const onSelect = (next: SectionId) => {
    const params = new URLSearchParams(searchParams);
    if (next === "general") params.delete("section");
    else params.set("section", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="workspace / configuration"
        title="Settings"
        sub="Platform-wide preferences, integrations and runtime behavior."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr] md:items-start">
        <nav className="flex flex-col gap-0.5" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = id === section;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={active ? "page" : undefined}
                style={
                  active
                    ? { boxShadow: "inset 2px 0 0 0 var(--brand-signal)" }
                    : undefined
                }
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors",
                  active
                    ? "bg-bg-elevated font-medium text-foreground"
                    : "text-fg-muted hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === "general" && <GeneralSettingsPage headless />}
          {section === "notifications" && <NotificationsPage headless />}
          {section === "identity" && <IdentityPage headless />}
          {section === "system" && <SystemInfoPage headless />}
          {section === "tokens" && (
            <PlaceholderPanel
              icon={KeyRound}
              title="API tokens"
              description="Issue and revoke personal and workspace API tokens, scope their permissions and review last-used activity. API not yet available."
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
