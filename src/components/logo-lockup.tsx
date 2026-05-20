import { cn } from "@/lib/utils";
import { APP_LOGO_ICON } from "@/constants/assets";

interface LogoLockupProps {
  /** 图标边长（px）。字标字号取 size 的 0.85 倍。 */
  size?: number;
  /** 是否渲染 `arcentra/` 字标。 */
  withText?: boolean;
  className?: string;
}

/**
 * Arcentra 品牌锁定标识。
 *
 * 图标用 CSS mask 渲染（`logo-icon.svg` 内置深色填充，必须 mask 才能随主题着色），
 * 字标为 Geist Mono 小写 `arcentra`，尾部 `/` 取品牌信号色 —— CLI 命名空间前缀的观感。
 * 不使用 `logo.svg`（仓库内为空占位）。
 */
export function LogoLockup({
  size = 20,
  withText = true,
  className,
}: LogoLockupProps) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: 10 }}
    >
      <span
        aria-hidden
        className="inline-block shrink-0 bg-foreground"
        style={{
          width: size,
          height: size,
          maskImage: `url(${APP_LOGO_ICON})`,
          WebkitMaskImage: `url(${APP_LOGO_ICON})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
      {withText && (
        <span
          className="font-mono leading-none text-foreground"
          style={{
            fontSize: Math.round(size * 0.85),
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          arcentra<span className="text-brand-signal">/</span>
        </span>
      )}
    </span>
  );
}
