/**
 * Engineering-Blueprint 共享基元。
 *
 * 这些是设计交付包 `prototypes/_shared/primitives.jsx` +
 * `prototypes/dashboard/_pages.jsx` 在生产代码里的落地版本，
 * 供所有重做页面统一复用，避免每页重复实现 StatusDot / Panel 等。
 *
 * 约定：
 * - 卡片/面板圆角 8px（`rounded-md`），靠 1px 边框承重，默认无阴影。
 * - 等宽（Geist Mono）用于：ID/哈希/分支名/时长/指标值/eyebrow/列头。
 * - `--brand-signal` 仅用于：running 状态、激活指示、字标斜杠、▸ 箭头。
 */

import type { CSSProperties, ReactNode } from "react";
import { Check, Pause, Play, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────── StatusDot ─────────────────────────
   6×6 状态圆点。`running` 取品牌信号色，其余取语义强调色。 */
export type DotTone = "ok" | "info" | "warn" | "fail" | "running" | "muted";

const DOT_COLOR: Record<DotTone, string> = {
  ok: "var(--accent-success)",
  info: "var(--accent-info)",
  warn: "var(--accent-warn)",
  fail: "var(--accent-danger)",
  running: "var(--brand-signal)",
  muted: "var(--fg-subtle)",
};

export function StatusDot({
  tone = "ok",
  pulse,
  size = 6,
  className,
}: {
  tone?: DotTone;
  pulse?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full", pulse && "pulse-dot", className)}
      style={{ width: size, height: size, background: DOT_COLOR[tone] }}
    />
  );
}

/* ──────────────────────── StatusBadge ────────────────────────
   带图标的状态药丸。bg/border 用 color-mix 维持明暗主题一致比例。 */
export type BadgeTone = "ok" | "fail" | "running" | "warn" | "info" | "muted";

const BADGE_DEF: Record<BadgeTone, { fg: string; label: string; icon?: LucideIcon }> = {
  ok: { fg: "var(--accent-success)", label: "Passed", icon: Check },
  fail: { fg: "var(--accent-danger)", label: "Failed", icon: X },
  running: { fg: "var(--brand-signal)", label: "Running", icon: Play },
  warn: { fg: "var(--accent-warn)", label: "Queued", icon: Pause },
  info: { fg: "var(--accent-info)", label: "Info" },
  muted: { fg: "var(--fg-subtle)", label: "—" },
};

export function StatusBadge({
  tone,
  children,
  icon,
  className,
}: {
  tone: BadgeTone;
  /** 覆盖默认文案。 */
  children?: ReactNode;
  /** 覆盖默认图标；传 null 隐藏图标。 */
  icon?: LucideIcon | null;
  className?: string;
}) {
  const def = BADGE_DEF[tone];
  const Icon = icon === null ? null : (icon ?? def.icon);
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold",
        className,
      )}
      style={{
        color: def.fg,
        background: `color-mix(in oklab, ${def.fg} 12%, var(--background))`,
        border: `1px solid color-mix(in oklab, ${def.fg} 32%, transparent)`,
      }}
    >
      {Icon && <Icon className="size-3" strokeWidth={2} />}
      {children ?? def.label}
    </span>
  );
}

/* ─────────────────────────── Panel ───────────────────────────
   通用卡片容器：8px 圆角，1px 边框，无阴影。 */
export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border bg-background", className)}
      style={style}
    >
      {children}
    </div>
  );
}

/* ──────────────────────── PanelHeader ────────────────────────
   面板顶部条：标题 + 可选等宽副标题 + 右侧操作。 */
export function PanelHeader({
  title,
  sub,
  action,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold leading-tight tracking-[-0.01em]">
          {title}
        </h2>
        {sub && (
          <div className="mt-0.5 truncate font-mono text-[12px] text-fg-muted">
            {sub}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ──────────────────────────  MetaRow ─────────────────────────
   标签 / 值行。用于 Deploy 环境卡、Account、ProjectDetail 等。
   标签为等宽大写小字，值右对齐（默认等宽）。 */
export function MetaRow({
  label,
  value,
  mono = true,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-[13px] text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────── SectionEyebrow ──────────────────────
   面板内 / 区块内的小标，带 ▸ 前缀。页面级标题请用 <PageHeader>。 */
export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("eyebrow eyebrow-arrow", className)}>{children}</div>;
}

/* ───────────────────────── FilterPill ────────────────────────
   筛选栏药丸按钮：激活态用 border-strong + bg-elevated 内描边。 */
export function FilterPill({
  active,
  label,
  count,
  dotTone,
  onClick,
  className,
}: {
  active?: boolean;
  label: ReactNode;
  count?: number | string;
  dotTone?: DotTone;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-[12.5px] font-medium transition-colors",
        active
          ? "border-border-strong bg-bg-elevated text-foreground"
          : "border-border text-fg-muted hover:text-foreground",
        className,
      )}
    >
      {dotTone && <StatusDot tone={dotTone} />}
      {label}
      {count != null && (
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            active ? "text-fg-muted" : "text-fg-subtle",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ───────────────────────── ColumnHead ────────────────────────
   表格列头文字样式：等宽 10.5px 大写、0.06em 字距。
   用法：<TableHead><ColumnHead>Pipeline</ColumnHead></TableHead> 或
   直接给 TableHead 加 className="font-mono text-[10.5px] ..." */
export function ColumnHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ──────────────────────── SettingsCard ───────────────────────
   设置页区块卡：Panel + 标题头（16px display 标题 + 副标题）+ 主体。
   对应交付包 prototypes/dashboard/Settings.jsx 的 SettingsCard。 */
export function SettingsCard({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-[18px]">
        <div className="min-w-0">
          <h3 className="display text-[16px] font-semibold leading-tight tracking-[-0.01em]">
            {title}
          </h3>
          {sub && <p className="mt-1 text-[12.5px] text-fg-muted">{sub}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </Panel>
  );
}

/* ───────────────────────────  FormRow ────────────────────────
   设置页标签/控件成对行：左 200px 标签 + 提示，右控件，行间细分隔线。
   对应交付包 Settings.jsx 的 FormRow。 */
export function FormRow({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-6 border-b py-3.5 last:border-b-0 [grid-template-columns:200px_1fr]",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-fg-subtle">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
