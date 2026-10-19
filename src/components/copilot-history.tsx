import { useState } from "react";
import type { CopilotStatus } from "@/api/copilot";
import {
  historySelectionError,
  contentAvailableBefore,
  turnStateDescription,
} from "@/api/copilot/history";
import type { CopilotHistoryController } from "./use-copilot-history";
import { Button } from "./ui/button";

export function historyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
export function CopilotHistory({
  history,
  status,
  runId,
  mode,
  onEphemeral,
  onPrivate,
  disabled,
}: {
  history: CopilotHistoryController;
  status: CopilotStatus;
  runId: string;
  mode: "ephemeral" | "private";
  onEphemeral: () => void;
  onPrivate: () => void;
  disabled: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const conversation = history.conversation;
  const available =
    status.historyEnabled === true && status.historyAvailable === true;
  return (
    <section
      aria-label="Private conversation history"
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Private conversation history</h3>
        <span className="text-xs">
          {mode === "private"
            ? conversation
              ? "Private saved conversation"
              : "Private history mode · no conversation open"
            : "Ephemeral analysis · not saved"}
        </span>
      </div>
      {mode === "private" && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || history.busy}
          onClick={onEphemeral}
        >
          Use ephemeral analysis
        </Button>
      )}
      {!available ? (
        <p role="status" className="text-sm text-muted-foreground">
          {status.historyEnabled === true
            ? "Private history is unavailable. A valid managed encryption key is required. No saved conversation can be created or sent."
            : "Private history is disabled or unavailable on this server. Ephemeral analysis remains available separately."}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Saved questions and answers are private to your account and this
            fixed project, pipeline and run, subject to current access. Redacted
            bodies are encrypted and retained for 30 days from each message's
            creation. Opening history does not extend retention or send it to a
            model. Backups follow the operator's backup retention.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || history.busy || !runId.trim()}
              onClick={() => {
                setConfirmDelete(false);
                onPrivate();
                void history.create(runId);
              }}
            >
              Create private conversation · 30 days
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || history.busy}
              onClick={() => {
                onPrivate();
                void history.list();
              }}
            >
              Load private conversations
            </Button>
          </div>
          {history.conversations.length > 0 && (
            <ul aria-label="Your conversations" className="space-y-2">
              {history.conversations.map((item) => (
                <li key={item.conversationId} className="min-w-0">
                  <button
                    type="button"
                    aria-label={`Open private conversation ${item.conversationId}`}
                    disabled={disabled || history.busy}
                    className="max-w-full break-all text-left text-sm underline underline-offset-4 disabled:opacity-50"
                    onClick={() => {
                      setConfirmDelete(false);
                      onPrivate();
                      void history.open(item.conversationId);
                    }}
                  >
                    Run {item.runId} · {historyDate(item.createdAt)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {history.nextCursor && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || history.busy}
              onClick={() => void history.list(true)}
            >
              More conversations
            </Button>
          )}
          {conversation && (
            <>
              <dl
                className="space-y-1 break-all text-xs"
                aria-label="Fixed conversation scope"
              >
                <div>Conversation: {conversation.conversationId}</div>
                <div>Project: {conversation.projectId}</div>
                <div>Pipeline: {conversation.pipelineId}</div>
                <div>Run: {conversation.runId}</div>
                <div>
                  Conversation expires: {historyDate(conversation.expiresAt)}.
                  Each message has its own expiry.
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled || history.busy}
                  onClick={() => void history.open(conversation.conversationId)}
                >
                  Refresh private history
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={history.busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete conversation
                </Button>
              </div>
              {confirmDelete && (
                <div
                  role="group"
                  aria-label="Confirm conversation deletion"
                  className="space-y-2 rounded border p-2 text-sm"
                >
                  <p>
                    Delete saved bodies and patches and request cancellation of
                    pending messages? This does not recall data already sent,
                    erase backups immediately, or cancel any pipeline or
                    deployment.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={history.busy}
                      onClick={() => {
                        setConfirmDelete(false);
                        void history.remove();
                      }}
                    >
                      Delete saved conversation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep conversation
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Choose up to 6 completed question/answer pairs, at most 8 KiB,
                for your next preview. Selection order is transmission order. No
                history is selected automatically.
              </p>
              {history.selectedIds.length > 0 && (
                <ol
                  aria-label="History transmission order"
                  className="list-inside list-decimal text-xs"
                >
                  {history.selectedIds.map((id) => (
                    <li key={id}>
                      Turn{" "}
                      {
                        history.turns.find((item) => item.turnId === id)
                          ?.sequence
                      }
                    </li>
                  ))}
                </ol>
              )}
              <div className="space-y-3" aria-label="Saved turns">
                {history.turns.map((turn) => {
                  const expired =
                    !Number.isFinite(Date.parse(turn.expiresAt)) ||
                    Date.parse(turn.expiresAt) <= Date.now();
                  const available =
                    turn.contentAvailable &&
                    !expired &&
                    contentAvailableBefore(turn) > Date.now();
                  const selectionError = historySelectionError(history.turns, [
                    ...history.selectedIds,
                    turn.turnId,
                  ]);
                  return (
                    <article
                      key={turn.turnId}
                      className="min-w-0 space-y-2 rounded border p-3"
                      aria-label={`Saved turn ${turn.sequence}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <strong>
                          Turn {turn.sequence} · {turn.state}
                        </strong>
                        <span>Expires {historyDate(turn.expiresAt)}</span>
                      </div>
                      {turn.contentAvailableUntil && (
                        <p className="text-xs text-muted-foreground">
                          Content available until{" "}
                          {historyDate(turn.contentAvailableUntil)}, subject to
                          current access and evidence.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {turnStateDescription[turn.state] ||
                          "Status unavailable. No automatic resend."}
                      </p>
                      {available ? (
                        <>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            <strong>Question: </strong>
                            {turn.question}
                          </p>
                          <pre className="max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words text-sm">
                            {turn.text}
                          </pre>
                          {turn.warnings?.map((warning, i) => (
                            <p
                              key={i}
                              className="text-xs text-muted-foreground"
                            >
                              {warning}
                            </p>
                          ))}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {expired
                            ? "This message's retention period has expired. Content is unavailable."
                            : "Content unavailable. Current access, retained evidence or redaction could not be verified."}
                        </p>
                      )}
                      {[
                        "reserved",
                        "dispatching",
                        "outcome_unknown",
                        "interrupted",
                      ].includes(turn.state) && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || history.busy}
                            onClick={() =>
                              void history.requestStatus(turn.requestId)
                            }
                          >
                            Check turn {turn.sequence} saved status
                          </Button>
                          {["reserved", "dispatching"].includes(turn.state) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={history.busy}
                              onClick={() =>
                                void history.requestStatus(turn.requestId, true)
                              }
                            >
                              Request cancellation for turn {turn.sequence}
                            </Button>
                          )}
                        </div>
                      )}
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={history.selectedIds.includes(turn.turnId)}
                          disabled={
                            disabled ||
                            history.busy ||
                            !available ||
                            turn.state !== "completed" ||
                            (!history.selectedIds.includes(turn.turnId) &&
                              !!selectionError)
                          }
                          onChange={() => history.select(turn.turnId)}
                        />
                        Include turn {turn.sequence} in next preview
                      </label>
                    </article>
                  );
                })}
              </div>
              {history.turns.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No saved messages in this conversation.
                </p>
              )}
              {history.nextAfterSequence > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled || history.busy}
                  onClick={() =>
                    void history.open(conversation.conversationId, true)
                  }
                >
                  More saved turns
                </Button>
              )}
            </>
          )}
        </>
      )}
      {history.busy && (
        <p role="status" className="text-sm">
          Loading private history…
        </p>
      )}
      {history.error && (
        <p role="alert" className="text-sm text-destructive">
          {history.error}
        </p>
      )}
    </section>
  );
}
