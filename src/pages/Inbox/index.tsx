import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  inboxCountLabel,
  inboxTarget,
  inboxTitle,
  listInbox,
  markInboxRead,
  type InboxFilter,
  type InboxPage,
} from "@/api/inbox";
import {
  inboxSession,
  refreshInbox,
  useInboxCount,
  useInboxSession,
} from "@/hooks/use-inbox";
import { isApiError } from "@/lib/api-error";

const accessFailure = (error: unknown) =>
  isApiError(error) &&
  [401, 403].some((status) => error.status === status || error.code === status);
function invalidateCount(error: unknown) {
  if (accessFailure(error))
    window.dispatchEvent(new Event("inbox-access-invalidated"));
  else refreshInbox();
}
function failure(error: unknown) {
  if (isApiError(error) && (error.status === 400 || error.code === 400))
    return "This inbox page has expired or is invalid. Refresh to reload from the start.";
  if (
    isApiError(error) &&
    [401, 403, 404].some(
      (status) => error.status === status || error.code === status,
    )
  )
    return "Inbox access changed or this item is unavailable. Refresh to check current access.";
  return "Inbox could not be verified. Refresh to check current data.";
}
export default function Inbox() {
  const session = useInboxSession();
  const [params, setParams] = useSearchParams();
  const filter: InboxFilter =
    params.get("filter") === "unread" ? "unread" : "all";
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="personal / notifications"
        title="Inbox"
        sub="Your in-app run results and durable approval requests and results."
      />
      <p className="max-w-3xl text-sm text-fg-muted">
        Includes new manual runs and their approvals. Historical and automatic
        runs are not backfilled. Email and chat delivery are not supported.
        Reading an item does not approve, retry, deploy, or send anything.
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Inbox filter"
      >
        {(["all", "unread"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setParams({ filter: value })}
          >
            {value === "all" ? "All" : "Unread"}
          </Button>
        ))}
      </div>
      <InboxSnapshot
        key={`${session.scope}:${filter}`}
        scope={session.scope}
        authenticated={session.authenticated}
        filter={filter}
      />
    </section>
  );
}
function InboxSnapshot({
  scope,
  authenticated,
  filter,
}: {
  scope: number;
  authenticated: boolean;
  filter: InboxFilter;
}) {
  const [request, setRequest] = useState<{
    revision: number;
    cursor: string | null;
  }>({ revision: 0, cursor: null });
  const [page, setPage] = useState<InboxPage>();
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const count = useInboxCount();
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    if (!authenticated) return;
    let disposed = false;
    const controller = new AbortController();
    listRequest.current = controller;
    setPage(undefined);
    setError("");
    setLoading(true);
    void listInbox(filter, request.cursor, controller.signal)
      .then((data) => {
        if (
          !disposed &&
          !controller.signal.aborted &&
          inboxSession() === scope
        ) {
          setPage(data);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (
          !disposed &&
          !controller.signal.aborted &&
          inboxSession() === scope
        ) {
          setPage(undefined);
          setLoading(false);
          setError(failure(reason));
          invalidateCount(reason);
        }
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [authenticated, scope, filter, request]);
  const reload = () => {
    mutation.current?.abort();
    mutation.current = null;
    setPending(null);
    setPage(undefined);
    setLoading(true);
    setMutationError("");
    setRequest((old) => ({ revision: old.revision + 1, cursor: null }));
    refreshInbox();
  };
  useEffect(() => {
    // Returning to the app must revalidate authorization, not redisplay an old snapshot.
    const revalidate = () => {
      mutation.current?.abort();
      mutation.current = null;
      setPending(null);
      setPage(undefined);
      setLoading(true);
      setRequest((old) => ({ revision: old.revision + 1, cursor: null }));
    };
    const invalidate = () => {
      listRequest.current?.abort();
      mutation.current?.abort();
      mutation.current = null;
      setPage(undefined);
      setLoading(false);
      setPending(null);
      setError("Inbox access changed. Refresh to check current access.");
    };
    window.addEventListener("inbox-access-invalidated", invalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("inbox-access-invalidated", invalidate);
    };
  }, []);
  const markRead = async (id: string) => {
    if (mutation.current || inboxSession() !== scope) return;
    const controller = new AbortController();
    mutation.current = controller;
    setPending(id);
    setMutationError("");
    try {
      const result = await markInboxRead(id, controller.signal);
      if (controller.signal.aborted || inboxSession() !== scope) return;
      setPage((old) =>
        old
          ? {
              ...old,
              list:
                filter === "unread"
                  ? old.list.filter((row) => row.id !== id)
                  : old.list.map((row) =>
                      row.id === id ? { ...row, readAt: result.readAt } : row,
                    ),
            }
          : old,
      );
      refreshInbox();
    } catch (reason) {
      if (controller.signal.aborted || inboxSession() !== scope) return;
      // A failure may mean access was revoked. Never keep a stale authorized snapshot.
      setPage(undefined);
      setMutationError(`Read status was not confirmed. ${failure(reason)}`);
      invalidateCount(reason);
    } finally {
      if (!controller.signal.aborted && inboxSession() === scope) {
        mutation.current = null;
        setPending(null);
      }
    }
  };
  return (
    <Panel>
      <PanelHeader
        title="Personal inbox"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={reload}
            disabled={!authenticated}
          >
            Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {inboxCountLabel(count)}
        </p>
        {!authenticated && <p role="status">Sign in to view your inbox.</p>}
        {loading && authenticated && <p role="status">Loading inbox…</p>}
        {error && <p role="alert">{error}</p>}
        {mutationError && <p role="alert">{mutationError}</p>}
        {!loading && page && (
          <>
            {page.list.length === 0 && (
              <p>
                {page.nextCursor
                  ? "No visible items on this page. Continue scanning for more."
                  : page.scanIncomplete
                    ? "No visible items in this partial scan. Refresh to check again."
                    : request.cursor
                      ? filter === "unread"
                        ? "No unread items on this page."
                        : "No items on this page."
                      : filter === "unread"
                        ? "No unread items in this inbox."
                        : "No items in this inbox yet."}
              </p>
            )}
            <ul className="divide-y">
              {page.list.map((item) => {
                const target = inboxTarget(item);
                return (
                  <li
                    data-inbox-id={item.id}
                    data-inbox-read={item.readAt ? "true" : "false"}
                    key={item.id}
                    className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-medium">
                        {inboxTitle(item)}
                      </h3>
                      <p className="text-xs text-fg-muted">
                        {item.readAt ? "Read" : "Unread"} · {item.status} ·{" "}
                        <time dateTime={item.occurredAt}>
                          {new Date(item.occurredAt).toLocaleString()}
                        </time>
                      </p>
                      {item.availability === "unavailable" && (
                        <p className="text-sm text-fg-muted">
                          Source unavailable
                        </p>
                      )}
                      {item.availability === "awaiting_resolution" && (
                        <p className="text-sm text-fg-muted">
                          Awaiting authoritative resolution. Refresh to check
                          the latest state.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {target && (
                        <Button asChild variant="outline" size="sm">
                          <Link to={target}>
                            {item.kind === "run_result"
                              ? "View run"
                              : "View approval context"}
                          </Link>
                        </Button>
                      )}
                      {!item.readAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending !== null}
                          onClick={() => void markRead(item.id)}
                        >
                          {pending === item.id ? "Marking read…" : "Mark read"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {page.scanIncomplete && (
              <p className="text-sm text-fg-muted">
                This scan is incomplete. Results may be a partial view of your
                inbox.
              </p>
            )}
            {request.cursor && (
              <Button
                variant="outline"
                disabled={pending !== null}
                onClick={reload}
              >
                Back to first page
              </Button>
            )}
            {page.nextCursor && (
              <Button
                variant="outline"
                disabled={pending !== null}
                onClick={() => {
                  setPage(undefined);
                  setLoading(true);
                  setRequest((old) => ({
                    revision: old.revision + 1,
                    cursor: page.nextCursor,
                  }));
                }}
              >
                Next page
              </Button>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
