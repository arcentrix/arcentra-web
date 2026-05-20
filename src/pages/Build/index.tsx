import { useState } from "react";
import type { FC } from "react";
import {
  ArrowUpRight,
  Check,
  GitBranch,
  Loader,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  FilterPill,
  Panel,
  PanelHeader,
  SectionEyebrow,
  StatusBadge,
  StatusDot,
  type BadgeTone,
  type DotTone,
} from "@/components/blueprint";

/* ──────────────────────── 数据类型 ──────────────────────────── */

type PipelineStatus = "ok" | "info" | "warn" | "fail";

interface Pipeline {
  id: string;
  name: string;
  branch: string;
  commit: string;
  status: PipelineStatus;
  time: string;
  duration: string;
  project: string;
}

type StepStatus = "ok" | "fail" | "running" | "pending";

interface Step {
  name: string;
  status: StepStatus;
  duration: string;
}

/* ──────────────────────── 静态占位数据 ─────────────────────── */

const PIPELINES: Pipeline[] = [
  {
    id: "#2148",
    name: "api · main",
    branch: "main",
    commit: "a4f9c2",
    status: "ok",
    time: "2m ago",
    duration: "8m 32s",
    project: "api-service",
  },
  {
    id: "#2147",
    name: "web · feat/auth-v2",
    branch: "feat/auth-v2",
    commit: "0bcf81",
    status: "info",
    time: "now",
    duration: "running",
    project: "web-app",
  },
  {
    id: "#2146",
    name: "worker · main",
    branch: "main",
    commit: "92ad11",
    status: "ok",
    time: "21m ago",
    duration: "4m 12s",
    project: "worker",
  },
  {
    id: "#2145",
    name: "infra · release/1.4",
    branch: "release/1.4",
    commit: "ee2207",
    status: "warn",
    time: "1h ago",
    duration: "12m 04s",
    project: "infrastructure",
  },
  {
    id: "#2144",
    name: "data · etl/daily",
    branch: "etl/daily",
    commit: "8a31fc",
    status: "fail",
    time: "1h ago",
    duration: "2m 18s",
    project: "data-pipeline",
  },
  {
    id: "#2143",
    name: "ml · train-llm-7b",
    branch: "train-llm-7b",
    commit: "12bec0",
    status: "ok",
    time: "3h ago",
    duration: "42m 51s",
    project: "ml-platform",
  },
  {
    id: "#2142",
    name: "api · hotfix/cors",
    branch: "hotfix/cors",
    commit: "fcae90",
    status: "ok",
    time: "5h ago",
    duration: "3m 09s",
    project: "api-service",
  },
  {
    id: "#2141",
    name: "web · main",
    branch: "main",
    commit: "abc123",
    status: "ok",
    time: "6h ago",
    duration: "7m 44s",
    project: "web-app",
  },
];

/** 根据流水线状态生成各阶段步骤列表 */
function getSteps(p: Pipeline): Step[] {
  const isRunning = p.status === "info";
  const isFailed = p.status === "fail";

  return [
    { name: "Checkout", status: "ok", duration: "2s" },
    { name: "Install dependencies", status: "ok", duration: "32s" },
    { name: "Lint & typecheck", status: "ok", duration: "18s" },
    { name: "Unit tests", status: "ok", duration: "1m 04s" },
    {
      name: "Build container",
      status: isRunning ? "running" : "ok",
      duration: isRunning ? "0:42" : "1m 11s",
    },
    {
      name: "Push image",
      status: isRunning ? "pending" : isFailed ? "fail" : "ok",
      duration: isRunning ? "—" : "23s",
    },
    {
      name: "Deploy",
      status: isRunning || isFailed ? "pending" : "ok",
      duration: isRunning || isFailed ? "—" : "1m 18s",
    },
  ];
}

/* ─────────────────────── 步骤图标 ──────────────────────────── */

function StepIcon({ status }: { status: StepStatus }) {
  const color =
    status === "ok"
      ? "var(--accent-success)"
      : status === "fail"
        ? "var(--accent-danger)"
        : status === "running"
          ? "var(--brand-signal)"
          : "var(--fg-subtle)";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border"
      style={{
        width: 18,
        height: 18,
        borderColor: "var(--border)",
        color,
      }}
    >
      {status === "ok" && <Check className="size-2.5" strokeWidth={2.5} />}
      {status === "fail" && <X className="size-2.5" strokeWidth={2.5} />}
      {status === "running" && (
        <Loader className="size-2.5 animate-spin" strokeWidth={2.5} />
      )}
    </span>
  );
}

/* ─────────────────────── 筛选类型 ──────────────────────────── */

type FilterKey = "all" | "running" | "failed" | "queued";

/* ─────────────────────── 主页面 ────────────────────────────── */

