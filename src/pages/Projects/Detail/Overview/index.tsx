/**
 * Project Overview 子标签 — Engineering Blueprint 重做版本
 *
 * 数据层（useEffect 模拟加载、useState、useParams）完全保留；
 * 仅重写 JSX 结构与样式，按 prototype 的 4-stat + 2-col 分布实现。
 */

import type { FC } from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Panel, PanelHeader, StatusDot, SectionEyebrow } from "@/components/blueprint";
import { Skeleton } from "@/components/ui/skeleton";

/* ── 类型 ─────────────────────────────────────────────────────── */

interface PipelineStats {
  total: number;
  success: number;
  failure: number;
  running: number;
}

/* ── 主组件 ─────────────────────────────────────────────────────── */

const ProjectOverview: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);

  const [pipelineStats, setPipelineStats] = useState<PipelineStats>({
    total: 0,
    success: 0,
    failure: 0,
    running: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPipelineStats({ total: 156, success: 142, failure: 8, running: 6 });
      setLoading(false);
    };
    loadStats();
  }, [projectId]);

  const successRate =
    pipelineStats.total > 0
      ? ((pipelineStats.success / pipelineStats.total) * 100).toFixed(1)
      : "0.0";

  /* ── 4 张统计卡 ─────────────────────────────────────────────── */
  const statCards = [
    {
      label: "Pipelines (24h)",
      value: loading ? null : String(pipelineStats.total),
      sub: loading ? null : "+8 vs prev",
      subTone: "neutral" as const,
    },
    {
      label: "Success rate",
      value: loading ? null : `${successRate}%`,
      sub: loading ? null : "+1.4pp",
      subTone: "success" as const,
    },
    {
      label: "Failed runs",
      value: loading ? null : String(pipelineStats.failure),
      sub: loading ? null : `${pipelineStats.total > 0 ? ((pipelineStats.failure / pipelineStats.total) * 100).toFixed(1) : 0}% failure rate`,
      subTone: "neutral" as const,
    },
    {
      label: "Active deploys",
      value: loading ? null : String(pipelineStats.running),
      sub: loading ? null : "canary 25%",
      subTone: "neutral" as const,
    },
  ];

  /* ── 最近活动（静态示例） ─────────────────────────────────────── */
  const recentActivity = [
    { actor: "e.chen",     action: "approved release v2.4.0-rc.3",        tone: "info" as const, when: "2m ago" },
    { actor: "deploy-bot", action: "deployed v2.3.8 to production",        tone: "ok" as const,   when: "12m ago" },
    { actor: "mark.weber", action: "merged pr/auth-v2 into main",          tone: "ok" as const,   when: "32m ago" },
    { actor: "deploy-bot", action: "build #2148 succeeded",                tone: "ok" as const,   when: "1h ago" },
    { actor: "sara.li",    action: "rotated DATABASE_URL",                 tone: "ok" as const,   when: "3h ago" },
    { actor: "deploy-bot", action: "build #2145 failed at validate-output",tone: "fail" as const, when: "1d ago" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 统计卡行 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-background px-5 py-[18px]"
          >
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-subtle">
              {card.label}
            </span>
            {card.value == null ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <span className="reading font-mono text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {card.value}
              </span>
            )}
            {card.sub == null ? (
              <Skeleton className="h-3.5 w-24" />
            ) : (
              <span
                className="text-[12px] text-fg-muted"
                style={card.subTone === "success" ? { color: "var(--accent-success)" } : undefined}
              >
                {card.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 2 列：最近活动 + README 卡 */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* 最近活动 */}
        <Panel>
          <PanelHeader
            title="Recent activity"
            sub="Last 8 events on this project"
          />
          <ul className="m-0 list-none p-0">
            {recentActivity.map((a, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-3 text-[13px]"
                style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <StatusDot tone={a.tone} pulse={a.tone === "info"} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{a.actor}</span>
                  <span className="text-fg-muted"> · {a.action}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-fg-subtle">
                  {a.when}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* README 卡 */}
        <Panel className="p-5">
          <SectionEyebrow>readme</SectionEyebrow>
          <div className="mt-3 flex flex-col gap-2.5 text-[13px] leading-[1.65] text-fg-muted">
            <p className="m-0">
              Pixel-fidelity recreation of the customer-facing web client. Built
              on Vite + React 18 + TypeScript with Tailwind v4 (CSS-first).
            </p>
            <p className="m-0">
              Deploys ship through staging &rarr; production with canary rollouts
              (25 / 50 / 100). Owns the marketing landing pages and the in-app
              dashboard surfaces.
            </p>
            <div className="mt-2 border-t border-border pt-3 font-mono text-[11.5px] text-fg-subtle">
              <div># clone &amp; run</div>
              <div className="text-foreground">$ git clone …</div>
              <div className="text-foreground">$ pnpm install &amp;&amp; pnpm dev</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default ProjectOverview;
