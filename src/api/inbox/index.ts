import { get, post } from "../client";

export type InboxFilter = "all" | "unread";
export type InboxKind = "run_result" | "approval_requested" | "approval_result";
export type InboxStatus =
  | "success"
  | "failed"
  | "cancelled"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";
export interface InboxItem {
  id: string;
  kind: InboxKind;
  status: InboxStatus;
  occurredAt: string;
  deliveredAt: string;
  readAt: string | null;
  target: {
    type: "run" | "approval";
    runId: string;
    approvalId?: string;
    pipelineId: string;
    projectId: string;
  } | null;
  availability: "available" | "unavailable" | "awaiting_resolution";
}
export interface InboxPage {
  list: InboxItem[];
  nextCursor: string | null;
  scanIncomplete: boolean;
}
export interface InboxCount {
  count: number;
  capped: boolean;
  incomplete: boolean;
}
const privateRequest = { silence: true, redactErrors: true };
const invalid = () => new Error("Inbox response could not be verified.");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
};
export const validInboxId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
/** Accept only bounded RFC3339-style instants, never Date.parse's prose/date fallbacks. */
const date = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 64) return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts || parts[0] !== value) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    Number.isFinite(Date.parse(value))
  );
};
function item(value: unknown): InboxItem {
  const row = object(value);
  const statuses: Record<InboxKind, string[]> = {
    run_result: ["success", "failed", "cancelled"],
    approval_requested: [
      "pending",
      "approved",
      "rejected",
      "expired",
      "cancelled",
    ],
    approval_result: ["approved", "rejected", "expired", "cancelled"],
  };
  if (
    !validInboxId(row.id) ||
    typeof row.kind !== "string" ||
    !Object.prototype.hasOwnProperty.call(statuses, row.kind) ||
    !statuses[row.kind as InboxKind].includes(row.status as string) ||
    !date(row.occurredAt) ||
    !date(row.deliveredAt) ||
    (row.readAt !== null && !date(row.readAt)) ||
    !["available", "unavailable", "awaiting_resolution"].includes(
      row.availability as string,
    )
  )
    throw invalid();
  let target: InboxItem["target"] = null;
  if (row.target !== null) {
    const value = object(row.target);
    if (
      !["run", "approval"].includes(value.type as string) ||
      !validInboxId(value.runId) ||
      !validInboxId(value.pipelineId) ||
      !validInboxId(value.projectId) ||
      (value.approvalId !== undefined && !validInboxId(value.approvalId)) ||
      (value.type === "approval" && !validInboxId(value.approvalId))
    )
      throw invalid();
    target = {
      type: value.type as "run" | "approval",
      runId: value.runId,
      pipelineId: value.pipelineId,
      projectId: value.projectId,
      ...(value.approvalId ? { approvalId: value.approvalId as string } : {}),
    };
  }
  if (row.availability === "unavailable") target = null;
  return {
    id: row.id,
    kind: row.kind as InboxKind,
    status: row.status as InboxStatus,
    occurredAt: row.occurredAt,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt as string | null,
    availability: row.availability as InboxItem["availability"],
    target,
  };
}
export async function listInbox(
  filter: InboxFilter,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<InboxPage> {
  const data = object(
    await get<unknown>("/inbox", {
      ...privateRequest,
      signal,
      params: { filter, limit: 20, ...(cursor ? { cursor } : {}) },
    }),
  );
  if (
    !Array.isArray(data.list) ||
    data.list.length > 20 ||
    (data.nextCursor !== null &&
      (typeof data.nextCursor !== "string" ||
        !data.nextCursor ||
        data.nextCursor.length > 4096)) ||
    typeof data.scanIncomplete !== "boolean"
  )
    throw invalid();
  const list = data.list.map(item);
  if (new Set(list.map((row) => row.id)).size !== list.length) throw invalid();
  return {
    list,
    nextCursor: data.nextCursor as string | null,
    scanIncomplete: data.scanIncomplete,
  };
}
export async function unreadInboxCount(
  signal?: AbortSignal,
): Promise<InboxCount> {
  const data = object(
    await get<unknown>("/inbox/unread-count", { ...privateRequest, signal }),
  );
  if (
    !Number.isSafeInteger(data.count) ||
    Number(data.count) < 0 ||
    Number(data.count) > 99 ||
    typeof data.capped !== "boolean" ||
    typeof data.incomplete !== "boolean" ||
    (data.capped && data.count !== 99)
  )
    throw invalid();
  return {
    count: data.count as number,
    capped: data.capped,
    incomplete: data.incomplete,
  };
}
export async function markInboxRead(id: string, signal?: AbortSignal) {
  if (!validInboxId(id)) throw invalid();
  const data = object(
    await post<unknown>(
      `/inbox/${encodeURIComponent(id)}/read`,
      {},
      { ...privateRequest, signal },
    ),
  );
  if (data.id !== id || !date(data.readAt)) throw invalid();
  return { id, readAt: data.readAt };
}
export function inboxCountLabel(data?: InboxCount) {
  if (!data || (data.incomplete && data.count === 0))
    return "Unread count unavailable";
  if (data.capped) return "99+ unread";
  if (data.incomplete) return `At least ${data.count} unread`;
  return `${data.count} unread`;
}
export function inboxTarget(item: InboxItem): string | null {
  const target = item.target;
  if (
    !target ||
    item.availability !== "available" ||
    !validInboxId(target.projectId) ||
    !validInboxId(target.pipelineId) ||
    !validInboxId(target.runId)
  )
    return null;
  return `/projects/${encodeURIComponent(target.projectId)}/pipelines?${new URLSearchParams({ pipeline: target.pipelineId, run: target.runId })}`;
}
export function inboxTitle(item: InboxItem): string {
  if (item.kind === "approval_requested") return "Approval requested";
  const labels: Record<InboxStatus, string> = {
    success: "Run succeeded",
    failed: "Run failed",
    cancelled:
      item.kind === "run_result" ? "Run cancelled" : "Approval cancelled",
    pending: "Approval requested",
    approved: "Approval approved",
    rejected: "Approval rejected",
    expired: "Approval expired",
  };
  return labels[item.status];
}
