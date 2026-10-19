import { useEffect, useRef, useState } from "react";
import { unreadInboxCount, type InboxCount } from "@/api/inbox";
import { isApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";

// Credentials never enter resource keys, the DOM, URLs, or persisted inbox caches.
let previousToken: string | undefined;
let previousUser: string | undefined;
let previousInitialized: boolean | undefined;
let generation = 0;
export function inboxSession() {
  const auth = authStore.getState();
  const user = userStore.getState().userinfo?.userId;
  if (
    previousToken !== auth.accessToken ||
    previousUser !== user ||
    previousInitialized !== auth.initialized
  ) {
    previousToken = auth.accessToken;
    previousUser = user;
    previousInitialized = auth.initialized;
    generation++;
  }
  return generation;
}
export function useInboxSession() {
  const auth = authStore.useState();
  const user = userStore.useState();
  // Valtio tracks properties read during render, so subscribe to both identities.
  void auth.accessToken;
  void user.userinfo?.userId;
  return { scope: inboxSession(), authenticated: auth.initialized };
}
export const refreshInbox = () =>
  window.dispatchEvent(new Event("inbox-refresh"));
export function useInboxCount() {
  const { scope, authenticated } = useInboxSession();
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    scope: number;
    revision: number;
    data?: InboxCount;
  }>();
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const invalidate = () => {
      active.current?.abort();
      setState(undefined);
    };
    window.addEventListener("inbox-access-invalidated", invalidate);
    window.addEventListener("inbox-refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("inbox-access-invalidated", invalidate);
      window.removeEventListener("inbox-refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    let disposed = false;
    const controller = new AbortController();
    active.current = controller;
    setState(undefined);
    void unreadInboxCount(controller.signal)
      .then((data) => {
        if (!disposed && !controller.signal.aborted && inboxSession() === scope)
          setState({ scope, revision, data });
      })
      .catch((error) => {
        if (
          !disposed &&
          !controller.signal.aborted &&
          inboxSession() === scope
        ) {
          setState({ scope, revision });
          if (
            isApiError(error) &&
            [401, 403].some(
              (status) => error.status === status || error.code === status,
            )
          )
            window.dispatchEvent(new Event("inbox-access-invalidated"));
        }
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [scope, authenticated, revision]);
  return authenticated && state?.scope === scope && state.revision === revision
    ? state.data
    : undefined;
}
