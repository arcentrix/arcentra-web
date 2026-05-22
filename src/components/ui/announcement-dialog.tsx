import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "Announcement"-style dialog: a centered modal with a leading circular icon,
 * a title + description, the caller-provided body, and a footer slot. It is
 * the canonical dialog shape across the console — for invites, edits, role
 * configuration, password resets, and similar form-driven flows.
 *
 * Anatomy:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  ⊕   Title                            ✕ │
 *   │      Description                        │
 *   │                                         │
 *   │  <children — typically a form>          │
 *   │  <AnnouncementDialogFooter>             │
 *   │     [Cancel] [Primary]                  │
 *   │  </AnnouncementDialogFooter>            │
 *   └─────────────────────────────────────────┘
 */

export type AnnouncementTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "destructive";

const TONE_STYLES: Record<AnnouncementTone, string> = {
  neutral: "border-border bg-muted/60 text-muted-foreground",
  info: "border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400",
  warning:
    "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
  success:
    "border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

const SIZE_STYLES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
} as const;

export type AnnouncementSize = keyof typeof SIZE_STYLES;

export interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lead icon shown in the rounded badge in the dialog header. */
  icon: LucideIcon;
  /** Color tone of the icon badge. Defaults to `neutral`. */
  iconTone?: AnnouncementTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controls the dialog's max width. Defaults to `md`. */
  size?: AnnouncementSize;
  /**
   * Body content. Typically a `<form>` whose last child is an
   * `AnnouncementDialogFooter` containing action buttons.
   */
  children: React.ReactNode;
  className?: string;
}

export function AnnouncementDialog({
  open,
  onOpenChange,
  icon: Icon,
  iconTone = "neutral",
  title,
  description,
  size = "md",
  children,
  className,
}: AnnouncementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          SIZE_STYLES[size],
          "max-h-[90vh] overflow-y-auto",
          className,
        )}
      >
        <div className="flex items-start gap-3 pr-6">
          <div
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
              TONE_STYLES[iconTone],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <DialogTitle className="text-base font-semibold leading-none">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-sm">
                {description}
              </DialogDescription>
            ) : null}
          </div>
        </div>

        {children}
      </DialogContent>
    </Dialog>
  );
}

export interface AnnouncementDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard footer row for `AnnouncementDialog`. Stacks vertically on mobile
 * (primary at the top thanks to `flex-col-reverse`) and aligns to the right
 * on `sm+`. Drop your action buttons in directly.
 */
export function AnnouncementDialogFooter({
  children,
  className,
}: AnnouncementDialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
