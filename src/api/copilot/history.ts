import { del, get, post } from "../client";
import type { CopilotPreview, CopilotRequest, CopilotResult } from "./index";

export interface CopilotConversation {
  conversationId: string;
  projectId: string;
  pipelineId: string;
  runId: string;
  state: "active" | "deleted";
  version: number;
  createdAt: string;
  expiresAt: string;
}
export type CopilotTurnState =
  | "reserved"
  | "dispatching"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "outcome_unknown"
  | "withheld";
export interface CopilotTurn {
  turnId: string;
  requestId: string;
  sequence: number;
  state: CopilotTurnState;
  version: number;
  question?: string;
  text?: string;
  evidence: CopilotResult["evidence"];
  warnings: string[];
  contentAvailable: boolean;
  contentAvailableUntil?: string;
  unavailableReason?: string;
  createdAt: string;
  expiresAt: string;
}
export interface CopilotConversationList {
  conversations: CopilotConversation[];
  nextCursor?: string;
}
export interface CopilotConversationDetail {
  conversation: CopilotConversation;
  turns: CopilotTurn[];
  nextAfterSequence?: number;
}
export interface CopilotHistoryRequest extends CopilotRequest {
  historyTurnIds: string[];
}
export interface CopilotHistoryPreview extends CopilotPreview {
  historyTurnIds: string[];
  historyBytes: number;
}
export const historyBase = (projectId: string, conversationId?: string) =>
  `/projects/${encodeURIComponent(projectId)}/copilot/conversations${conversationId ? `/${encodeURIComponent(conversationId)}` : ""}`;
const readConfig = (signal?: AbortSignal) => ({
  signal,
  silence: true,
  redactErrors: true,
});
export const listCopilotConversations = (
  projectId: string,
  cursor = "",
  signal?: AbortSignal,
) =>
  get<CopilotConversationList>(historyBase(projectId), {
    ...readConfig(signal),
    params: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
export const createCopilotConversation = (
  projectId: string,
  input: { runId: string; requestId: string; acknowledgeRetention: true },
  signal?: AbortSignal,
) =>
  post<CopilotConversation>(historyBase(projectId), input, readConfig(signal));
export const getCopilotConversation = (
  projectId: string,
  conversationId: string,
  afterSequence = 0,
  signal?: AbortSignal,
) =>
  get<CopilotConversationDetail>(historyBase(projectId, conversationId), {
    ...readConfig(signal),
    params: { limit: 20, after: afterSequence },
  });
export const deleteCopilotConversation = (
  projectId: string,
  conversationId: string,
  expectedVersion: number,
  signal?: AbortSignal,
) =>
  del<{ deleted: boolean }>(historyBase(projectId, conversationId), {
    ...readConfig(signal),
    data: { expectedVersion },
  });
export const previewCopilotHistory = (
  projectId: string,
  conversationId: string,
  input: CopilotHistoryRequest,
  signal?: AbortSignal,
) =>
  post<CopilotHistoryPreview>(
    `${historyBase(projectId, conversationId)}/preview`,
    input,
    { ...readConfig(signal), timeout: 20000 },
  );
export const sendCopilotTurn = (
  projectId: string,
  conversationId: string,
  input: CopilotHistoryRequest,
  signal?: AbortSignal,
) =>
  post<CopilotTurn>(`${historyBase(projectId, conversationId)}/turns`, input, {
    ...readConfig(signal),
    timeout: 55000,
  });
export const getCopilotRequest = (
  projectId: string,
  conversationId: string,
  requestId: string,
  signal?: AbortSignal,
) =>
  get<CopilotTurn>(
    `${historyBase(projectId, conversationId)}/requests/${encodeURIComponent(requestId)}`,
    readConfig(signal),
  );
export const cancelCopilotTurn = (
  projectId: string,
  conversationId: string,
  requestId: string,
) =>
  post<CopilotTurn>(
    `${historyBase(projectId, conversationId)}/requests/${encodeURIComponent(requestId)}/cancel`,
    {},
    { ...readConfig(), timeout: 10000 },
  );

export function contentAvailableBefore(value: {
  expiresAt: string;
  contentAvailableUntil?: string;
}): number {
  const retention = Date.parse(value.expiresAt);
  const availability =
    value.contentAvailableUntil === undefined
      ? retention
      : Date.parse(value.contentAvailableUntil);
  return Number.isFinite(retention) && Number.isFinite(availability)
    ? Math.min(retention, availability)
    : 0;
}

export function historySelectionError(
  turns: CopilotTurn[],
  ids: string[],
): string | null {
  if (ids.length > 6 || new Set(ids).size !== ids.length)
    return "Choose at most 6 different completed turns.";
  let bytes = 0;
  for (const id of ids) {
    const turn = turns.find((item) => item.turnId === id);
    if (
      !turn ||
      turn.state !== "completed" ||
      !turn.contentAvailable ||
      turn.question === undefined ||
      turn.text === undefined ||
      contentAvailableBefore(turn) <= Date.now()
    )
      return "A selected turn is unavailable or expired. Choose history again.";
    bytes += new TextEncoder().encode(turn.question + turn.text).length;
  }
  return bytes > 8192
    ? "Selected history exceeds 8 KiB. Remove a turn; pairs are never truncated."
    : null;
}
export const turnStateDescription: Record<CopilotTurnState, string> = {
  reserved: "Reserved; provider dispatch is not yet recorded.",
  dispatching: "Dispatching; the provider may have received this request.",
  completed: "Completed and saved.",
  failed: "Failed. No automatic resend.",
  cancelled: "Cancelled. Data already transmitted cannot be recalled.",
  interrupted: "Interrupted before a recorded dispatch. No automatic resend.",
  outcome_unknown:
    "Outcome unknown. The provider may have received this request. No automatic resend.",
  withheld:
    "Content withheld because current authorization or evidence could not be verified.",
};
