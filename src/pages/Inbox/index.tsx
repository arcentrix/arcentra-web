import { Bell, Hammer, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelHeader, StatusBadge } from "@/components/blueprint";
import { Button } from "@/components/ui/button";

export default function Inbox() {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="workspace / notifications"
        title="Inbox"
        sub="Notification history and unread status are unavailable in this build."
      />
      <Panel>
        <PanelHeader
          title="Inbox is not connected"
          action={<StatusBadge tone="muted">Not connected</StatusBadge>}
        />
        <div className="space-y-6 p-5">
          <div className="flex items-start gap-3">
            <Bell
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-fg-muted"
            />
            <div className="max-w-2xl space-y-2 text-sm text-fg-muted">
              <p>
                There is no persistent notification feed connected to this page.
                Alerts, mentions, read status, and notification history cannot
                be loaded or changed here.
              </p>
              <p>
                This does not indicate whether you have pending approvals.
                Review actual requests in their build or deployment context.
              </p>
            </div>
          </div>
          <nav
            aria-label="Approval workflows"
            className="grid gap-4 border-t pt-5 sm:grid-cols-2"
          >
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Build approvals</h3>
              <p className="text-sm text-fg-muted">
                Select a pipeline and run in Build to view its persisted
                approval requests and your available review actions.
              </p>
              <Button asChild size="sm">
                <Link to="/build">
                  <Hammer aria-hidden />
                  Open Build
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Deployment approvals</h3>
              <p className="text-sm text-fg-muted">
                Select a project and release in Deploy to inspect its state and
                follow its linked build approval when present.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/deploy">
                  <Rocket aria-hidden />
                  Open Deploy
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      </Panel>
    </section>
  );
}
