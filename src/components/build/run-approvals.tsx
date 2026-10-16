import { RetryApprovalDialog } from "./retry-approval-dialog";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  approvalCandidates,
  approvalStatus,
  decideApproval,
  listRunApprovals,
} from "@/api/approval";
import { isActiveRun } from "@/api/pipeline";
import { useApiResource } from "@/hooks/use-api-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { Panel, PanelHeader } from "@/components/blueprint";
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
import { errorMessage } from "./run-status";
import {
  approvalReviewKey,
  loadApprovalReview,
  verifyApprovalScope,
} from "./approval-review";
import type { ApprovalScope } from "./approval-review";

export function RunApprovals(props: ApprovalScope) {
  return (
    <ScopedRunApprovals
      key={`${props.projectId}:${props.pipelineId}:${props.runId}`}
      scope={props}
    />
  );
}
function ScopedRunApprovals({ scope }: { scope: ApprovalScope }) {
  const [settled, setSettled] = useState(false);
  const [selected, setSelected] = useState("");
  const [selectedRetry, setSelectedRetry] = useState(false);
  const resource = useApiResource(
    `approvals:${scope.projectId}:${scope.pipelineId}:${scope.runId}`,
    async (signal) => {
      const [run, approvals] = await Promise.all([
        verifyApprovalScope(scope, signal),
        listRunApprovals(scope.runId, signal),
      ]);
      if (!signal.aborted)
        setSettled(
          !isActiveRun(run.status) &&
            !approvals.some((item) => item.status === 0),
        );
      return approvals;
    },
    settled ? 0 : 5000,
  );
  const approvals = resource.error ? undefined : resource.data;
  return (
    <Panel>
      <PanelHeader
        title="Run approvals"
        sub="Persisted approval records scoped to this pipeline run"
      />
      <div className="space-y-3 border-t p-4 text-sm">
        <p className="text-xs text-muted-foreground">
          Only operator-defined approvers can decide. Requesters cannot approve
          their own execution. Current permissions are checked by the server for
          every decision and execution admission.
        </p>
        {resource.error && (
          <p role="alert">Approvals unavailable: {resource.error.message}</p>
        )}
        {!approvals && resource.loading && (
          <p role="status">Loading run approvals…</p>
        )}
        {approvals?.length === 0 && (
          <p>
            No persisted approval requests for this run. A legacy or unsupported
            DSL gate is not evidence of approval.
          </p>
        )}
        {approvals?.map((approval) => (
          <article
            key={approval.approvalId}
            className="space-y-2 rounded border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">
                {approval.jobName || "Unnamed job"}
                {approval.stepName ? ` / ${approval.stepName}` : ""}
              </h4>
              <span className="text-xs">{approvalStatus(approval.status)}</span>
            </div>
            <p className="break-all font-mono text-xs">
              Approval: {approval.approvalId}
            </p>
            <p className="text-xs">
              {approval.approvedCount} of {approval.requiredApproverCount}{" "}
              approvals · {approval.rejectedCount} rejections
            </p>
            {approval.decisionBlockReason && (
              <p className="text-xs">{approval.decisionBlockReason}</p>
            )}
            {!(
              (approval.plugin === "builtin:deployment" &&
                approval.deploymentReleaseId &&
                !approval.retryJobRunId) ||
              (approval.plugin === "builtin:retry-approval" &&
                (approval.bindingKind === "retry_whole_job_v1" ||
                  approval.bindingKind === "retry_failed_step_v1") &&
                approval.retryJobRunId &&
                !approval.deploymentReleaseId)
            ) ? (
              <p role="alert" className="text-xs">
                Unsupported gate: {approval.plugin || "unspecified"}. This
                record cannot authorize execution here.
              </p>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resource.loading}
                onClick={() => {
                  setSelectedRetry(
                    approval.plugin === "builtin:retry-approval",
                  );
                  setSelected(approval.approvalId);
                }}
              >
                Review approval {approval.approvalId}
              </Button>
            )}
          </article>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={resource.loading}
          onClick={resource.refresh}
        >
          Refresh approvals
        </Button>
      </div>
      {selected && selectedRetry ? (
        <RetryApprovalDialog
          key={`${scope.projectId}:${scope.pipelineId}:${scope.runId}:${selected}`}
          scope={scope}
          approvalId={selected}
          onClose={() => setSelected("")}
          onChanged={resource.refresh}
        />
      ) : (
        selected && (
          <ApprovalDetail
            key={`${scope.projectId}:${scope.pipelineId}:${scope.runId}:${selected}`}
            scope={scope}
            approvalId={selected}
            onClose={() => setSelected("")}
            onChanged={resource.refresh}
          />
        )
      )}
    </Panel>
  );
}

function ApprovalDetail({
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
  const pending = useRef(false);
  const mounted = useMountedRef();
  const preflight = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      preflight.current?.abort();
    };
  }, []);
  const resource = useApiResource(
    `approval-review:${scope.projectId}:${scope.pipelineId}:${scope.runId}:${approvalId}`,
    (signal) => loadApprovalReview(scope, approvalId, signal),
    5000,
  );
  const review = resource.error ? undefined : resource.data;
  const key = review ? approvalReviewKey(review) : "";
  const approval = review?.approval;
  const release = review?.release;
  const expired = !approval?.expiresAt || Date.parse(approval.expiresAt) <= now;
  const available =
    !!review &&
    !resource.loading &&
    !resource.error &&
    approval?.status === 0 &&
    !expired &&
    release?.status === "queued";
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
      // Read the exact record again before writing. New votes, scope changes,
      // expiration, target changes and revocations invalidate prior consent.
      const fresh = await loadApprovalReview(
        scope,
        approvalId,
        controller.signal,
      );
      if (!mounted.current || controller.signal.aborted) return;
      if (
        approvalReviewKey(fresh) !== key ||
        fresh.approval.status !== 0 ||
        Date.parse(fresh.approval.expiresAt!) <= Date.now() ||
        fresh.release.status !== "queued" ||
        (decision === "approve"
          ? fresh.approval.canApprove
          : fresh.approval.canReject) !== true
      )
        throw new Error(
          "The approval or your eligibility changed. Review the refreshed evidence before deciding again.",
        );
      const result = await decideApproval(
        scope.runId,
        approvalId,
        decision,
        reason,
      );
      if (
        result.deploymentReleaseId !== fresh.release.releaseId ||
        result.evidenceHash !== fresh.approval.evidenceHash
      )
        throw new Error(
          "The decision response did not match the reviewed release. Refresh to verify the recorded decision.",
        );
      if (!mounted.current) return;
      setNotice(
        result.status === 0
          ? "Your decision was recorded. The required approval quorum has not been reached."
          : `Decision recorded. Approval status: ${approvalStatus(result.status)}.`,
      );
      onChanged();
    } catch (cause) {
      if (mounted.current)
        setError(
          `${errorMessage(cause)} The current record is being re-read; no automatic decision retry will be sent.`,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review final deployment approval</DialogTitle>
          <DialogDescription>
            Review this immutable release before recording your authenticated
            decision. Approver identities and quorum come from operator
            configuration.
          </DialogDescription>
        </DialogHeader>
        {resource.loading && (
          <p role="status">
            Verifying approval evidence and current eligibility…
          </p>
        )}
        {resource.error && (
          <p role="alert">Approval unavailable: {resource.error.message}</p>
        )}
        {review && approval && release && (
          <div className="space-y-3 text-sm">
            <p>
              Approval status: {approvalStatus(approval.status)}
              {expired
                ? " (expiry reached; historical decisions cannot authorize a new apply)"
                : ""}
            </p>
            <p>
              {approval.approvedCount} of {approval.requiredApproverCount}{" "}
              approvals · {approval.rejectedCount} rejections
            </p>
            <dl className="space-y-2 rounded border p-3 text-xs [&_dd]:break-all [&_dd]:font-mono [&_dt]:text-muted-foreground">
              <div>
                <dt>Approval / evidence hash</dt>
                <dd>
                  {approval.approvalId} / {approval.evidenceHash}
                </dd>
              </div>
              <div>
                <dt>Project / pipeline / run</dt>
                <dd>
                  {scope.projectId} / {scope.pipelineId} / {scope.runId}
                </dd>
              </div>
              <div>
                <dt>Same release ID / state</dt>
                <dd>
                  {release.releaseId} / {release.status}
                </dd>
              </div>
              <div>
                <dt>Immutable operator target / environment</dt>
                <dd>
                  {release.approvalTarget!.targetRef} / {release.environmentId}
                </dd>
              </div>
              <div>
                <dt>Namespace / Deployment / container</dt>
                <dd>
                  {release.approvalTarget!.namespace} /{" "}
                  {release.approvalTarget!.deployment} /{" "}
                  {release.approvalTarget!.container}
                </dd>
              </div>
              <div>
                <dt>Immutable image</dt>
                <dd>{release.image}</dd>
              </div>
              <div>
                <dt>Artifact ID / SHA256</dt>
                <dd>
                  {release.artifactId} / {release.artifactSha256}
                </dd>
              </div>
              <div>
                <dt>Artifact producer job / step</dt>
                <dd>
                  {release.producerJobRunId} / {release.producerStepRunId}
                </dd>
              </div>
              <div>
                <dt>Deployment execution job / step</dt>
                <dd>
                  {release.executionJobRunId} / {release.executionStepRunId}
                </dd>
              </div>
              <div>
                <dt>Definition revision / deployment plan hash</dt>
                <dd>
                  {release.commitSha} / {release.deploymentPlanHash}
                </dd>
              </div>
              <div>
                <dt>Operator-defined approvers</dt>
                <dd>{approvalCandidates(approval).join(", ")}</dd>
              </div>
              <div>
                <dt>Requested by</dt>
                <dd>{approval.requestedBy}</dd>
              </div>
              <div>
                <dt>Approval expiry</dt>
                <dd>{approval.expiresAt}</dd>
              </div>
            </dl>
            {approval.status === 1 && (
              <p className="text-xs">
                Approved is a historical decision, not a promise to deploy.
                Expiry, revoked approver permissions, changed operator policy,
                or a stopped controller can block application. The server
                revalidates the gate immediately before applying.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The definition revision identifies the reviewed pipeline, not a
              verified source-code commit. The exact artifact and image digest
              above identify this release.
            </p>
            <p>Original pipeline status: {review.run.status}</p>
            <p className="text-xs">
              Approval may release an existing wait while the original
              controller is live. After restart, cancellation, or timeout,
              approval never restarts the pipeline or implicitly applies a
              queued release. Read-only refresh does not deploy anything.
            </p>
            <p className="text-xs">
              An unresolved apply requires separate inspection and explicit
              same-release recovery. Recovery may apply the original image even
              if the pipeline was cancelled; it never starts a replacement
              release or guarantees rollback.
            </p>
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
            {release.reason && (
              <p className="break-words">Release reason: {release.reason}</p>
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
                    I reviewed this exact release, target, image, artifact, and
                    definition revision
                  </span>
                </label>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                A decision requires a pending, unexpired approval and current
                server-confirmed eligibility. Revoked permissions, expired,
                rejected or cancelled gates cannot authorize a deployment.
              </p>
            )}
            <Link
              className="inline-block text-xs underline underline-offset-2"
              to={`/projects/${encodeURIComponent(scope.projectId)}/deployments?release=${encodeURIComponent(release.releaseId)}`}
            >
              Inspect this release in Deployments
            </Link>
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
            Reject release
          </Button>
          <Button
            type="button"
            disabled={
              busy || !available || !confirmed || approval?.canApprove !== true
            }
            onClick={() => void decide("approve")}
          >
            {busy ? "Recording decision…" : "Approve release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
