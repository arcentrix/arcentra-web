/**
 * Settings Hub —— 配置中心首页
 */

import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Info,
  KeyRound,
  Settings2,
  Sliders,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { listSettings } from "@/api/general-settings";
import { getVersionInfo, type VersionInfo } from "@/api/system";
import { cn } from "@/lib/utils";

type Tone = "sky" | "emerald" | "violet" | "amber" | "cyan";

const TONE_BG: Record<Tone, string> = {
  sky: "bg-sky-500/10 text-sky-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  violet: "bg-violet-500/10 text-violet-500",
  amber: "bg-amber-500/10 text-amber-500",
  cyan: "bg-cyan-500/10 text-cyan-500",
};

interface HubCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta?: string;
  tone: Tone;
}

const HubCard: FC<HubCardProps> = ({
  to,
  icon: Icon,
  title,
  description,
  meta,
  tone,
}) => (
  <Link
    to={to}
    className="group flex items-start gap-4 rounded-lg border bg-card p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm cursor-pointer"
  >
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
        TONE_BG[tone],
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {meta && <div className="mt-3 text-xs text-muted-foreground">{meta}</div>}
    </div>
  </Link>
);

const SettingsPage: FC = () => {
  const [generalCount, setGeneralCount] = useState<number | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSettings()
      .then((data) => {
        if (!cancelled) setGeneralCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (!cancelled) setGeneralCount(null);
      });
    getVersionInfo()
      .then((info) => {
        if (!cancelled) setVersion(info);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div>
        <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Settings2 className="h-8 w-8" />
          Settings
        </h2>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Configure platform-wide preferences, integrations and runtime
          behavior.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HubCard
          to="/general-settings"
          icon={Sliders}
          title="General Settings"
          description="Platform-wide configuration values used by Arcentra."
          meta={
            generalCount !== null
              ? `${generalCount} configuration items`
              : "Loading…"
          }
          tone="sky"
        />
        <HubCard
          to="/settings/notifications"
          icon={Bell}
          title="Notifications"
          description="Manage notification channels, templates and routing rules."
          tone="emerald"
        />
        <HubCard
          to="/identity-integration"
          icon={KeyRound}
          title="Identity"
          description="Configure SSO, identity providers and login policies."
          tone="violet"
        />
        <HubCard
          to="/settings/system-info"
          icon={Info}
          title="System Information"
          description="View version, runtime environment and installed components."
          meta={
            version ? `v${version.version} · ${version.platform}` : undefined
          }
          tone="cyan"
        />
        <HubCard
          to="/general-settings?tab=advanced"
          icon={SlidersHorizontal}
          title="Advanced Config"
          description="Edit raw key-value configuration. Engineering use only."
          tone="amber"
        />
      </div>
    </div>
  );
};

export default SettingsPage;
