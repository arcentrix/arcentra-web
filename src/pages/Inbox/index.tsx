/**
 * Inbox / Notification center
 * Engineering Blueprint redesign.
 */

import { useState, useEffect, useRef } from "react";
import { Bell, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Panel, StatusDot } from "@/components/blueprint";
import { toast } from "@/lib/toast";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

// ─── Types ────────────────────────────────────────────────────

type NotificationType = "approval" | "alert" | "mention" | "system";
type SeverityTone = "ok" | "info" | "warn" | "fail";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor: string;
  createdAt: string;
  unread: boolean;
  sev: SeverityTone;
  link?: string;
}

// ─── Static mock data (replace with API call when ready) ──────

const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "approval",
    title: "Approval requested · release/api v2.4.0",
    body: "mark.weber requested your approval for the production release.",
    actor: "mark.weber",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unread: true,
    sev: "info",
    link: "/projects",
  },
  {
    id: "n2",
    type: "alert",
    title: "ml-inference · 5xx rate above 2%",
    body: "p95 errors 2.14% in last 5m on production.",
    actor: "system",
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    unread: true,
    sev: "fail",
  },
  {
    id: "n3",
    type: "mention",
    title: "@you mentioned in #2147",
    body: 'j.park: "can you take a look at the cors hotfix once #2147 lands?"',
    actor: "j.park",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    unread: true,
    sev: "info",
    link: "/projects",
  },
  {
    id: "n4",
    type: "alert",
    title: "billing · latency p95 above 100ms",
    body: "Active for 12m. Auto-acked once latency drops below threshold.",
    actor: "system",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    unread: false,
    sev: "warn",
  },
  {
    id: "n5",
    type: "approval",
    title: "Approval requested · STRIPE_SECRET rotation",
    body: "deploy-bot wants to rotate STRIPE_SECRET (last rotated 12d ago).",
    actor: "deploy-bot",
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    unread: false,
    sev: "info",
  },
  {
    id: "n6",
    type: "system",
    title: "Runner runner-29 marked unhealthy",
    body: "Missed 3 heartbeats. Drained automatically from prod-eu pool.",
    actor: "system",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    unread: false,
    sev: "warn",
  },
  {
    id: "n7",
    type: "mention",
    title: "@you review requested · pipeline-editor",
    body: 'sara.li: "PR for the pipeline editor refactor is ready for review."',
    actor: "sara.li",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    unread: false,
    sev: "info",
    link: "/projects",
  },
  {
    id: "n8",
    type: "system",
    title: "Deploy completed · v2.4.0-rc.3 → dev",
    body: "Build #2148 deployed to dev in 8m 32s. No regressions detected.",
    actor: "deploy-bot",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    unread: false,
    sev: "ok",
  },
  {
    id: "n9",
    type: "alert",
    title: "Failed run · etl/daily backfill",
    body: 'Pipeline #2145 failed at stage "validate-output". 12 retries spent.',
    actor: "system",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    sev: "fail",
  },
  {
    id: "n10",
    type: "approval",
    title: "Workspace invitation accepted",
    body: "contractor-114 accepted the workspace invitation. Expires in 4 days.",
    actor: "system",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    unread: false,
    sev: "ok",
  },
];

// ─── Tab definition ───────────────────────────────────────────

type TabId = "all" | "unread" | "approval" | "mention" | "alert" | "system";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "approval", label: "Approvals" },
  { id: "mention", label: "Mentions" },
  { id: "alert", label: "Alerts" },
  { id: "system", label: "System" },
];

// ─── Notification row ─────────────────────────────────────────

