import { useEffect, useRef, useState } from "react";
import { contentAvailableBefore } from "@/api/copilot/history";
import { Button } from "./ui/button";
import { historyDate } from "./copilot-history";
import {
  changeCopilotExecution,
  getCopilotExecution,
  listCopilotExecutions,
  prepareCopilotExecution,
} from "@/api/copilot/execution";
import type { CopilotExecutionIntent } from "@/api/copilot/execution";
import type { CopilotPlan } from "@/api/copilot/plans";
export interface RetryActionCandidate {
  conversationId: string;
  plan: CopilotPlan;
}

export function CopilotExecutionActions({
  projectId,
  enabled,
  candidate,
  disabled = false,
  onFailure,
}: {
  projectId: string;
  enabled: boolean;
  candidate?: RetryActionCandidate;
  disabled?: boolean;
  onFailure?: () => void;
}) {
  const [intents, setIntents] = useState<CopilotExecutionIntent[]>([]);
  const [nextAfter, setNextAfter] = useState(0);
  const [consent, setConsent] = useState("");
  const [detach, setDetach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unknownId, setUnknownId] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(Date.now());
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pendingMutation = useRef<{ id: string } | null>(null);
  useEffect(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    pendingMutation.current = null;
    setIntents([]);
    setConsent("");
    setDetach(false);
    setBusy(false);
    setUnknownId("");
    setUncertain(false);
    setError("");
    setNextAfter(0);
    return () => {
      generation.current++;
      active.current?.abort();
      active.current = null;
      pendingMutation.current = null;
    };
  }, [projectId, enabled]);
  useEffect(() => {
    setDetach(false);
    setConsent("");
  }, [candidate]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const focus = () => {
      // Aborting transport does not undo a submitted mutation. Fence every
      // pre-focus response and retain only the ID needed for durable inspection.
      const mutation = pendingMutation.current;
      generation.current++;
      active.current?.abort();
      active.current = null;
      pendingMutation.current = null;
      setBusy(false);
      setNextAfter(0);
      if (mutation) {
        setUnknownId(mutation.id);
        setError(
          "Action outcome is unconfirmed. It may have been recorded. Inspect the durable record or reload the list; no automatic submission or cancellation retry.",
        );
      }
      setConsent("");
      setDetach(false);
      setIntents([]);
      setUncertain(true);
    };
    window.addEventListener("focus", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [enabled]);
  async function perform(
    action: (
      signal: AbortSignal,
    ) => Promise<
      | CopilotExecutionIntent
      | { intents: CopilotExecutionIntent[]; nextAfter?: number }
    >,
    mutation = false,
    id = "",
    append = false,
  ) {
    if (active.current || !enabled || disabled) return;
    const epoch = generation.current;
    const controller = new AbortController();
    active.current = controller;
    pendingMutation.current = mutation ? { id } : null;
    setBusy(true);
    setConsent("");
    setDetach(false);
    setError("");
    // Every operation removes actionable stale evidence, even while a read is pending.
    const previous = append ? intents : [];
    setIntents([]);
    try {
      const value = await action(controller.signal);
      if (epoch !== generation.current || controller.signal.aborted) return;
      if ("intents" in value) {
        setIntents([...previous, ...value.intents]);
        setNextAfter(value.nextAfter ?? 0);
      } else {
        setIntents([value]);
        setNextAfter(0);
      }
      setUnknownId("");
      setUncertain(false);
    } catch {
      if (epoch !== generation.current || controller.signal.aborted) return;
      setIntents([]);
      onFailure?.();
      setNextAfter(0);
      setUncertain(true);
      setUnknownId(id);
      setError(
        mutation
          ? "Action outcome is unconfirmed. It may have been recorded. Inspect the durable record or reload the list; no automatic submission or cancellation retry. Permission or version changes also require a fresh review."
          : "Current access or action state could not be verified. Private evidence was cleared. Reload to inspect; no approval was sent by this read.",
      );
    } finally {
      if (epoch === generation.current) {
        active.current = null;
        pendingMutation.current = null;
        setBusy(false);
      }
    }
  }
  if (!enabled) return null;
  const canPrepare =
    candidate?.plan.kind === "retry_approval_review" &&
    candidate.plan.state === "reviewed" &&
    candidate.plan.eligible &&
    contentAvailableBefore(candidate.plan) > now;
  return (
    <section
      aria-label="Independent bound retry actions"
      className="space-y-3 rounded-md border p-3"
    >
      <h3 className="font-medium">Bound retry approval actions</h3>
      <p className="text-sm">
        These separate actions approve an existing waiting job and its complete
        bounded retry budget. History review and model text never grant
        execution consent. This is not manual terminal-failure resume.
      </p>
      <p className="text-sm">
        Prepared actions are detached copies. They remain until their deadline
        even if the source conversation is deleted. Cancel a prepared action
        separately.
      </p>
      <Button
        disabled={busy || disabled}
        variant="outline"
        onClick={() =>
          void perform((signal) => listCopilotExecutions(projectId, 0, signal))
        }
      >
        Load bound retry actions
      </Button>
      {canPrepare && (
        <fieldset
          disabled={busy || disabled || uncertain}
          className="space-y-2"
        >
          <legend>
            Prepare separate action for plan {candidate.plan.planId}
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={detach}
              onChange={(e) => setDetach(e.target.checked)}
            />
            Preparing does not approve; the detached action remains until its
            deadline even if the source conversation is deleted. I must cancel
            it separately.
          </label>
          <Button
            disabled={!detach}
            variant="outline"
            onClick={() =>
              void perform(
                (signal) =>
                  prepareCopilotExecution(
                    projectId,
                    candidate.conversationId,
                    candidate.plan,
                    crypto.randomUUID(),
                    signal,
                  ),
                true,
              )
            }
          >
            Prepare bound retry action · Does not approve
          </Button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {unknownId && (
        <Button
          disabled={busy || disabled}
          variant="outline"
          onClick={() =>
            void perform((signal) =>
              getCopilotExecution(projectId, unknownId, signal),
            )
          }
        >
          Inspect unconfirmed action
        </Button>
      )}
      {intents.map((intent) => {
        const key = `${intent.intentId}:${intent.version}:${intent.intentDigest}`;
        const prepared =
          intent.state === "prepared" && Date.parse(intent.expiresAt) > now;
        const evidence =
          Date.parse(intent.expiresAt) > now
            ? intent.retryReview?.evidence
            : undefined;
        return (
          <article
            key={intent.intentId}
            aria-label={`Bound retry action ${intent.intentId}`}
            className="space-y-2 rounded border p-3"
          >
            <p className="break-all text-sm">
              Action {intent.intentId} ·{" "}
              {intent.state === "prepared" && !prepared
                ? "expired or unavailable"
                : intent.state}{" "}
              · Version {intent.version}
            </p>
            <p className="break-all text-xs">
              Run {intent.runId} · Job {intent.jobRunId} · Approval{" "}
              {intent.approvalId}
            </p>
            <p className="text-xs">Deadline {historyDate(intent.expiresAt)}</p>
            <p className="break-all text-xs">
              Frozen plan {intent.sourcePlanId} · Version{" "}
              {intent.sourcePlanVersion} · Digest {intent.sourcePlanDigest}
            </p>
            <p className="break-all text-xs">
              Action digest {intent.intentDigest}
            </p>
            <p className="text-sm">
              Approval status: {intent.approvalStatus ?? "Not observed"}. Votes:{" "}
              {intent.approvedCount ?? "Unknown"} /{" "}
              {intent.requiredApproverCount ?? "Unknown"}.
            </p>
            <p className="text-sm">
              Runtime admission:{" "}
              {intent.runtimeAdmissionObserved === true
                ? "Observed"
                : "Not observed"}
              . Job status: {intent.jobStatus ?? "Unknown"}. Generation:{" "}
              {intent.currentGeneration ?? "Unknown"}. A recorded vote or
              approval does not prove admission, a command ran, or a retry
              occurred.
            </p>
            {evidence && (
              <>
                <p className="text-sm">
                  Complete bounded budget:{" "}
                  {evidence.retryPlan.policy.max_attempts} attempts ·{" "}
                  {evidence.retryPlan.policy.mode} · Allowed exit codes{" "}
                  {evidence.retryPlan.policy.allowed_exit_codes.join(", ")}
                </p>
                <details>
                  <summary>Full frozen retry evidence</summary>
                  <pre
                    aria-label="Frozen retry evidence"
                    className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs"
                  >
                    {JSON.stringify(evidence, null, 2)}
                  </pre>
                </details>
              </>
            )}
            {prepared && !evidence && (
              <p className="text-sm">
                Frozen retry evidence is unavailable. Approval is disabled;
                inspect again or cancel the prepared action.
              </p>
            )}
            {prepared && (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consent === key}
                    disabled={busy || disabled || uncertain || !evidence}
                    onChange={(e) => setConsent(e.target.checked ? key : "")}
                  />
                  I approve this exact frozen execution and complete bounded
                  retry budget. My permanent vote may start the waiting job and
                  cannot be withdrawn after submission.
                </label>
                <Button
                  disabled={
                    busy ||
                    disabled ||
                    uncertain ||
                    !evidence ||
                    consent !== key
                  }
                  onClick={() =>
                    void perform(
                      (signal) =>
                        changeCopilotExecution(
                          projectId,
                          intent,
                          "confirm",
                          signal,
                        ),
                      true,
                      intent.intentId,
                    )
                  }
                >
                  Submit permanent approval · May start job and retries
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || disabled || uncertain}
                  onClick={() =>
                    void perform(
                      (signal) =>
                        changeCopilotExecution(
                          projectId,
                          intent,
                          "cancel",
                          signal,
                        ),
                      true,
                      intent.intentId,
                    )
                  }
                >
                  Cancel prepared action only
                </Button>
              </>
            )}
            {intent.state === "submitted" && (
              <p className="text-sm">
                Permanent approval submitted
                {intent.decisionId ? ` · Decision ${intent.decisionId}` : ""}.
                This vote cannot be withdrawn.
              </p>
            )}
            <p className="text-xs">
              Cancelling a prepared action does not cancel a job or undo a vote.
              Job cancellation is a separate existing action requiring current
              permission; it grants no new permission and promises no rollback.
            </p>
            <Button
              variant="outline"
              disabled={busy || disabled}
              onClick={() =>
                void perform((signal) =>
                  getCopilotExecution(projectId, intent.intentId, signal),
                )
              }
            >
              Inspect current action
            </Button>
          </article>
        );
      })}
      {nextAfter > 0 && (
        <Button
          variant="outline"
          disabled={busy || disabled}
          onClick={() =>
            void perform(
              (signal) => listCopilotExecutions(projectId, nextAfter, signal),
              false,
              "",
              true,
            )
          }
        >
          More bound retry actions
        </Button>
      )}
      {busy && <p role="status">Checking bound retry action…</p>}
    </section>
  );
}
