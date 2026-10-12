import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RetryPolicy } from "@/api/pipeline/types";

type Job = { name?: string; retry?: RetryPolicy };

export function setJobRetry(
  text: string,
  index: number,
  retry?: RetryPolicy,
): string {
  const spec = JSON.parse(text) as { jobs?: Job[] };
  if (
    !Array.isArray(spec.jobs) ||
    !spec.jobs[index] ||
    typeof spec.jobs[index] !== "object" ||
    Array.isArray(spec.jobs[index])
  )
    throw new Error("Select an existing job.");
  if (retry) spec.jobs[index].retry = retry;
  else delete spec.jobs[index].retry;
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
  try {
    const spec = JSON.parse(value) as { jobs?: Job[] };
    jobs = Array.isArray(spec.jobs)
      ? spec.jobs.map((job) =>
          job && typeof job === "object" && !Array.isArray(job) ? job : null,
        )
      : [];
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
              <option value="failed_step">Failed step only</option>
              <option value="whole_job">Whole job steps</option>
            </select>
          </label>
        </div>
        {mode !== "off" && (
          <>
            <p role="note" className="text-amber-700 dark:text-amber-300">
              {mode === "whole_job"
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
              I confirm repeated commands are idempotent and safe with existing
              files and external side effects.
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
          disabled={disabled || !jobs[index]}
          onClick={apply}
        >
          Apply retry policy to draft
        </Button>
        <p className="text-muted-foreground">
          Live attempts only. Completed jobs and interrupted workspaces cannot
          be resumed safely; start a new run when needed. No model chooses or
          changes this policy.
        </p>
      </div>
    </details>
  );
}
