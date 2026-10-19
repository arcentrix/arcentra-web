import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  changeCopilotRerun,
  getCopilotRerun,
  getCopilotRerunAvailability,
  getCopilotRerunEligibility,
  prepareCopilotRerun,
  rerunId,
} from "@/api/copilot/rerun";
import type {
  CopilotRerunEligibility,
  CopilotRerunIntent,
  CopilotRerunReview,
  CopilotRerunScope,
} from "@/api/copilot/rerun";
import {
  clearRerunRecovery,
  readRerunRecovery,
  saveRerunRecovery,
} from "./copilot-rerun-recovery";
import type { RerunRecovery } from "./copilot-rerun-recovery";

export const RERUN_ACKNOWLEDGEMENT =
  "Create a new run of the whole job. The original run remains unchanged. Preparation may start after confirmation; a new independent approval is required before user commands.";
const supportedWarning =
  "Currently supported: a verified manual run with a captured immutable snapshot, exactly one failed container job, and gated idempotent whole-job retry. Shell steps followed by output uploads are supported. Legacy or missing snapshots, secret references, source credentials, upstream artifact inputs, multiple jobs and failed-step continuation are unsupported.";
const buttonStyle = "h-auto min-h-9 max-w-full whitespace-normal text-left";
export function rerunExecutionHref(
  project: string,
  pipeline: string,
  run: string,
) {
  const params = new URLSearchParams({ pipeline, run });
  return `/projects/${encodeURIComponent(project)}/pipelines?${params}`;
}
function Review({ value }: { value: CopilotRerunReview }) {
  const fields = [
    ["Project", value.projectId],
    ["Pipeline", value.pipelineId],
    ["Original run", value.originalRunId],
    ["Original job", value.originalJobRunId],
    ["Original terminal status", "Run failed; job failed"],
    ["Job name", value.jobName],
    ["Retry mode", value.retryMode],
    ["Definition repository", value.definition.repository],
    ["Definition path", value.definition.path],
    ["Definition revision", value.definition.revision],
    ["Resolved-spec digest", value.definition.resolvedSpecDigest],
    ["Source repository", value.source.repository],
    ["Source ref (display only)", value.source.ref || "Not specified"],
    ["Expected checkout", value.source.expectedCommit],
    ["Snapshot digest", value.snapshotDigest],
    ["Snapshot expires", value.snapshotExpiresAt],
    ["Approval policy", value.policy.id],
    ["Policy fingerprint", value.policy.fingerprint],
    ["Policy mode", value.policy.mode],
    [
      "Required independent approvals",
      String(value.policy.requiredApproverCount),
    ],
    ["Candidate identities", value.policy.candidates.join(", ")],
    ["Approval timeout", `${value.policy.timeoutSeconds} seconds`],
    ["Maximum attempts", String(value.retryBudget.maxAttempts)],
    ["Retry delay", value.retryBudget.delay || "0s"],
    ["Allowed exit codes", value.retryBudget.allowedExitCodes.join(", ")],
  ];
  return (
    <dl
      aria-label="Whole-job execution review"
      className="min-w-0 space-y-1 text-xs"
    >
      {fields.map(([label, detail]) => (
        <div key={label} className="min-w-0 break-all">
          <dt className="inline font-medium">{label}: </dt>
          <dd className="inline">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
interface Props extends CopilotRerunScope {
  enabled: boolean;
  disabled?: boolean;
  authorizationRevision?: string;
}
export function CopilotRerunActions(props: Props) {
  // Remount synchronously on scope/identity/permission changes: old evidence is
  // never rendered for one frame in a newly selected scope.
  if (
    !props.enabled ||
    ![props.projectId, props.originalRunId, props.ownerId].every(rerunId)
  )
    return null;
  return (
    <ScopedRerunActions
      key={`${props.ownerId}:${props.projectId}:${props.originalRunId}:${props.authorizationRevision ?? ""}`}
      {...props}
    />
  );
}
function ScopedRerunActions({
  projectId,
  originalRunId,
  ownerId,
  disabled = false,
}: Props) {
  const scope = { projectId, originalRunId, ownerId };
  const [available, setAvailable] = useState(false);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [jobId, setJobId] = useState("");
  const [eligibility, setEligibility] = useState<CopilotRerunEligibility>();
  const [intent, setIntent] = useState<CopilotRerunIntent>();
  const [recovery, setRecovery] = useState<RerunRecovery | undefined>(() =>
    readRerunRecovery(scope),
  );
  const [consent, setConsent] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const receivedAt = useRef(performance.now());
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mutation = useRef(false);
  const disclosureId = useId();
  useEffect(() => {
    const controller = new AbortController();
    getCopilotRerunAvailability(projectId, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setAvailable(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [projectId, availabilityRevision]);
  useEffect(() => {
    const generationRef = generation;
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, performance.now() - receivedAt.current)),
      1000,
    );
    const invalidate = () => {
      generationRef.current++;
      active.current?.abort();
      active.current = null;
      setBusy("");
      setEligibility(undefined);
      setIntent(undefined);
      setConsent("");
      if (mutation.current)
        setError(
          "The request outcome is unknown. Inspect the existing rerun request before doing anything else. Leaving this page does not cancel submitted work.",
        );
      mutation.current = false;
      setAvailable(false);
      setAvailabilityRevision((v) => v + 1);
    };
    window.addEventListener("focus", invalidate);
    return () => {
      generationRef.current++;
      active.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", invalidate);
    };
  }, []);
  const serverNow =
    Date.parse(intent?.serverTime ?? eligibility?.serverTime ?? "") + elapsed;
  const expired = !!intent && Date.parse(intent.expiresAt) <= serverNow;
  const eligibilityExpired =
    !!eligibility?.review &&
    Date.parse(eligibility.review.snapshotExpiresAt) <= serverNow;
  const consentKey = intent
    ? `${intent.intentId}:${intent.version}:${intent.intentDigest}:${intent.reviewedRunContextDigest}`
    : "";
  const confirmable =
    !!intent &&
    intent.state === "prepared" &&
    intent.canConfirm &&
    intent.reviewStatus === "current" &&
    !!intent.review &&
    !expired;
  useEffect(() => {
    if (expired) setConsent("");
  }, [expired]);
  async function perform(
    label: string,
    action: (
      signal: AbortSignal,
    ) => Promise<CopilotRerunIntent | CopilotRerunEligibility>,
    writes = false,
  ) {
    if (active.current || !available || disabled) return;
    const epoch = generation.current;
    const controller = new AbortController();
    active.current = controller;
    mutation.current = writes;
    setBusy(label);
    setError("");
    setConsent("");
    setIntent(undefined);
    setEligibility(undefined);
    try {
      const value = await action(controller.signal);
      if (epoch !== generation.current || controller.signal.aborted) return;
      receivedAt.current = performance.now();
      setElapsed(0);
      if ("intentId" in value) {
        const identity = {
          requestId: value.requestId,
          intentId: value.intentId,
        };
        setRecovery(identity);
        // The RequestID was durably saved before Prepare. A later storage failure
        // cannot trigger a fresh request; the saved RequestID still reconciles it.
        saveRerunRecovery(scope, identity);
        setIntent(value);
        setJobId(value.originalJobRunId);
      } else setEligibility(value);
    } catch {
      if (epoch !== generation.current || controller.signal.aborted) return;
      setError(
        writes
          ? "The request outcome is unknown or the reviewed policy, permission, version or deadline changed. Inspect the existing rerun request. Nothing will be prepared or confirmed automatically."
          : "Current access or request state could not be verified. Protected review and consent were cleared. Inspection sends no execution or approval.",
      );
    } finally {
      if (epoch === generation.current) {
        active.current = null;
        mutation.current = false;
        setBusy("");
      }
    }
  }
  function prepare() {
    if (
      active.current ||
      recovery ||
      !eligibility?.eligible ||
      eligibilityExpired ||
      disabled
    )
      return;
    const identity = { requestId: crypto.randomUUID() };
    // Fail closed if reload recovery cannot be stored before the first write.
    if (!saveRerunRecovery(scope, identity)) {
      setError(
        "This browser cannot save the recovery ID. Enable session storage before preparing a new execution. No request was submitted.",
      );
      return;
    }
    setRecovery(identity);
    void perform(
      "Preparing request…",
      (signal) =>
        prepareCopilotRerun(scope, eligibility, identity.requestId, signal),
      true,
    );
  }
  if (!available) return null;
  return (
    <section
      aria-label="Whole-job new executions"
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <h3 className="font-medium">Re-execute whole job as a new run</h3>
      <p id={disclosureId} className="text-sm">
        The original run stays failed and unchanged. Every job step runs again,
        and effects from the original attempt may still exist. This does not
        continue a failed step's workspace.
      </p>
      <p className="text-xs text-muted-foreground">{supportedWarning}</p>
      <p className="text-xs">
        Eligibility is read-only. Preparing reserves a fixed request;
        confirmation creates a new execution and does not submit an approval
        vote.
      </p>
      {!recovery && (
        <div className="min-w-0 space-y-2">
          <label className="block space-y-1 text-sm">
            Original job ID
            <input
              className="block w-full min-w-0 rounded-md border bg-background px-3 py-2"
              value={jobId}
              maxLength={128}
              disabled={!!busy || disabled}
              onChange={(event) => {
                setJobId(event.target.value);
                setEligibility(undefined);
                setConsent("");
                setError("");
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              className={buttonStyle}
              variant="outline"
              disabled={!!busy || disabled || !rerunId(jobId)}
              onClick={() =>
                void perform("Checking eligibility…", (signal) =>
                  getCopilotRerunEligibility(scope, jobId, signal),
                )
              }
            >
              Check rerun eligibility
            </Button>
            {eligibility?.eligible && (
              <Button
                className={buttonStyle}
                disabled={!!busy || disabled || eligibilityExpired}
                aria-describedby={disclosureId}
                onClick={prepare}
              >
                Prepare new execution
              </Button>
            )}
          </div>
        </div>
      )}
      {busy && (
        <p role="status" className="text-sm">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {eligibility && (
        <div className="space-y-2">
          <p role="status" className="text-sm">
            {eligibility.eligible
              ? eligibilityExpired
                ? "The snapshot review expired. Check eligibility again."
                : "Eligible for a separate whole-job new execution."
              : eligibility.reasonCode === "unsupported"
                ? "This original execution is unsupported by the current whole-job new-execution path."
                : "A current protected review is unavailable."}
          </p>
          {eligibility.review && !eligibilityExpired && (
            <Review value={eligibility.review} />
          )}
        </div>
      )}
      {recovery && (
        <div className="min-w-0 space-y-2">
          <p className="break-all text-xs">
            Recovery request ID: {recovery.requestId}
            {recovery.intentId ? ` · Intent ID: ${recovery.intentId}` : ""}
          </p>
          {!intent && !busy && (
            <p role="status" className="text-sm">
              Inspect the existing request to recover its current state. No new
              request or confirmation is sent by inspection.
            </p>
          )}
          <Button
            className={buttonStyle}
            variant="outline"
            disabled={!!busy || disabled}
            onClick={() =>
              void perform("Inspecting request…", (signal) =>
                getCopilotRerun(scope, recovery, signal),
              )
            }
          >
            Inspect rerun request
          </Button>
        </div>
      )}
      {intent && (
        <article
          aria-label={`Whole-job re-execution ${intent.intentId}`}
          className="min-w-0 space-y-3 rounded border p-3"
        >
          <p role="status" className="text-sm">
            {intent.state === "confirmed"
              ? "New execution created"
              : intent.state === "cancelled"
                ? "Prepared request cancelled. No new execution was created."
                : intent.state === "expired" || expired
                  ? "Prepared request expired"
                  : "Prepared request. No new execution has been created."}
          </p>
          <p className="break-all text-xs">
            Intent {intent.intentId} · Version {intent.version} · State{" "}
            {intent.state}
          </p>
          <p className="break-all text-xs">
            Original run {intent.originalRunId} · Original job{" "}
            {intent.originalJobRunId}
          </p>
          <p className="break-all text-xs">
            {intent.state === "confirmed" ? "New" : "Reserved new"} run{" "}
            {intent.newRunId} · New job {intent.newJobRunId}
          </p>
          <p className="break-all text-xs">
            Intent digest: {intent.intentDigest}
          </p>
          <p className="break-all text-xs">
            Reviewed run-context digest: {intent.reviewedRunContextDigest}
          </p>
          <p className="break-all text-xs">
            Snapshot digest: {intent.snapshotDigest}
          </p>
          <p className="break-all text-xs">
            Prepared {intent.createdAt} · Expires {intent.expiresAt}
          </p>
          {intent.confirmedAt && (
            <p className="text-xs">
              Created new execution at {intent.confirmedAt}
            </p>
          )}
          {intent.cancelledAt && (
            <p className="text-xs">
              Cancelled prepared request at {intent.cancelledAt}
            </p>
          )}
          {intent.review &&
            intent.reviewStatus === "current" &&
            (intent.state !== "prepared" || !expired) && (
              <Review value={intent.review} />
            )}
          {intent.reviewStatus !== "current" && (
            <p className="text-sm">
              Current protected review: {intent.reviewStatus}. Fresh
              confirmation is disabled. Inspect again; if a new review is
              required, cancel or let this prepared request expire before
              deliberately preparing another.
            </p>
          )}
          {confirmable && (
            <label className="flex min-w-0 items-start gap-2 text-sm">
              <input
                className="mt-1 shrink-0"
                type="checkbox"
                checked={consent === consentKey}
                disabled={!!busy || disabled}
                aria-describedby={disclosureId}
                onChange={(event) =>
                  setConsent(event.target.checked ? consentKey : "")
                }
              />
              <span>{RERUN_ACKNOWLEDGEMENT}</span>
            </label>
          )}
          {intent.state === "prepared" && (
            <div className="flex flex-wrap gap-2">
              <Button
                className={buttonStyle}
                disabled={
                  !!busy || disabled || !confirmable || consent !== consentKey
                }
                aria-describedby={disclosureId}
                onClick={() => {
                  if (confirmable && consent === consentKey)
                    void perform(
                      "Confirming request…",
                      (signal) =>
                        changeCopilotRerun(scope, intent, "confirm", signal),
                      true,
                    );
                }}
              >
                Confirm new execution
              </Button>
              <Button
                className={buttonStyle}
                variant="outline"
                disabled={
                  !!busy || disabled || !intent.canCancelPrepared || expired
                }
                onClick={() =>
                  void perform(
                    "Cancelling prepared request…",
                    (signal) =>
                      changeCopilotRerun(
                        scope,
                        intent,
                        "cancel-prepared",
                        signal,
                      ),
                    true,
                  )
                }
              >
                Cancel prepared request
              </Button>
            </div>
          )}
          {intent.state === "confirmed" && (
            <>
              <p className="text-sm">
                Independent approval and runtime outcome have not been observed
                here. Open the new execution to inspect its current approvals,
                jobs, steps and logs. The requester cannot provide the required
                independent approval.
              </p>
              <p className="text-sm">
                Cancel new execution is unavailable in this interface. Closing
                the page does not cancel work, withdraw an approval or roll back
                external effects.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              className="min-h-9 break-words py-2 underline"
              href={rerunExecutionHref(
                projectId,
                intent.pipelineId,
                intent.originalRunId,
              )}
            >
              View original execution
            </a>
            {intent.state === "confirmed" && (
              <a
                className="min-h-9 break-words py-2 underline"
                href={rerunExecutionHref(
                  projectId,
                  intent.pipelineId,
                  intent.newRunId,
                )}
              >
                View new execution and independent approval
              </a>
            )}
          </div>
          {intent.state !== "prepared" && (
            <Button
              className={buttonStyle}
              variant="outline"
              disabled={!!busy || disabled}
              onClick={() => {
                clearRerunRecovery(scope);
                setRecovery(undefined);
                setIntent(undefined);
                setEligibility(undefined);
                setConsent("");
                setError("");
              }}
            >
              Review another execution
            </Button>
          )}
        </article>
      )}
    </section>
  );
}
