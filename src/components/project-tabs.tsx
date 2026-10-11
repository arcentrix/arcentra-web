/**
 * ProjectTabs — 项目详情子标签条。
 *
 * 路由机制完全保留（Link-based，pathname 匹配）；
 * 视觉按 Engineering Blueprint inset-shadow pill 样式重做，
 * 并支持 count 角标。
 */

import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "overview", label: "Overview", match: "", count: undefined },
  {
    value: "pipelines",
    label: "Pipelines",
    match: "/pipelines",
    count: undefined,
  },
  {
    value: "deployments",
    label: "Deployments",
    match: "/deployments",
    count: undefined,
  },
  {
    value: "artifacts",
    label: "Artifacts",
    match: "/artifacts",
    count: undefined,
  },
  {
    value: "environments",
    label: "Environments",
    match: "/environments",
    count: undefined,
  },
  { value: "secrets", label: "Secrets", match: "/secrets", count: undefined },
  { value: "members", label: "Members", match: "/members", count: undefined },
  {
    value: "settings",
    label: "Settings",
    match: "/settings",
    count: undefined,
  },
] as const;

export function ProjectTabs({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  const base = `/projects/${projectId}`;
  const sub = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  // map current sub-path to tab value (handles nested routes like /pipelines/runs)
  let active: (typeof TABS)[number]["value"] = "overview";
  for (const tab of TABS) {
    if (tab.match === "") continue;
    if (sub === tab.match || sub.startsWith(`${tab.match}/`)) {
      active = tab.value;
      break;
    }
  }

  return (
    <Tabs value={active} className="w-full">
      <TabsList className="h-auto flex-wrap rounded-[10px] border bg-bg-elevated p-1">
        {TABS.map((tab) => {
          const isActive = tab.value === active;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              asChild
              className="h-7 gap-2 text-[13px] text-fg-muted data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_var(--border-strong)]"
            >
              <Link to={`${base}${tab.match}`}>
                {tab.label}
                {tab.count != null && (
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{
                      color: isActive ? "var(--fg-muted)" : "var(--fg-subtle)",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
