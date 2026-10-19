import { useEffect, useRef, useState } from "react";
import {
  cancelCopilotTurn,
  getCopilotRequest,
  createCopilotConversation,
  deleteCopilotConversation,
  getCopilotConversation,
  listCopilotConversations,
  historySelectionError,
  contentAvailableBefore,
} from "@/api/copilot/history";
import type { CopilotConversation, CopilotTurn } from "@/api/copilot/history";

export function useCopilotHistory(
  projectId: string,
  onInvalidate: () => void,
  onOpen: (conversation: CopilotConversation) => void,
  onFailure: () => void,
  locked: boolean,
) {
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [conversation, setConversation] = useState<CopilotConversation | null>(
    null,
  );
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [nextAfterSequence, setNextAfterSequence] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const callbacks = useRef({ onInvalidate, onOpen, onFailure, locked });
  callbacks.current = { onInvalidate, onOpen, onFailure, locked };
  const current = useRef(conversation);
  current.current = conversation;

  useEffect(
    () => () => {
      epoch.current++;
      pending.current?.abort();
    },
    [],
  );
  function clear() {
    epoch.current++;
    pending.current?.abort();
    pending.current = null;
    setConversations([]);
    setNextCursor("");
    setConversation(null);
    setTurns([]);
    setSelectedIds([]);
    setNextAfterSequence(0);
    setBusy(false);
    setError("");
    setRevision((n) => n + 1);
  }
  function fail() {
    clear();
    callbacks.current.onInvalidate();
    callbacks.current.onFailure();
    setError(
      "Private history is unavailable. Your access, retention, evidence or encryption may have changed. Previously displayed private content has been cleared. Refresh to revalidate; nothing was resent.",
    );
  }
  async function execute(
    action: (signal: AbortSignal, fresh: () => boolean) => Promise<void>,
  ) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const generation = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      await action(controller.signal, () => generation === epoch.current);
    } catch {
      if (generation === epoch.current) fail();
    } finally {
      if (generation === epoch.current) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function list(more = false) {
    callbacks.current.onInvalidate();
    // A successful filtered list is not an authorization refresh for the open
    // conversation. Drop its bodies even when it is absent from this page.
    setConversation(null);
    setTurns([]);
    setSelectedIds([]);
    setNextAfterSequence(0);
    setRevision((n) => n + 1);
    return execute(async (signal, fresh) => {
      const value = await listCopilotConversations(
        projectId.trim(),
        more ? nextCursor : "",
        signal,
      );
      if (!fresh()) return;
      if (
        value.conversations.some((item) => item.projectId !== projectId.trim())
      )
        throw new Error("Scope mismatch");
      setConversations((old) =>
        more ? [...old, ...value.conversations] : value.conversations,
      );
      setNextCursor(value.nextCursor || "");
    });
  }
  function open(id: string, more = false) {
    callbacks.current.onInvalidate();
    setSelectedIds([]);
    setRevision((n) => n + 1);
    if (!more) {
      setConversation(null);
      setTurns([]);
      setNextAfterSequence(0);
    }
    return execute(async (signal, fresh) => {
      const value = await getCopilotConversation(
        projectId.trim(),
        id,
        more ? nextAfterSequence : 0,
        signal,
      );
      if (!fresh()) return;
      if (
        value.conversation.projectId !== projectId.trim() ||
        value.conversation.conversationId !== id ||
        value.conversation.state !== "active" ||
        !Number.isFinite(Date.parse(value.conversation.expiresAt)) ||
        Date.parse(value.conversation.expiresAt) <= Date.now()
      )
        throw new Error("Scope mismatch");
      if (!Array.isArray(value.turns) || value.turns.length > 20)
        throw new Error("Invalid turn page");
      const after = more ? nextAfterSequence : 0;
      if (
        value.turns.some(
          (turn, index) =>
            !Number.isSafeInteger(turn.sequence) ||
            turn.sequence <=
              (index > 0 ? value.turns[index - 1].sequence : after),
        ) ||
        new Set(value.turns.map((turn) => turn.turnId)).size !==
          value.turns.length ||
        (more &&
          (value.conversation.pipelineId !== conversation?.pipelineId ||
            value.conversation.runId !== conversation?.runId ||
            value.turns.some((turn) =>
              turns.some((old) => old.turnId === turn.turnId),
            )))
      )
        throw new Error("Turn page mismatch");
      setConversation(value.conversation);
      setTurns((old) => (more ? [...old, ...value.turns] : value.turns));
      setNextAfterSequence(value.nextAfterSequence || 0);
      callbacks.current.onOpen(value.conversation);
    });
  }
  function create(runId: string) {
    if (pending.current) return Promise.resolve();
    callbacks.current.onInvalidate();
    return execute(async (signal, fresh) => {
      const value = await createCopilotConversation(
        projectId.trim(),
        {
          runId: runId.trim(),
          requestId: crypto.randomUUID(),
          acknowledgeRetention: true,
        },
        signal,
      );
      if (!fresh()) return;
      if (
        value.projectId !== projectId.trim() ||
        value.runId !== runId.trim() ||
        value.state !== "active" ||
        !Number.isFinite(Date.parse(value.expiresAt)) ||
        Date.parse(value.expiresAt) <= Date.now()
      )
        throw new Error("Scope mismatch");
      setConversation(value);
      setTurns([]);
      setSelectedIds([]);
      setNextAfterSequence(0);
      setConversations((old) => [
        value,
        ...old.filter((item) => item.conversationId !== value.conversationId),
      ]);
      setRevision((n) => n + 1);
      callbacks.current.onOpen(value);
    });
  }
  function remove() {
    if (!conversation) return Promise.resolve();
    const value = conversation;
    callbacks.current.onInvalidate();
    // Remove displayed bodies immediately, including while deletion is pending.
    setConversation(null);
    setTurns([]);
    setSelectedIds([]);
    setRevision((n) => n + 1);
    return execute(async (signal, fresh) => {
      await deleteCopilotConversation(
        projectId.trim(),
        value.conversationId,
        value.version,
        signal,
      );
      if (fresh()) {
        setConversations((old) =>
          old.filter((item) => item.conversationId !== value.conversationId),
        );
        setNextAfterSequence(0);
      }
    });
  }
  function select(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    const issue = historySelectionError(turns, next);
    callbacks.current.onInvalidate();
    if (issue) {
      setError(issue);
      return;
    }
    setSelectedIds(next);
    setError("");
  }
  function receive(turn: CopilotTurn) {
    // New bodies have their own fixed retention. Appending does not extend old
    // bodies, but the conversation container must follow the latest child TTL.
    if (Number.isFinite(Date.parse(turn.expiresAt))) {
      setConversation((old) =>
        old && Date.parse(turn.expiresAt) > Date.parse(old.expiresAt)
          ? { ...old, expiresAt: turn.expiresAt }
          : old,
      );
      setConversations((old) =>
        old.map((item) =>
          item.conversationId === current.current?.conversationId &&
          Date.parse(turn.expiresAt) > Date.parse(item.expiresAt)
            ? { ...item, expiresAt: turn.expiresAt }
            : item,
        ),
      );
    }
    setTurns((old) =>
      [...old.filter((item) => item.requestId !== turn.requestId), turn].sort(
        (a, b) => a.sequence - b.sequence,
      ),
    );
    setSelectedIds([]);
    setRevision((n) => n + 1);
  }
  function requestStatus(requestId: string, cancel = false) {
    if (!conversation || pending.current) return Promise.resolve();
    const id = conversation.conversationId;
    callbacks.current.onInvalidate();
    return execute(async (signal, fresh) => {
      const turn = cancel
        ? await cancelCopilotTurn(projectId.trim(), id, requestId)
        : await getCopilotRequest(projectId.trim(), id, requestId, signal);
      if (!fresh()) return;
      if (turn.requestId !== requestId) throw new Error("Request mismatch");
      receive(turn);
    });
  }
  // Expiry removes bodies already on screen without requiring a navigation or model request.
  useEffect(() => {
    const expiry = Math.min(
      ...(conversation ? [Date.parse(conversation.expiresAt)] : []),
      ...turns
        .filter((turn) => turn.contentAvailable)
        .map(contentAvailableBefore),
    );
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(
      () => {
        const now = Date.now();
        callbacks.current.onInvalidate();
        setSelectedIds([]);
        setRevision((n) => n + 1);
        if (conversation && Date.parse(conversation.expiresAt) <= now) {
          setConversation(null);
          setTurns([]);
          setConversations((old) =>
            old.filter((item) => Date.parse(item.expiresAt) > now),
          );
          setError(
            "Conversation retention expired. Content is unavailable; nothing was resent.",
          );
        } else
          setTurns((old) =>
            old.map((turn) =>
              contentAvailableBefore(turn) <= now
                ? {
                    ...turn,
                    question: undefined,
                    text: undefined,
                    evidence: [],
                    warnings: [],
                    contentAvailable: false,
                  }
                : turn,
            ),
          );
      },
      Math.min(Math.max(0, expiry - Date.now() + 1), 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [conversation, turns]);
  // Focus is a read-only authorization revalidation, never a resend or restored consent.
  useEffect(() => {
    const refresh = () => {
      if (
        current.current &&
        !pending.current &&
        !callbacks.current.locked &&
        document.visibilityState !== "hidden"
      )
        void open(current.current.conversationId);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  });
  return {
    conversations,
    conversation,
    turns,
    nextCursor,
    nextAfterSequence,
    selectedIds,
    busy,
    error,
    revision,
    clear,
    fail,
    list,
    open,
    create,
    remove,
    select,
    receive,
    requestStatus,
  };
}
export type CopilotHistoryController = ReturnType<typeof useCopilotHistory>;
