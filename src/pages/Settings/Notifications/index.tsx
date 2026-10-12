import { Bell, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsCard, StatusBadge } from "@/components/blueprint";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/** Notification management stays unavailable until a persistent API is exposed. */
export default function NotificationsPage({
  headless = false,
}: {
  /** 嵌入 Settings 侧栏分区时启用：去掉页头与外层留白 */
  headless?: boolean;
}) {
  return (
    <div
      className={
        headless
          ? "flex flex-col gap-4"
          : "flex-1 flex flex-col gap-6 p-4 md:p-8 pt-6"
      }
    >
      {!headless && (
        <PageHeader
          eyebrow="workspace / configuration"
          title="Notifications"
          sub="Notification channels, templates, and event routing."
        />
      )}
      <SettingsCard
        title="Notification settings unavailable"
        sub="Notification management is not integrated in this build."
        action={<StatusBadge tone="muted">Not integrated</StatusBadge>}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <Bell
              className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted"
              aria-hidden
            />
            <div className="max-w-2xl space-y-2 text-[13px] text-fg-muted">
              <p>
                This build does not expose a management API for notification
                channels, templates, or routing rules. Existing configuration
                cannot be loaded or changed here.
              </p>
              <p>
                Creating, editing, deleting, and enabling notifications are
                unavailable until that API is integrated. No notification
                settings are saved from this page.
              </p>
            </div>
          </div>
          <dl className="grid gap-4 border-t pt-4 text-[13px] md:grid-cols-3">
            <div>
              <dt className="font-medium">Channels</dt>
              <dd className="mt-1 text-fg-muted">
                Provider configuration and enabled status are unavailable.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Templates</dt>
              <dd className="mt-1 text-fg-muted">
                Saved message templates cannot be listed or updated.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Routing rules</dt>
              <dd className="mt-1 text-fg-muted">
                Event-to-channel routing cannot be viewed or configured.
              </dd>
            </div>
          </dl>
          <nav aria-label="Available settings">
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">
                <Settings aria-hidden />
                Open general settings
              </Link>
            </Button>
          </nav>
        </div>
      </SettingsCard>
    </div>
  );
}