const Build: FC = () => {
  const [selectedId, setSelectedId] = useState<string>("#2147");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const selected = PIPELINES.find((p) => p.id === selectedId) ?? PIPELINES[0];
  const steps = getSteps(selected);

  /** 将 PipelineStatus 映射到 StatusDot 的 DotTone */
  const toDotTone = (s: PipelineStatus): DotTone => {
    if (s === "ok") return "ok";
    if (s === "info") return "info";
    if (s === "warn") return "warn";
    return "fail";
  };

  /** 将 PipelineStatus 映射到 StatusBadge 的 BadgeTone */
  const toBadgeTone = (s: PipelineStatus): BadgeTone => {
    if (s === "ok") return "ok";
    if (s === "info") return "running";
    if (s === "warn") return "warn";
    return "fail";
  };

  const filters: Array<{
    key: FilterKey;
    label: string;
    count: number;
    dotTone?: DotTone;
  }> = [
    { key: "all", label: "All", count: 248 },
    { key: "running", label: "Running", count: 12, dotTone: "info" },
    { key: "failed", label: "Failed", count: 52, dotTone: "fail" },
    { key: "queued", label: "Queued", count: 3, dotTone: "warn" },
  ];

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      {/* ── 页头 ── */}
      <PageHeader
        eyebrow="build / pipelines"
        title="Build"
        sub="Active and recent pipeline executions across all projects."
        action={
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="size-3.5" />
            New pipeline
          </Button>
        }
      />

      {/* ── 筛选栏 ── */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            count={f.count}
            dotTone={f.dotTone}
            active={activeFilter === f.key}
            onClick={() => setActiveFilter(f.key)}
          />
        ))}
      </div>

      {/* ── 两栏布局 ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ── 左栏：流水线列表 ── */}
        <Panel>
          <PanelHeader
            title="Recent runs"
            sub={`${PIPELINES.length} shown · last 24h`}
          />
          <div className="border-t">
            {PIPELINES.map((p) => {
              const isActive = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="w-full text-left text-[13px] transition-colors"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto 1fr auto auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: isActive
                      ? "var(--bg-elevated)"
                      : "transparent",
                    boxShadow: isActive
                      ? "inset 2px 0 0 0 var(--brand-signal)"
                      : "none",
                    color: "var(--fg)",
                    cursor: "pointer",
                  }}
                >
                  <StatusDot
                    tone={toDotTone(p.status)}
                    pulse={p.status === "info"}
                  />
                  <span
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: 11.5,
                      color: "var(--fg-muted)",
                      width: 44,
                    }}
                  >
                    {p.id}
                  </span>
                  <span
                    className="truncate font-medium"
                    style={{ overflow: "hidden" }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 11, color: "var(--fg-subtle)" }}
                  >
                    {p.commit}
                  </span>
                  <span
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: 11,
                      color: "var(--fg-subtle)",
                      width: 64,
                      textAlign: "right",
                    }}
                  >
                    {p.time}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* ── 右栏：详情面板 ── */}
        <Panel>
          {/* 1. 头部 */}
          <div style={{ padding: 20 }}>
            <div className="flex items-center justify-between">
              <SectionEyebrow>
                pipeline · {selected.project}
              </SectionEyebrow>
              <StatusBadge tone={toBadgeTone(selected.status)} />
            </div>
            <h3
              className="display"
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "10px 0 0",
                color: "var(--fg)",
              }}
            >
              {selected.name}
            </h3>
            <div
              className="font-mono"
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                fontSize: 11.5,
                color: "var(--fg-subtle)",
              }}
            >
              <span className="flex items-center gap-1">
                <GitBranch
                  className="inline-block"
                  style={{ width: 11, height: 11, verticalAlign: "-1px" }}
                />
                {selected.branch}
              </span>
              <span>{selected.id}</span>
              <span>{selected.commit}</span>
              <span>{selected.duration}</span>
            </div>
          </div>

          {/* 2. 步骤列表 */}
          <div style={{ borderTop: "1px solid var(--border)", padding: 20 }}>
            <SectionEyebrow className="mb-2.5">steps</SectionEyebrow>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {steps.map((step) => (
                <li
                  key={step.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 6,
                    border:
                      step.status === "running"
                        ? "1px solid var(--brand-signal-dim)"
                        : "1px solid var(--border)",
                    background:
                      step.status === "running"
                        ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)"
                        : "transparent",
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                >
                  <StepIcon status={step.status} />
                  <span
                    style={{
                      flex: 1,
                      color:
                        step.status === "pending"
                          ? "var(--fg-subtle)"
                          : "var(--fg)",
                    }}
                  >
                    {step.name}
                  </span>
                  <span
                    className="font-mono tabular-nums"
                    style={{ fontSize: 11, color: "var(--fg-subtle)" }}
                  >
                    {step.duration}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* 3. 底部操作 */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: 16,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Button size="sm" variant="outline" className="gap-1.5">
              <RefreshCw className="size-3" />
              Re-run
            </Button>
            <Button size="sm" variant="ghost">
              View logs
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" className="gap-1.5">
              Open in project
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </Panel>
      </div>
    </section>
  );
};

export default Build;
