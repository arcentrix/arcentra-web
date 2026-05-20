import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, Check, Copy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InlineErrorDiagnostic {
  label: string;
  value: ReactNode;
  copyValue?: string;
  mono?: boolean;
}

export interface InlineErrorStateProps {
  title?: string;
  description?: string;
  requestId?: string | null;
  /**
   * Extra diagnostic rows shown beneath the request id. Useful for HTTP status
   * codes, backend error codes, request paths, etc.
   */
  diagnostics?: InlineErrorDiagnostic[];
  onRetry?: () => void | Promise<unknown>;
  retrying?: boolean;
  retryLabel?: string;
  className?: string;
  /**
   * Minimum height for the error region. Defaults to 320px so a list/table
   * region still feels balanced when the rows are missing.
   */
  minHeight?: number | string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write may fail in unsecured contexts; ignore silently.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label={copied ? "Copied" : "Copy value"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-foreground" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function DiagnosticRow({ diagnostic }: { diagnostic: InlineErrorDiagnostic }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <dt className="w-28 shrink-0 text-muted-foreground">{diagnostic.label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-foreground",
            diagnostic.mono && "font-mono text-[11px]",
          )}
        >
          {diagnostic.value}
        </span>
        {diagnostic.copyValue ? (
          <CopyButton value={diagnostic.copyValue} />
        ) : null}
      </dd>
    </div>
  );
}

export function InlineErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. You can retry, or open diagnostics for details.",
  requestId,
  diagnostics,
  onRetry,
  retrying = false,
  retryLabel = "Retry",
  className,
  minHeight = 320,
}: InlineErrorStateProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const style: CSSProperties = {
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
  };

  const allDiagnostics: InlineErrorDiagnostic[] = [
    ...(requestId
      ? [
          {
            label: "Request ID",
            value: requestId,
            copyValue: requestId,
            mono: true,
          } satisfies InlineErrorDiagnostic,
        ]
      : []),
    ...(diagnostics ?? []),
  ];

  const hasDiagnostics = allDiagnostics.length > 0;

  return (
    <div
      role="alert"
      style={style}
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 py-10",
        className,
      )}
    >
      <div className="flex w-full max-w-[480px] flex-col items-center text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground"
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button
              type="button"
              onClick={() => onRetry()}
              disabled={retrying}
              className="gap-1.5"
            >
              <RotateCw
                className={cn("h-4 w-4", retrying && "animate-spin")}
                aria-hidden
              />
              {retrying ? "Retrying…" : retryLabel}
            </Button>
          ) : null}
          {hasDiagnostics ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDiagnostics((value) => !value)}
              aria-expanded={showDiagnostics}
              aria-controls="inline-error-diagnostics"
            >
              {showDiagnostics ? "Hide diagnostics" : "View diagnostics"}
            </Button>
          ) : null}
        </div>

        {hasDiagnostics && showDiagnostics ? (
          <dl
            id="inline-error-diagnostics"
            className="mt-5 w-full divide-y divide-border/50 rounded-md border border-border/70 bg-muted/20 px-4 py-2 text-left text-xs text-foreground/80"
          >
            {allDiagnostics.map((diagnostic) => (
              <DiagnosticRow key={diagnostic.label} diagnostic={diagnostic} />
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
