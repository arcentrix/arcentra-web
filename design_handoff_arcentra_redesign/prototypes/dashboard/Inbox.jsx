/* Web app — Inbox / Notification center.
   Categories: Approvals, Mentions, Alerts, System, Subscribed.
   Adapted from arcentra-web/src/pages/Inbox/index.tsx. */

function Inbox() {
  const [filter, setFilter] = React.useState("all");
  const [readMap, setReadMap] = React.useState({});

  const notifications = [
    { id: "n1",  type: "approval", title: "Approval requested · release/api v2.4.0", body: "mark.weber requested your approval for the production release.", actor: "mark.weber", when: "2m ago",  unread: true,  sev: "info" },
    { id: "n2",  type: "alert",    title: "ml-inference · 5xx rate above 2%",          body: "p95 errors 2.14% in last 5m on production.",                       actor: "system",     when: "4m ago",  unread: true,  sev: "fail" },
    { id: "n3",  type: "mention",  title: "@e.chen mentioned in #2147",                 body: "j.park: \"can you take a look at the cors hotfix once #2147 lands?\"", actor: "j.park",     when: "12m ago", unread: true,  sev: "info" },
    { id: "n4",  type: "alert",    title: "billing · latency p95 above 100ms",          body: "Active for 12m. Auto-acked once latency drops below threshold.",   actor: "system",     when: "12m ago", unread: false, sev: "warn" },
    { id: "n5",  type: "approval", title: "Approval requested · STRIPE_SECRET rotation",body: "deploy-bot wants to rotate STRIPE_SECRET (last rotated 12d ago).",  actor: "deploy-bot", when: "32m ago", unread: false, sev: "info" },
    { id: "n6",  type: "system",   title: "Runner runner-29 marked unhealthy",          body: "Missed 3 heartbeats. Drained automatically from prod-eu pool.",     actor: "system",     when: "1h ago",  unread: false, sev: "warn" },
    { id: "n7",  type: "mention",  title: "@e.chen review requested · pipeline-editor", body: "sara.li: \"PR for the pipeline editor refactor is ready for review.\"",actor: "sara.li",    when: "3h ago",  unread: false, sev: "info" },
    { id: "n8",  type: "system",   title: "Deploy completed · v2.4.0-rc.3 → dev",       body: "Build #2148 deployed to dev in 8m 32s. No regressions detected.",   actor: "deploy-bot", when: "5h ago",  unread: false, sev: "ok"   },
    { id: "n9",  type: "alert",    title: "Failed run · etl/daily backfill",            body: "Pipeline #2145 failed at stage \"validate-output\". 12 retries spent.",actor: "system",     when: "1d ago",  unread: false, sev: "fail" },
    { id: "n10", type: "approval", title: "Workspace invitation accepted",              body: "contractor-114 accepted the workspace invitation. Expires in 4 days.",actor: "system",     when: "2d ago",  unread: false, sev: "ok"   },
  ];

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return n.unread && !readMap[n.id];
    return n.type === filter;
  });

  const counts = {
    all:       notifications.length,
    unread:    notifications.filter((n) => n.unread && !readMap[n.id]).length,
    approval:  notifications.filter((n) => n.type === "approval").length,
    mention:   notifications.filter((n) => n.type === "mention").length,
    alert:     notifications.filter((n) => n.type === "alert").length,
    system:    notifications.filter((n) => n.type === "system").length,
  };

  const TABS = [
    { id: "all",      label: "All",       count: counts.all },
    { id: "unread",   label: "Unread",    count: counts.unread },
    { id: "approval", label: "Approvals", count: counts.approval },
    { id: "mention",  label: "Mentions",  count: counts.mention },
    { id: "alert",    label: "Alerts",    count: counts.alert },
    { id: "system",   label: "System",    count: counts.system },
  ];

  const markRead = (id) => setReadMap((m) => ({ ...m, [id]: true }));
  const markAllRead = () => {
    const m = {};
    notifications.forEach((n) => { if (n.unread) m[n.id] = true; });
    setReadMap(m);
  };

  return (
    <section style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="inbox / notifications"
        title="Inbox"
        sub={`${counts.unread} unread · approvals, mentions, alerts and system events.`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="md" leftIcon={<Icon d={I.bell} size={14} />}>Subscriptions</Button>
            <Button variant="ghost" size="md" onClick={markAllRead}>Mark all read</Button>
          </div>
        }
      />

      {/* Tab strip */}
      <div role="tablist" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)",
        padding: 4, alignSelf: "flex-start",
      }}>
        {TABS.map((t) => {
          const active = t.id === filter;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setFilter(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 30, padding: "0 12px", borderRadius: 6,
              background: active ? "var(--bg)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              boxShadow: active ? "inset 0 0 0 1px var(--border-strong)" : "none",
              border: 0, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            }}>
              {t.label}
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: active ? (t.id === "unread" && t.count > 0 ? "var(--brand-signal)" : "var(--fg-muted)") : "var(--fg-subtle)",
                fontVariantNumeric: "tabular-nums",
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <Panel>
        {filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--fg-muted)", fontSize: 14 }}>
            Nothing here. <span style={{ color: "var(--fg-subtle)" }}>Inbox zero · clean.</span>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filtered.map((n, i) => {
              const unread = n.unread && !readMap[n.id];
              return (
                <li key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "14px 20px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  background: unread ? "color-mix(in oklab, var(--brand-signal) 4%, transparent)" : "transparent",
                  cursor: "pointer",
                }} onClick={() => markRead(n.id)}>
                  {/* Left indicator: unread dot + status */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4, gap: 8, flexShrink: 0 }}>
                    {unread
                      ? <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--brand-signal)" }} />
                      : <span style={{ width: 8, height: 8 }} />}
                    <StatusDot tone={n.sev} pulse={false} />
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{
                        fontSize: 13.5, fontWeight: unread ? 600 : 500,
                        color: "var(--fg)",
                      }}>{n.title}</span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", height: 18, padding: "0 6px",
                        borderRadius: 4, border: "1px solid var(--border)",
                        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-muted)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>{n.type}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: "4px 0 0", lineHeight: 1.55 }}>{n.body}</p>
                    <div style={{
                      marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)",
                      display: "flex", gap: 10,
                    }}>
                      <span>{n.actor}</span>
                      <span>·</span>
                      <span>{n.when}</span>
                    </div>
                  </div>

                  {/* Right action */}
                  <div style={{ flexShrink: 0, display: "flex", gap: 6, paddingTop: 2 }}>
                    {n.type === "approval" && (
                      <>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>Approve</Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>Decline</Button>
                      </>
                    )}
                    {n.type === "alert" && (
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>Ack</Button>
                    )}
                    {(n.type === "mention" || n.type === "system") && (
                      <Button variant="ghost" size="sm" rightIcon={<Icon d={I.arrowUpRight} size={12} />}>Open</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}

window.Inbox = Inbox;
