import { useEffect, useRef, useState } from "react";
import { approvalStatus, decideApproval } from "@/api/approval";
import { isActiveRun } from "@/api/pipeline";
import { useApiResource } from "@/hooks/use-api-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApprovalScope } from "./approval-review";
import {
  loadRetryApprovalReview,
  retryApprovalReviewKey,
} from "./retry-approval-review";
import { errorMessage } from "./run-status";

export function RetryApprovalDialog({
  scope,
  approvalId,
  onClose,
  onChanged,
}: {
  scope: ApprovalScope;
  approvalId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [consent, setConsent] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false),
    mounted = useMountedRef(),
    preflight = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      preflight.current?.abort();
    };
  }, []);
  const resource = useApiResource(
    `retry-approval:${scope.projectId}:${scope.pipelineId}:${scope.runId}:${approvalId}`,
    (signal) => loadRetryApprovalReview(scope, approvalId, signal),
    5000,
  );
  const review = resource.error ? undefined : resource.data;
  const approval = review?.approval,
    evidence = review?.evidence;
  const key = review ? retryApprovalReviewKey(review) : "";
  const available =
    !!review &&
    !resource.loading &&
    !resource.error &&
    approval?.status === 0 &&
    evidence!.expiresAtUnixMilli > now &&
    isActiveRun(review.run.status);
  const confirmed = !!key && consent === key;
  const refresh = () => {
    setConsent("");
    resource.refresh();
  };
  const decide = async (decision: "approve" | "reject") => {
    if (
      pending.current ||
      !available ||
      !confirmed ||
      !review ||
      (decision === "approve" ? approval?.canApprove : approval?.canReject) !==
        true
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    preflight.current = controller;
    try {
      const fresh = await loadRetryApprovalReview(
        scope,
        approvalId,
        controller.signal,
      );
      if (!mounted.current || controller.signal.aborted) return;
      if (
        retryApprovalReviewKey(fresh) !== key ||
        fresh.approval.status !== 0 ||
        fresh.evidence.expiresAtUnixMilli <= Date.now() ||
        !isActiveRun(fresh.run.status) ||
        (decision === "approve"
          ? fresh.approval.canApprove
          : fresh.approval.canReject) !== true
      )
        throw new Error(
          "The plan or your eligibility changed. Review the refreshed evidence again.",
        );
      const result = await decideApproval(
        scope.runId,
        approvalId,
        decision,
        reason,
      );
      if (
        result.approvalId !== fresh.approval.approvalId ||
        result.pipelineRunId !== scope.runId ||
        result.plugin !== "builtin:retry-approval" ||
        result.bindingKind !== fresh.evidence.kind ||
        result.retryJobRunId !== fresh.approval.retryJobRunId ||
        result.deploymentReleaseId ||
        result.evidenceHash !== fresh.approval.evidenceHash
      )
        throw new Error(
          "The decision response did not match the reviewed retry plan.",
        );
      if (!mounted.current) return;
      setNotice(
        result.status === 0
          ? "Your decision was recorded; the required quorum has not been reached."
          : `Decision recorded. Approval status: ${approvalStatus(result.status)}.`,
      );
      onChanged();
    } catch (cause) {
      if (mounted.current)
        setError(
          `${errorMessage(cause)} The record is being re-read; no automatic decision retry will be sent.`,
        );
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setConsent("");
        resource.refresh();
      }
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review exact container retry plan</DialogTitle>
          <DialogDescription>
            Approve only this pinned source, immutable inputs and finite retry
            plan. Identities and quorum are operator-controlled.
          </DialogDescription>
        </DialogHeader>
        {resource.loading && (
          <p role="status">Verifying retry evidence and current eligibility…</p>
        )}
        {resource.error && (
          <p role="alert">Approval unavailable: {resource.error.message}</p>
        )}
        {review && approval && evidence && (
          <div className="space-y-3 text-sm">
            <p>
              Approval status: {approvalStatus(approval.status)}
              {evidence.expiresAtUnixMilli <= now
                ? " (expired; historical approval grants no new execution)"
                : ""}
            </p>
            <p className="text-xs">
              This is the recorded decision, not current execution
              authorization. The history view does not certify that permissions
              remain valid.
            </p>
            <p>
              {approval.approvedCount} of {approval.requiredApproverCount}{" "}
              approvals · {approval.rejectedCount} rejections
            </p>
            <dl className="space-y-2 rounded border p-3 text-xs [&_dd]:break-all [&_dd]:font-mono [&_dt]:text-muted-foreground">
              <div>
                <dt>Approval kind / plan version / mode</dt>
                <dd>
                  {evidence.kind} / {evidence.retryPlan.version} /{" "}
                  {evidence.retryPlan.policy.mode}
                </dd>
              </div>
              <div>
                <dt>Approval / evidence digest</dt>
                <dd>
                  {approval.approvalId} / {approval.evidenceHash}
                </dd>
              </div>
              <div>
                <dt>Project / pipeline / run / job</dt>
                <dd>
                  {scope.projectId} / {scope.pipelineId} / {scope.runId} /{" "}
                  {evidence.identity.jobRunId}
                </dd>
              </div>
              <div>
                <dt>Authenticated requester / operator approvers</dt>
                <dd>
                  {evidence.context.actorId} /{" "}
                  {evidence.context.policy.candidates.join(", ")}
                </dd>
              </div>
              <div>
                <dt>Definition revision / resolved definition digest</dt>
                <dd>
                  {evidence.context.definitionCommitSha} /{" "}
                  {evidence.context.resolvedDefinitionDigest}
                </dd>
              </div>
              <div>
                <dt>Definition path</dt>
                <dd>{evidence.context.definitionPath}</dd>
              </div>
              <div>
                <dt>Pinned full source commit</dt>
                <dd>
                  {evidence.source
                    ? evidence.inputs.sourceCommit
                    : "No source checkout in this job"}
                </dd>
              </div>
              {evidence.source && (
                <div>
                  <dt>Source repository / requested ref</dt>
                  <dd>
                    {evidence.source.Repository} /{" "}
                    {evidence.source.Ref || "default ref"}
                  </dd>
                </div>
              )}
              <div>
                <dt>
                  {evidence.kind === "retry_failed_step_v1"
                    ? "Per-logical-step attempt limit"
                    : "Whole-job total attempt limit"}
                </dt>
                <dd>
                  {evidence.retryPlan.policy.max_attempts} total attempts,
                  including the first
                  {evidence.kind === "retry_failed_step_v1"
                    ? " for each logical step"
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Allowed shell exit codes / delay / idempotency</dt>
                <dd>
                  {evidence.retryPlan.policy.allowed_exit_codes.join(", ")} /{" "}
                  {evidence.retryPlan.policy.delay || "0s"} / explicitly
                  declared
                </dd>
              </div>
              <div>
                <dt>Complete retry plan / input manifest digests</dt>
                <dd>
                  {evidence.retryPlanDigest} / {evidence.inputManifestDigest}
                </dd>
              </div>
              <div>
                <dt>Immutable runtime image / CPU / memory</dt>
                <dd>
                  {evidence.runtime.image} / {evidence.runtime.resources.cpu} /{" "}
                  {evidence.runtime.resources.memory}
                </dd>
              </div>
              <div>
                <dt>Agent / original execution claim</dt>
                <dd>
                  {evidence.identity.agentId} / {evidence.identity.claimId}
                </dd>
              </div>
              <div>
                <dt>Original approval expiry</dt>
                <dd>{approval.expiresAt}</dd>
              </div>
            </dl>
            <h4 className="font-medium">
              All approved steps and preallocated attempts
            </h4>
            {evidence.retryPlan.steps.map((step) => (
              <div
                key={step.attemptRunIds[0]}
                className="space-y-1 rounded border p-2 text-xs break-words"
              >
                <p>
                  {step.stepIndex}: {step.name} · {step.uses} / {step.action}
                </p>
                <p>
                  Continue on command failure: {String(step.continueOnError)}
                </p>
                <p className="break-all">
                  Definition digest: {step.definitionDigest}
                </p>
                <p className="break-all">
                  Attempt IDs: {step.attemptRunIds.join(", ")}
                </p>
              </div>
            ))}
            <h4 className="font-medium">
              All immutable artifact inputs ({evidence.artifacts.length})
            </h4>
            {evidence.artifacts.length === 0 && (
              <p>No upstream artifact inputs.</p>
            )}
            {evidence.artifacts.map((artifact) => (
              <div
                key={artifact.name}
                className="space-y-1 rounded border p-2 text-xs break-all"
              >
                <p>{artifact.name}</p>
                <p>
                  Producer job / step: {artifact.producerJobRunId} /{" "}
                  {artifact.producerStepRunId}
                </p>
                <p>
                  SHA256 / bytes: {artifact.reference.sha256} /{" "}
                  {artifact.reference.size}
                </p>
                <p>
                  Storage / fingerprint / key: {artifact.reference.storageId} /{" "}
                  {artifact.reference.fingerprint} / {artifact.storageKey}
                </p>
                <p>
                  Expiry:{" "}
                  {artifact.reference.expiresAt
                    ? new Date(
                        artifact.reference.expiresAt * 1000,
                      ).toISOString()
                    : "No expiry recorded"}
                </p>
              </div>
            ))}
            {evidence.kind === "retry_failed_step_v1" && (
              <p className="text-xs" role="note">
                Only the failed step repeats in one continuously live session,
                container and workspace. Earlier successful steps run once.
                Partial files from failed commands remain; no rollback or clean
                checkout. Shell-local process state is not preserved. Live or
                zombie background descendants refuse retry and cause cleanup.
                Approval grants no restart continuation. Each logical step and
                retry needs current authorization; historical receipts grant
                none.
              </p>
            )}
            <p className="text-xs">
              The source commit records the initial checkout, not a supply-chain
              attestation. Step digests bind the frozen executable definitions;
              secret environment values and command arguments are not displayed.
            </p>
            <p className="text-xs">
              Approval may release the live Agent's existing wait. It never
              resumes a restarted, cancelled or expired execution. Each new
              admission rechecks current permissions and this exact plan.
              Changing inputs or increasing the limit requires a fresh run and
              review. Refresh only reads.
            </p>
            <p>Original pipeline status: {review.run.status}</p>
            {approval.viewerDecision && (
              <p>Your recorded decision: {approval.viewerDecision}</p>
            )}
            {approval.decisionBlockReason && (
              <p role="status">
                Decisions unavailable: {approval.decisionBlockReason}
              </p>
            )}
            {approval.reason && (
              <p className="break-words">Recorded reason: {approval.reason}</p>
            )}
            {available &&
            (approval.canApprove === true || approval.canReject === true) ? (
              <>
                <label className="block space-y-1">
                  <span>Decision reason (optional)</span>
                  <Textarea
                    value={reason}
                    disabled={busy}
                    maxLength={2048}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy || resource.loading}
                    onChange={(event) =>
                      setConsent(event.target.checked ? key : "")
                    }
                  />
                  <span>
                    I reviewed the exact source commit, all inputs, steps and
                    total attempt limit
                  </span>
                </label>
              </>
            ) : (
              <p className="text-xs">
                Decisions require a live run, pending unexpired approval and
                current server-confirmed eligibility.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy || resource.loading}
            onClick={refresh}
          >
            Refresh approval evidence
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Close review
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              busy || !available || !confirmed || approval?.canReject !== true
            }
            onClick={() => void decide("reject")}
          >
            Reject retry plan
          </Button>
          <Button
            type="button"
            disabled={
              busy || !available || !confirmed || approval?.canApprove !== true
            }
            onClick={() => void decide("approve")}
          >
            Approve retry plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
