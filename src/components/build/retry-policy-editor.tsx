import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RetryPolicy } from "@/api/pipeline/types";
import { parseDefinition } from "./visual-ci-draft";

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

/** This marker requests a server-owned gate; it never supplies approvers or authority. */
export function isDurableRetryApproval(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    value.required === true &&
    value.type === "manual" &&
    value.plugin === "builtin:retry-approval" &&
    Object.keys(value).every((key) =>
      ["required", "type", "plugin", "params"].includes(key),
    ) &&
    (value.params === undefined ||
      (isObject(value.params) && Object.keys(value.params).length === 0))
  );
}

function hasContinuedStep(job: Job | null | undefined): boolean {
  return (
    Array.isArray(job?.steps) &&
    job.steps.some(
      (step) =>
        isObject(step) &&
        // Reject malformed non-false values too; validation must not silently
        // turn an authored continuation into a retryable command boundary.
        [step.continueOnError, step.continue_on_error].some(
          (value) => value != null && value !== false,
        ),
    )
  );
}

const policyRequirements =
  "Confirm idempotency, choose 2–5 attempts, and enter distinct exit codes from 1 to 125.";

function retryScopeError(
  offlineContainer: boolean,
  job: Job | null | undefined,
  mode: string,
): string {
  if (mode !== "whole_job" && mode !== "failed_step")
    return "Unsupported authored retry policy. Choose a supported scope or Off explicitly; the draft is unchanged until you apply an edit.";
  if (!offlineContainer) return "";
  if (mode === "failed_step") {
    if (hasContinuedStep(job))
      return "Failed-step retry does not support continueOnError on any step. A failed boundary must end or retry the same step. Edit the step explicitly or choose another scope; the authored draft is unchanged.";
  }
  if (job?.approval != null && !isDurableRetryApproval(job.approval))
    return "Container retry with approval requires the exact manual builtin:retry-approval gate, with no approver parameters. Unknown gates cannot authorize the complete retry plan. Choose Off to remove the policy.";
  return "";
}