function NotificationRow({
  n,
  index,
  isUnread,
  onRowClick,
  onApprove,
  onDecline,
  onAck,
  onOpen,
}: {
  n: Notification;
  index: number;
  isUnread: boolean;
  onRowClick: () => void;
  onApprove: (e: React.MouseEvent) => void;
  onDecline: (e: React.MouseEvent) => void;
  onAck: (e: React.MouseEvent) => void;
  onOpen: (e: React.MouseEvent) => void;
}) {
  return (
    <li
      onClick={onRowClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 20px",
        borderTop: index === 0 ? "none" : "1px solid var(--border)",
        background: isUnread
          ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)"
          : "transparent",
        cursor: "pointer",
      }}
    >
      {/* Left indicator column: unread dot + status dot */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 4,
          gap: 8,
          flexShrink: 0,
        }}
      >
        {isUnread ? (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: "var(--brand-signal)",
              display: "block",
            }}
          />
        ) : (
          <span style={{ width: 8, height: 8, display: "block" }} />
        )}
        <StatusDot tone={n.sev} pulse={false} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: isUnread ? 600 : 500,
              color: "var(--fg)",
            }}
          >
            {n.title}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 18,
              padding: "0 6px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            {n.type}
          </span>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--fg-muted)",
            margin: "4px 0 0",
            lineHeight: 1.55,
          }}
        >
          {n.body}
        </p>
        <div
          style={{
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-subtle)",
            display: "flex",
            gap: 10,
          }}
        >
          <span>{n.actor}</span>
          <span>·</span>
          <span>{dayjs(n.createdAt).fromNow()}</span>
        </div>
      </div>

      {/* Right action buttons */}
      <div
        style={{ flexShrink: 0, display: "flex", gap: 6, paddingTop: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {n.type === "approval" && (
          <>
            <Button variant="outline" size="sm" onClick={onApprove}>
              Approve
            </Button>
            <Button variant="ghost" size="sm" onClick={onDecline}>
              Decline
            </Button>
          </>
        )}
        {n.type === "alert" && (
          <Button variant="outline" size="sm" onClick={onAck}>
            Ack
          </Button>
        )}
        {(n.type === "mention" || n.type === "system") && (
          <Button variant="ghost" size="sm" onClick={onOpen}>
            Open
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function InboxPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<TabId>("all");
  const hasFetchedRef = useRef(false);

  // Load notifications (API stub — replace body when endpoint is ready)
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const load = async () => {
      try {
        // TODO: const data = await Apis.notification.listNotifications();
        // setNotifications(data.notifications);
      } catch (error) {
        console.error("Failed to load notifications:", error);
        toast.error("Failed to load notifications");
      }
    };

    void load();
  }, []);

  // ── Derived counts ─────────────────────────────────────────

  const isUnread = (n: Notification) => n.unread && !readMap[n.id];

  const counts: Record<TabId, number> = {
    all: notifications.length,
    unread: notifications.filter(isUnread).length,
    approval: notifications.filter((n) => n.type === "approval").length,
    mention: notifications.filter((n) => n.type === "mention").length,
    alert: notifications.filter((n) => n.type === "alert").length,
    system: notifications.filter((n) => n.type === "system").length,
  };

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return isUnread(n);
    return n.type === filter;
  });

  const unreadCount = counts.unread;

  // ── Actions ────────────────────────────────────────────────

  const markRead = (id: string) =>
    setReadMap((m) => ({ ...m, [id]: true }));

  const markAllAsRead = async () => {
    try {
      // TODO: await Apis.notification.markAllAsRead();
      const m: Record<string, boolean> = {};
      notifications.forEach((n) => {
        if (n.unread) m[n.id] = true;
      });
      setReadMap(m);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const markAsRead = async (id: string) => {
    try {
      // TODO: await Apis.notification.markAsRead(id);
      markRead(id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // TODO: await Apis.notification.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification removed");
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (isUnread(n)) void markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        eyebrow="inbox / notifications"
        title="Inbox"
        sub={`${unreadCount} unread · approvals, mentions, alerts and system events.`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              Subscriptions
            </Button>
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          </div>
        }
      />

      {/* Tab strip */}
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          padding: 4,
          alignSelf: "flex-start",
        }}
      >
        {TABS.map((t) => {
          const active = t.id === filter;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 30,
                padding: "0 12px",
                borderRadius: 6,
                background: active ? "var(--background)" : "transparent",
                color: active ? "var(--fg)" : "var(--fg-muted)",
                boxShadow: active
                  ? "inset 0 0 0 1px var(--border-strong)"
                  : "none",
                border: 0,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {t.label}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  color: active
                    ? t.id === "unread" && counts.unread > 0
                      ? "var(--brand-signal)"
                      : "var(--fg-muted)"
                    : "var(--fg-subtle)",
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications panel */}
      <Panel>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: "var(--fg-muted)",
              fontSize: 14,
            }}
          >
            Nothing here.{" "}
            <span style={{ color: "var(--fg-subtle)" }}>
              Inbox zero · clean.
            </span>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filtered.map((n, i) => (
              <NotificationRow
                key={n.id}
                n={n}
                index={i}
                isUnread={isUnread(n)}
                onRowClick={() => handleNotificationClick(n)}
                onApprove={(e) => {
                  e.stopPropagation();
                  void markAsRead(n.id);
                }}
                onDecline={(e) => {
                  e.stopPropagation();
                  void deleteNotification(n.id);
                }}
                onAck={(e) => {
                  e.stopPropagation();
                  void markAsRead(n.id);
                }}
                onOpen={(e) => {
                  e.stopPropagation();
                  void markAsRead(n.id);
                  if (n.link) navigate(n.link);
                }}
              />
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
