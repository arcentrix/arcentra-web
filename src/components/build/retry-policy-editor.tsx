import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RetryPolicy } from "@/api/pipeline/types";

type Job = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isOfflineContainer(spec: unknown): boolean {
  return (
    isObject(spec) &&
    isObject(spec.runtime) &&
    spec.runtime.type === "containerd-offline-v1"
  );
}

function retryScopeError(
  offlineContainer: boolean,
  job: Job | null | undefined,
  mode: RetryPolicy["mode"],
): string {
  if (!offlineContainer) return "";
  if (job?.approval != null)
    return "Container retry with approval is unsupported until durable approval binds the complete retry plan. Choose Off to remove the policy.";
  if (mode !== "whole_job")
    return "Failed-step retry is unsupported for containerd-offline-v1. Choose Whole job steps or Off.";
  return "";
}

export function setJobRetry(
  text: string,
  index: number,
  retry?: RetryPolicy,
): string {
  const spec: unknown = JSON.parse(text);
  if (
    !isObject(spec) ||
    !Array.isArray(spec.jobs) ||
    !isObject(spec.jobs[index])
  )
    throw new Error("Select an existing job.");
  const job = spec.jobs[index];
  if (retry) {
    const error = retryScopeError(isOfflineContainer(spec), job, retry.mode);
    if (error) throw new Error(error);
    job.retry = retry;
  } else delete job.retry;
  return JSON.stringify(spec, null, 2);
}

export function RetryPolicyEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  let jobs: (Job | null)[] = [];
  let offlineContainer = false;
  try {
    const spec: unknown = JSON.parse(value);
    offlineContainer = isOfflineContainer(spec);
    if (isObject(spec) && Array.isArray(spec.jobs))
      jobs = spec.jobs.map((job) => (isObject(job) ? job : null));
  } catch {
    /* JSON editor reports validation errors. */
  }
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<RetryPolicy["mode"] | "off">("off");
  const [max, setMax] = useState(2);
  const [delay, setDelay] = useState("1s");
  const [codes, setCodes] = useState("");
  const [idempotent, setIdempotent] = useState(false);
  const [error, setError] = useState("");
  const approvalBlocked = offlineContainer && jobs[index]?.approval != null;
  const scopeError =
    mode === "off" ? "" : retryScopeError(offlineContainer, jobs[index], mode);
  const current = JSON.stringify(jobs[index]?.retry ?? null);
  useEffect(() => {
    const policy = JSON.parse(current) as RetryPolicy | null;
    setMode(
      policy?.mode === "failed_step" || policy?.mode === "whole_job"
        ? policy.mode
        : "off",
    );
    setMax(typeof policy?.maxAttempts === "number" ? policy.maxAttempts : 2);
    setDelay(typeof policy?.delay === "string" ? policy.delay : "1s");
    setCodes(
      Array.isArray(policy?.allowedExitCodes)
        ? policy.allowedExitCodes.join(", ")
        : "",
    );
    setIdempotent(policy?.idempotent === true);
    setError("");
  }, [current, index]);
  const apply = () => {
    setError("");
    if (scopeError) {
      setError(scopeError);
      return;
    }
    const exitCodes = codes.split(",").map((code) => Number(code.trim()));
    if (
      mode !== "off" &&
      (!idempotent ||
        !codes.trim() ||
        !Number.isInteger(max) ||
        max < 2 ||
        max > 5 ||
        exitCodes.some(
          (code) => !Number.isInteger(code) || code < 1 || code > 125,
        ) ||
        new Set(exitCodes).size !== exitCodes.length)
    ) {
      setError(
        "Confirm idempotency, choose 2–5 attempts, and enter distinct exit codes from 1 to 125.",
      );
      return;
    }
    try {
      onChange(
        setJobRetry(
          value,
          index,
          mode === "off"
            ? undefined
            : {
                mode,
                maxAttempts: max,
                delay,
                allowedExitCodes: exitCodes,
                idempotent,
              },
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid definition.");
    }
  };
  return (
    <details className="rounded-md border p-3 text-xs">
      <summary className="cursor-pointer font-medium">
        Retry policy · off unless explicitly configured
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">
          Applies to future runs after saving. Only allowlisted shell process
          exits can retry. Cancellation, timeout, configuration, log
          persistence, and unacknowledged failed-step reports stop retries.
        </p>
        {offlineContainer && (
          <p className="text-amber-700 dark:text-amber-300">
            containerd-offline-v1 supports whole-job retry only. The operator
            must enable allowWholeJobRetry, which defaults off; editing this
            draft does not enable it. Failed-step retry is unsupported.
            {approvalBlocked &&
              " Container retry with approval is unsupported until durable approval binds the complete retry plan. Choose Off to remove the policy."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label>
            Job
            <select
              aria-label="Retry job"
              disabled={disabled || !jobs.length}
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-md border bg-background px-2"
            >
              {jobs.map((job, i) => (
                <option key={i} value={i}>
                  {typeof job?.name === "string" ? job.name : `Job ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select
              aria-label="Retry scope"
              disabled={disabled}
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-2"
            >
              <option value="off">Off</option>
              <option value="failed_step" disabled={offlineContainer}>
                Failed step only
              </option>
              <option value="whole_job" disabled={approvalBlocked}>
                Whole job steps
              </option>
            </select>
          </label>
        </div>
        {mode !== "off" && (
          <>
            <p role="note" className="text-amber-700 dark:text-amber-300">
              {offlineContainer
                ? mode === "whole_job"
                  ? "Repeats earlier successful steps and their side effects. Each round uses a fresh session, rootfs, and workspace, with the pinned source SHA and input artifacts. External side effects are not rolled back."
                  : "Failed-step retry is unsupported for containerd-offline-v1. Choose Whole job steps or Off; the authored policy is unchanged until you apply an edit."
                : mode === "whole_job"
                  ? "Repeats earlier successful steps and their side effects. Reuses the current workspace and source snapshot; no clean checkout or rollback. Checkout, approval, and target deployment are outside the retry loop."
                  : "Repeats only the failed step in its existing workspace. Earlier successful commands are preserved. Missing workspace state stops execution."}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <label>
                Attempts including first
                <Input
                  aria-label="Maximum attempts"
                  type="number"
                  min={2}
                  max={5}
                  value={max}
                  disabled={disabled}
                  onChange={(event) => setMax(Number(event.target.value))}
                />
              </label>
              <label>
                Delay
                <Input
                  aria-label="Retry delay"
                  value={delay}
                  disabled={disabled}
                  onChange={(event) => setDelay(event.target.value)}
                />
              </label>
              <label>
                Allowed exit codes
                <Input
                  aria-label="Retry exit codes"
                  placeholder="e.g. 9, 75"
                  value={codes}
                  disabled={disabled}
                  onChange={(event) => setCodes(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={idempotent}
                disabled={disabled}
                onChange={(event) => setIdempotent(event.target.checked)}
              />
              {offlineContainer
                ? "I confirm repeated commands are idempotent and external side effects are safe to repeat."
                : "I confirm repeated commands are idempotent and safe with existing files and external side effects."}
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !jobs[index] || !!scopeError}
          onClick={apply}
        >
          Apply retry policy to draft
        </Button>
        <p className="text-muted-foreground">
          Live attempts only. No automatic resume after restart. Completed jobs
          and interrupted workspaces cannot be resumed safely; start a new run
          when needed. No model chooses or changes this policy.
        </p>
      </div>
    </details>
  );
}
