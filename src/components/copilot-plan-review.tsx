import { useEffect, useRef, useState } from "react";
import { contentAvailableBefore } from "@/api/copilot/history";
import type { CopilotConversation, CopilotTurn } from "@/api/copilot/history";
import {
  cancelCopilotPlan,
  createCopilotPlan,
  getCopilotPlan,
  listCopilotPlans,
  reviewCopilotPlan,
  validateReviewOnlyPlan,
} from "@/api/copilot/plans";
import type {
  CopilotPlan,
  CopilotPlanKind,
  CopilotPlanRequest,
} from "@/api/copilot/plans";
import { Button } from "./ui/button";
import { historyDate } from "./copilot-history";
const inputStyle =
  "w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm";
const kinds: Record<CopilotPlanKind, string> = {
  new_run_review: "New run review",
  code_patch: "Code patch suggestion",
  retry_approval_review: "Existing retry approval review",
  deployment_review: "Deployment review",
};

export function CopilotPlanReview({
  conversation,
  turns,
  onFailure,
  disabled,
}: {
  conversation: CopilotConversation;
  turns: CopilotTurn[];
  onFailure: () => void;
  disabled: boolean;
}) {
  const [plans, setPlans] = useState<CopilotPlan[]>([]);
  const [nextAfter, setNextAfter] = useState(0);
  const [turnId, setTurnId] = useState("");
  const [kind, setKind] = useState<CopilotPlanKind>("new_run_review");
  const [sourceIndex, setSourceIndex] = useState("");
  const [patch, setPatch] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState<string[]>([]);
  const epoch = useRef(0);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      epoch.current++;
      active.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const expiry = Math.min(
      ...plans
        .filter((plan) => plan.payload)
        .map(contentAvailableBefore)
        .filter(Number.isFinite),
    );
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(
      () => {
        const now = Date.now();
        setConsent([]);
        setPlans((old) =>
          old.map((plan) =>
            contentAvailableBefore(plan) <= now
              ? {
                  ...plan,
                  state:
                    Date.parse(plan.expiresAt) <= now ? "expired" : plan.state,
                  eligible: false,
                  payload: undefined,
                }
              : plan,
          ),
        );
      },
      Math.min(Math.max(0, expiry - Date.now() + 1), 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [plans]);
  const selectedTurn = turns.find(
    (turn) =>
      turn.turnId === turnId &&
      turn.contentAvailable &&
      turn.state === "completed" &&
      contentAvailableBefore(turn) > Date.now(),
  );
  const evidence =
    selectedTurn?.evidence?.filter(
      (item) =>
        item.kind === "code-artifact" ||
        (item.kind === "source-file" && item.jobRunId && item.path),
    ) ?? [];

  async function perform(
    action: (
      signal: AbortSignal,
    ) => Promise<CopilotPlan | { plans: CopilotPlan[]; nextAfter?: number }>,
    append = false,
  ) {
    if (active.current) return;
    const generation = ++epoch.current;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setConsent([]);
    try {
      const result = await action(controller.signal);
      if (generation !== epoch.current) return;
      if ("plans" in result) {
        const valid = result.plans.map(validateReviewOnlyPlan);
        setPlans((old) => (append ? [...old, ...valid] : valid));
        setNextAfter(result.nextAfter || 0);
      } else {
        const valid = validateReviewOnlyPlan(result);
        setPlans((old) => [
          valid,
          ...old.filter((plan) => plan.planId !== valid.planId),
        ]);
      }
    } catch {
      if (generation === epoch.current) {
        setPlans([]);
        setConsent([]);
        setPatch("");
        setError(
          "Plan unavailable. Private content was cleared; no action was executed.",
        );
        onFailure();
      }
    } finally {
      if (generation === epoch.current) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  function propose() {
    if (!selectedTurn || disabled || busy) return;
    let input: CopilotPlanRequest;
    const common = {
      requestId: crypto.randomUUID(),
      turnId: selectedTurn.turnId,
    };
    if (kind === "code_patch") {
      if (new TextEncoder().encode(patch).length > 16384) {
        setError(
          "Patch exceeds 16 KiB. Reduce the suggestion; it will not be truncated.",
        );
        return;
      }
      const source = evidence[Number(sourceIndex)];
      if (sourceIndex === "" || !source || !patch.trim()) return;
      input = {
        ...common,
        kind,
        codePatch:
          source.kind === "code-artifact"
            ? { artifactId: source.id, patch }
            : {
                sourceFile: { jobRunId: source.jobRunId!, path: source.path! },
                patch,
              },
      };
    } else if (kind === "retry_approval_review") {
      if (!approvalId.trim()) return;
      input = {
        ...common,
        kind,
        retryApproval: { approvalId: approvalId.trim() },
      };
    } else if (kind === "deployment_review") {
      if (!environmentId.trim() || !artifactId.trim()) return;
      input = {
        ...common,
        kind,
        deployment: {
          environmentId: environmentId.trim(),
          artifactId: artifactId.trim(),
          ...(releaseId.trim() ? { releaseId: releaseId.trim() } : {}),
        },
      };
    } else input = { ...common, kind: "new_run_review" };
    void perform((signal) =>
      createCopilotPlan(
        conversation.projectId,
        conversation.conversationId,
        input,
        signal,
      ),
    );
  }
  const buildLink = `/projects/${encodeURIComponent(conversation.projectId)}/pipelines/${encodeURIComponent(conversation.pipelineId)}?run=${encodeURIComponent(conversation.runId)}`;
  return (
    <section
      aria-label="Review-only action plans"
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <h3 className="font-medium">Action plans · Not executed</h3>
      <p className="text-xs text-muted-foreground">
        Create a typed proposal from a saved turn. Reviewing or cancelling a
        proposal never applies a patch, triggers a run, approves a retry,
        reserves an environment or deploys. Model text and links are inert.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() =>
          void perform((signal) =>
            listCopilotPlans(
              conversation.projectId,
              conversation.conversationId,
              0,
              signal,
            ),
          )
        }
      >
        Load saved plans
      </Button>
      <fieldset disabled={disabled || busy} className="space-y-3">
        <legend className="text-sm font-medium">
          Create a review-only proposal
        </legend>
        <label className="block space-y-1 text-sm">
          Saved turn for proposal
          <select
            className={inputStyle}
            value={turnId}
            onChange={(event) => {
              setTurnId(event.target.value);
              setSourceIndex("");
              setPatch("");
              setConsent([]);
            }}
          >
            <option value="">Choose a completed turn</option>
            {turns
              .filter(
                (turn) =>
                  turn.contentAvailable &&
                  turn.state === "completed" &&
                  contentAvailableBefore(turn) > Date.now(),
              )
              .map((turn) => (
                <option key={turn.turnId} value={turn.turnId}>
                  Turn {turn.sequence}
                </option>
              ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          Proposal kind
          <select
            className={inputStyle}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as CopilotPlanKind);
              setConsent([]);
            }}
          >
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {kind === "new_run_review" && (
          <p className="text-xs text-muted-foreground">
            Review a new run with the old run as diagnostic context. This is not
            a resumed failed step. Inputs must be selected in the existing run
            form.
          </p>
        )}
        {kind === "code_patch" && (
          <>
            <label className="block space-y-1 text-sm">
              Previously selected patch base
              <select
                className={inputStyle}
                value={sourceIndex}
                onChange={(event) => {
                  setSourceIndex(event.target.value);
                  setConsent([]);
                }}
              >
                <option value="">Choose one retained source</option>
                {evidence.map((item, index) => (
                  <option key={`${item.kind}/${item.id}`} value={index}>
                    {item.name || item.path || item.id} · {item.kind}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              One existing file, at most 8 KiB base and 16 KiB diff. The server
              re-reads and validates the exact base; masked or unavailable bases
              cannot become verified patches.
            </p>
            <label className="block space-y-1 text-sm">
              Proposed unified diff
              <textarea
                aria-label="Proposed unified diff"
                className={`${inputStyle} min-h-32 font-mono`}
                autoComplete="off"
                spellCheck={false}
                value={patch}
                maxLength={16384}
                onChange={(event) => {
                  setPatch(event.target.value);
                  setConsent([]);
                }}
              />
            </label>
          </>
        )}
        {kind === "retry_approval_review" && (
          <label className="block space-y-1 text-sm">
            Existing retry approval ID
            <input
              className={inputStyle}
              value={approvalId}
              maxLength={128}
              onChange={(event) => {
                setApprovalId(event.target.value);
                setConsent([]);
              }}
            />
          </label>
        )}
        {kind === "deployment_review" && (
          <>
            <label className="block space-y-1 text-sm">
              Existing environment ID
              <input
                className={inputStyle}
                value={environmentId}
                maxLength={128}
                onChange={(event) => {
                  setEnvironmentId(event.target.value);
                  setConsent([]);
                }}
              />
            </label>
            <label className="block space-y-1 text-sm">
              Registered release artifact ID
              <input
                className={inputStyle}
                value={artifactId}
                maxLength={128}
                onChange={(event) => {
                  setArtifactId(event.target.value);
                  setConsent([]);
                }}
              />
            </label>
            <label className="block space-y-1 text-sm">
              Existing release ID (optional)
              <input
                className={inputStyle}
                value={releaseId}
                maxLength={128}
                onChange={(event) => {
                  setReleaseId(event.target.value);
                  setConsent([]);
                }}
              />
            </label>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedTurn}
          onClick={propose}
        >
          Create review-only proposal
        </Button>
      </fieldset>
      {plans.map((plan) => {
        const expired = Date.parse(plan.expiresAt) <= Date.now();
        const contentUnavailable = contentAvailableBefore(plan) <= Date.now();
        const editable =
          !contentUnavailable &&
          plan.eligible &&
          ["proposed", "reviewed"].includes(plan.state);
        const payload = !contentUnavailable ? plan.payload : undefined;
        const code = payload?.codePatch;
        const deployment = payload?.deployment;
        return (
          <article
            key={plan.planId}
            aria-label={`Plan ${plan.planId}`}
            className="min-w-0 space-y-2 rounded border p-3"
          >
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <strong>{kinds[plan.kind]}</strong>
              <strong>Not executed</strong>
            </div>
            <p className="break-all text-xs">
              Plan: {plan.planId} · {expired ? "expired" : plan.state} · Version{" "}
              {plan.version}
            </p>
            <p className="text-xs">Expires {historyDate(plan.expiresAt)}</p>
            {plan.contentAvailableUntil && (
              <p className="text-xs">
                Content available until{" "}
                {historyDate(plan.contentAvailableUntil)}, subject to current
                access and target.
              </p>
            )}
            {!payload && (
              <p className="text-sm">
                Plan content is unavailable or expired. Nothing was executed.
              </p>
            )}
            {payload && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {payload.label}
              </p>
            )}
            {code && (
              <>
                <p className="text-sm">
                  {code.snapshotOnly
                    ? "Snapshot patch; repository destination unverified"
                    : "Commit-bound source suggestion; not applied"}
                </p>
                <dl className="space-y-1 break-all text-xs">
                  <div>Path: {code.path}</div>
                  <div>Repository: {code.repository || "Unverified"}</div>
                  <div>Commit: {code.commit || "Unavailable"}</div>
                  <div>Base digest: {code.baseDigest}</div>
                  <div>Patch digest: {code.patchDigest}</div>
                  <div>Result digest: {code.resultDigest}</div>
                </dl>
                <pre
                  aria-label="Escaped proposed diff"
                  className="max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words text-xs"
                >
                  {code.patch}
                </pre>
              </>
            )}
            {payload?.newRun && (
              <dl className="break-all text-xs">
                <div>Diagnostic run: {payload.newRun.diagnosticRunId}</div>
                <div>
                  Last-saved definition revision:{" "}
                  {payload.newRun.definitionRevision ||
                    "Unavailable; select through the existing run flow"}
                </div>
                <div>
                  Definition digest:{" "}
                  {payload.newRun.definitionDigest || "Unavailable"}
                </div>
                <div>
                  Current definition and inputs must be revalidated in the
                  existing pipeline review.
                </div>
              </dl>
            )}
            {payload?.retryApproval && (
              <dl className="break-all text-xs">
                <div>Existing approval: {payload.retryApproval.approvalId}</div>
                <div>Binding: {payload.retryApproval.bindingKind}</div>
                <div>
                  Evidence digest: {payload.retryApproval.evidenceDigest}
                </div>
                <div>
                  Deadline:{" "}
                  {payload.retryApproval.deadline
                    ? historyDate(payload.retryApproval.deadline)
                    : "Unavailable"}
                </div>
              </dl>
            )}
            {deployment && (
              <dl className="space-y-1 break-all text-xs">
                <div>Environment: {deployment.environmentId}</div>
                <div>Target fingerprint: {deployment.targetFingerprint}</div>
                <div>
                  Namespace / workload / container: {deployment.namespace} /{" "}
                  {deployment.workload} / {deployment.container}
                </div>
                <div>Image digest: {deployment.imageDigest}</div>
                <div>Artifact digest: {deployment.artifactDigest}</div>
                <div>
                  {deployment.approvalRequired
                    ? "Existing pipeline approval pathway required"
                    : "Separate deployment confirmation required in the existing flow"}
                </div>
              </dl>
            )}
            {!plan.eligible && (
              <p className="text-xs">
                This proposal is currently ineligible. Refresh to revalidate
                current permissions and target.
              </p>
            )}
            <p className="break-all text-xs text-muted-foreground">
              Plan digest: {plan.planDigest}
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent.includes(plan.planId)}
                disabled={
                  disabled || busy || !editable || plan.state !== "proposed"
                }
                onChange={(event) =>
                  setConsent(
                    event.target.checked
                      ? [...consent, plan.planId]
                      : consent.filter((id) => id !== plan.planId),
                  )
                }
              />
              I understand this records review only; no action is executed.
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  disabled ||
                  busy ||
                  !editable ||
                  plan.state !== "proposed" ||
                  !consent.includes(plan.planId)
                }
                onClick={() =>
                  void perform((signal) =>
                    reviewCopilotPlan(
                      conversation.projectId,
                      conversation.conversationId,
                      plan,
                      signal,
                    ),
                  )
                }
              >
                Record review · Not executed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || busy || !editable}
                onClick={() =>
                  void perform((signal) =>
                    cancelCopilotPlan(
                      conversation.projectId,
                      conversation.conversationId,
                      plan,
                      signal,
                    ),
                  )
                }
              >
                Cancel proposal only
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || busy}
                onClick={() =>
                  void perform((signal) =>
                    getCopilotPlan(
                      conversation.projectId,
                      conversation.conversationId,
                      plan.planId,
                      signal,
                    ),
                  )
                }
              >
                Refresh proposal
              </Button>
            </div>
            {payload && plan.kind !== "code_patch" && (
              <a
                className="block text-sm underline underline-offset-4"
                href={
                  deployment?.releaseId && !deployment.approvalRequired
                    ? `/projects/${encodeURIComponent(conversation.projectId)}/deployments?release=${encodeURIComponent(deployment.releaseId)}`
                    : `${buildLink}${payload.retryApproval ? `#approval-${encodeURIComponent(payload.retryApproval.approvalId)}` : ""}`
                }
              >
                {plan.kind === "new_run_review"
                  ? "Open existing build review"
                  : "Open existing review surface"}
              </a>
            )}
          </article>
        );
      })}
      {nextAfter > 0 && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() =>
            void perform(
              (signal) =>
                listCopilotPlans(
                  conversation.projectId,
                  conversation.conversationId,
                  nextAfter,
                  signal,
                ),
              true,
            )
          }
        >
          More saved plans
        </Button>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Checking review-only proposal…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
