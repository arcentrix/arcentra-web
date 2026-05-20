import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** 大写等宽小标，自动加 `▸` 前缀。如 `system / overview`。 */
  eyebrow?: string;
  /** 页面主标题，使用 `.display`（Geist Sans 600）。 */
  title: string;
  /** 可选副标题。 */
  sub?: string;
  /** 右侧操作区（按钮、状态片等）。 */
  action?: ReactNode;
  className?: string;
}

/**
 * 全站统一的页面标题模式：`▸ EYEBROW` + `.display` 标题 + 副标题 + 右侧操作。
 * 替换旧的 `<h2 className="text-3xl font-bold">`。
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow eyebrow-arrow">{eyebrow}</div>}
        <h2 className="display mt-2 text-[30px]">{title}</h2>
        {sub && (
          <p className="mt-1.5 max-w-[600px] text-[13px] text-fg-muted">{sub}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
