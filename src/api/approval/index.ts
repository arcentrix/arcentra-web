import type { RetryApprovalReview } from "./retry-types";
import { get, post } from "../client";

export interface ApprovalRequest {
  approvalId: string;
  pipelineRunId: string;
  jobName: string;
  stepName: string;
  plugin: string;
  status: 0 | 1 | 2 | 3 | 4;
  mode: string;
  requiredApproverCount: number;
  approvedCount: number;
  rejectedCount: number;
  requestedBy: string;
  approvedBy?: string;
  reason?: string;
  candidateApprovers: string;
  expiresAt: string | null;
  deploymentReleaseId?: string;
  retryJobRunId?: string;
  bindingKind?: string;
  retryReview?: RetryApprovalReview;
  evidenceHash?: string;
  version?: number;
  canApprove?: boolean;
  canReject?: boolean;
  decisionBlockReason?: string;
  viewerDecision?: "approved" | "rejected";
}

export const approvalStatus = (status: ApprovalRequest["status"]) =>
  ["Waiting for approval", "Approved", "Rejected", "Expired", "Cancelled"][
    status
  ];

/** Frozen, operator-selected candidates are display-only. They are never submitted. */
export function approvalCandidates(approval: ApprovalRequest): string[] {
  try {
    const value: unknown = JSON.parse(approval.candidateApprovers);
    return Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 100 &&
      value.every(
        (id) =>
          typeof id === "string" &&
          id.length > 0 &&
          id.length <= 64 &&
          id.trim() === id &&
          id !== approval.requestedBy,
      ) &&
      new Set(value).size === value.length
      ? value
      : [];
  } catch {
    return [];
  }
}

function validateApproval(
  value: ApprovalRequest,
  runId: string,
  approvalId?: string,
) {
  if (
    !value ||
    !value.approvalId ||
    value.pipelineRunId !== runId ||
    (approvalId && value.approvalId !== approvalId) ||
    ![0, 1, 2, 3, 4].includes(value.status)
  )
    throw new Error(
      "Approval response does not match the requested run and approval.",
    );
  return value;
}

/** The server resolves the run's project and enforces its scoped read permission. */
export async function listRunApprovals(runId: string, signal?: AbortSignal) {
  const result = await get<ApprovalRequest[] | null>("/approvals/", {
    params: { pipeline_run_id: runId },
    signal,
    silence: true,
  });
  if (result !== null && !Array.isArray(result))
    throw new Error("Approval list response is invalid.");
  return (result ?? []).map((value) => validateApproval(value, runId));
}

export async function getApproval(
  runId: string,
  approvalId: string,
  signal?: AbortSignal,
) {
  return validateApproval(
    await get<ApprovalRequest>(`/approvals/${encodeURIComponent(approvalId)}`, {
      signal,
      silence: true,
    }),
    runId,
    approvalId,
  );
}

/** Actor identity and authorization come exclusively from the authenticated session. */
export async function decideApproval(
  runId: string,
  approvalId: string,
  decision: "approve" | "reject",
  reason: string,
) {
  if (new TextEncoder().encode(reason).length > 2048)
    throw new Error("Decision reason must be 2,048 UTF-8 bytes or fewer.");
  return validateApproval(
    await post<ApprovalRequest>(
      `/approvals/${encodeURIComponent(approvalId)}/${decision}`,
      { reason },
      { silence: true },
    ),
    runId,
    approvalId,
  );
}