export function setJobRetry(
  text: string,
  index: number,
  retry?: RetryPolicy,
): string {
  const spec = parseDefinition(text);
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
    if (
      retry.idempotent !== true ||
      !Number.isInteger(retry.maxAttempts) ||
      retry.maxAttempts < 2 ||
      retry.maxAttempts > 5 ||
      !Array.isArray(retry.allowedExitCodes) ||
      !retry.allowedExitCodes.length ||
      retry.allowedExitCodes.some(
        (code) => !Number.isInteger(code) || code < 1 || code > 125,
      ) ||
      new Set(retry.allowedExitCodes).size !== retry.allowedExitCodes.length
    )
      throw new Error(policyRequirements);
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
  let draftError = "";
  try {
    const spec = parseDefinition(value);
    offlineContainer = isOfflineContainer(spec);
    if (isObject(spec) && Array.isArray(spec.jobs))
      jobs = spec.jobs.map((job) => (isObject(job) ? job : null));
  } catch (error) {
    draftError = error instanceof Error ? error.message : "Invalid definition.";
  }
  const locked = disabled || !!draftError;
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<RetryPolicy["mode"] | "off" | "unsupported">(
    "off",
  );
  const [max, setMax] = useState(2);
  const [delay, setDelay] = useState("1s");
  const [codes, setCodes] = useState("");
  const [idempotent, setIdempotent] = useState(false);
  const [error, setError] = useState("");
  const approvalBlocked =
    offlineContainer &&
    jobs[index]?.approval != null &&
    !isDurableRetryApproval(jobs[index]?.approval);
  const failedStepBlocked =
    offlineContainer && (approvalBlocked || hasContinuedStep(jobs[index]));
  const scopeError =
    mode === "off" ? "" : retryScopeError(offlineContainer, jobs[index], mode);
  const current = JSON.stringify(jobs[index]?.retry ?? null);
  useEffect(() => {
    const authored: unknown = JSON.parse(current);
    const policy = isObject(authored) ? authored : null;
    setMode(
      authored === null
        ? "off"
        : policy?.mode === "failed_step" || policy?.mode === "whole_job"
          ? policy.mode
          : "unsupported",
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
    if (locked) return;
    if (scopeError || mode === "unsupported") {
      setError(scopeError);
      return;
    }
    const exitCodes = codes.split(",").map((code) => Number(code.trim()));
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
            Container retries require a separately accepted backend and matching
            Agent capability. For whole-job retry the operator must enable
            allowWholeJobRetry. Failed-step retry requires allowFailedStepRetry
            on both Control and Agent. Each defaults off; editing this draft
            does not enable it. Failed-step retry cannot combine with
            continueOnError.
            {isDurableRetryApproval(jobs[index]?.approval) &&
              " This exact manual gate requires the separate operator allowWholeJobRetryApproval or allowFailedStepRetryApproval for the chosen mode, a trusted approval policy, and verified Agent TLS. The failed-step approval capability and acceptance gate are separate and default off. Approvers review the pinned source commit, immutable inputs and complete retry limit before any container starts. Approval never resumes a restarted or cancelled run."}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            Job
            <select
              aria-label="Retry job"
              disabled={locked || !jobs.length}
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
              disabled={locked}
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as typeof mode);
                setError("");
              }}
              className="mt-1 h-9 w-full rounded-md border bg-background px-2"
            >
              {mode === "unsupported" && (
                <option value="unsupported" disabled>
                  Unsupported authored policy
                </option>
              )}
              <option value="off">Off</option>
              <option value="failed_step" disabled={failedStepBlocked}>
                Failed step only
              </option>
              <option value="whole_job" disabled={approvalBlocked}>
                Whole job steps
              </option>
            </select>
          </label>
        </div>
        {(mode === "whole_job" || mode === "failed_step") && (
          <>
            <p role="note" className="text-amber-700 dark:text-amber-300">
              {offlineContainer
                ? mode === "whole_job"
                  ? "Repeats earlier successful steps and their side effects. Each round uses a fresh session, rootfs, and workspace, with the pinned source SHA and input artifacts. External side effects are not rolled back."
                  : "Repeats only the failed step within one continuously live session, container, rootfs, and workspace. Earlier successful steps are preserved and are not run again. The failed command's partial writes also remain. No rollback or clean checkout. Shell-local variables and process state are not preserved between attempts. Background processes are not guaranteed to survive: any live or zombie descendants, including those from earlier steps, refuse retry and trigger terminal cleanup."
                : mode === "whole_job"
                  ? "Repeats earlier successful steps and their side effects. Reuses the current workspace and source snapshot; no clean checkout or rollback. Checkout, approval, and target deployment are outside the retry loop."
                  : "Repeats only the failed step in its existing workspace. Earlier successful commands are preserved. Missing workspace state stops execution."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                {mode === "failed_step"
                  ? "Per-step attempts including first"
                  : "Attempts including first"}
                <Input
                  aria-label="Maximum attempts"
                  type="number"
                  min={2}
                  max={5}
                  value={max}
                  disabled={locked}
                  onChange={(event) => setMax(Number(event.target.value))}
                />
              </label>
              <label>
                Delay
                <Input
                  aria-label="Retry delay"
                  value={delay}
                  disabled={locked}
                  onChange={(event) => setDelay(event.target.value)}
                />
              </label>
              <label>
                Allowed exit codes
                <Input
                  aria-label="Retry exit codes"
                  placeholder="e.g. 9, 75"
                  value={codes}
                  disabled={locked}
                  onChange={(event) => setCodes(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={idempotent}
                disabled={locked}
                onChange={(event) => setIdempotent(event.target.checked)}
              />
              {offlineContainer && mode === "whole_job"
                ? "I confirm repeated commands are idempotent and external side effects are safe to repeat."
                : offlineContainer
                  ? "I confirm repeated commands are idempotent and safe with preserved successful-step files, partial failed-command writes, and external side effects."
                  : "I confirm repeated commands are idempotent and safe with existing files and external side effects."}
            </label>
          </>
        )}
        {(draftError || scopeError || error) && (
          <p role="alert" className="text-destructive">
            {draftError || scopeError || error}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked || !jobs[index] || !!scopeError}
          onClick={apply}
        >
          Apply retry policy to draft
        </Button>
        <p className="text-muted-foreground">
          Applying changes only the local draft; it does not save or start a
          run. Live attempts only. No automatic resume after restart. Completed
          jobs and interrupted workspaces cannot be resumed safely; start a new
          run when needed. No model chooses or changes this policy.
        </p>
      </div>
    </details>
  );
}
