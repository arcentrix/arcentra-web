import { isApiError } from "@/lib/api-error";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteOrganization,
  getOrganization,
  type Organization,
} from "@/api/organization";
import { useApiResource } from "@/hooks/use-api-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { Panel } from "@/components/blueprint";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SnapshotError } from "@/components/observe/shared";
import { OrgSettingsDialog } from "@/components/org-settings-dialog";
import { MemberManager } from "@/components/organization/member-manager";
import {
  mutationError,
  scopedReadError,
} from "@/components/organization/mutation-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import authStore from "@/store/auth";
import userStore from "@/store/user";

export default function OrganizationDetail() {
  const { orgId } = useParams();
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized || !orgId)
    return (
      <p role="status" className="p-6">
        Sign in and select an organization.
      </p>
    );
  return (
    <OrganizationSnapshot
      key={JSON.stringify([auth.accessToken, user.userinfo?.userId, orgId])}
      orgId={orgId}
    />
  );
}
function OrganizationSnapshot({ orgId }: { orgId: string }) {
  const [failure, setFailure] = useState("");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [notice, setNotice] = useState("");
  const org = useApiResource(`organization:${orgId}`, (signal) =>
    getOrganization(orgId, signal),
  );
  const snapshot = !org.loading && !org.error ? org.data : undefined;
  const reload = () => {
    setEditing(false);
    setArchiving(false);
    org.refresh();
  };
  const navigate = useNavigate();
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <nav>
        <Button asChild size="sm" variant="ghost">
          <Link to="/organizations">Back to organizations</Link>
        </Button>
      </nav>
      <PageHeader
        eyebrow="organization / settings"
        title={snapshot?.displayName || snapshot?.name || "Organization"}
        sub="Organization metadata and explicit memberships."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={org.loading}
            onClick={reload}
          >
            Refresh organization
          </Button>
        }
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {org.error ? (
        <Panel>
          <SnapshotError
            subject="Organization"
            permission="organization access"
            error={scopedReadError(org.error)}
            retry={reload}
            loading={org.loading}
          />
        </Panel>
      ) : org.loading ? (
        <p role="status">Loading organization…</p>
      ) : snapshot ? (
        <>
          <Panel className="space-y-5 p-5">
            <dl className="space-y-3 text-sm">
              {[
                ["Organization ID", snapshot.orgId],
                ["Name", snapshot.name],
                ["Description", snapshot.description || "Not provided"],
                ["Website", snapshot.website || "Not provided"],
                ["Contact email", snapshot.email || "Not provided"],
                [
                  "Membership",
                  snapshot.isMember
                    ? "Explicit member"
                    : "Accessible through permissions",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid min-w-0 gap-1 sm:grid-cols-[160px_1fr]"
                >
                  <dt className="font-medium">{label}</dt>
                  <dd className="min-w-0 break-words text-fg-muted">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {snapshot.canUpdate && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  Edit organization
                </Button>
              )}
              {snapshot.canArchive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArchiving(true)}
                >
                  Archive organization
                </Button>
              )}
            </div>
          </Panel>
          {snapshot.canManageMembers ? (
            <MemberManager scope="org" scopeId={orgId} />
          ) : (
            <Panel className="p-5 text-sm text-fg-muted">
              Member management requires org:manage_member for this
              organization.
            </Panel>
          )}
          {editing && (
            <OrgSettingsDialog
              organization={snapshot}
              onClose={() => setEditing(false)}
              onReload={reload}
              onDenied={(message) => {
                setFailure(message);
                reload();
              }}
              onSaved={() => {
                setNotice("Organization saved.");
                reload();
              }}
            />
          )}
          {archiving && (
            <ArchiveOrganization
              organization={snapshot}
              onClose={() => setArchiving(false)}
              onReload={reload}
              onDenied={(message) => {
                setFailure(message);
                reload();
              }}
              onSaved={() => navigate("/organizations")}
            />
          )}
        </>
      ) : null}
    </section>
  );
}
function ArchiveOrganization({
  organization,
  onClose,
  onReload,
  onSaved,
  onDenied,
}: {
  organization: Organization;
  onClose: () => void;
  onReload: () => void;
  onSaved: () => void;
  onDenied: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useMountedRef();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || name !== organization.name || error) return;
    pending.current = true;
    setSaving(true);
    try {
      await deleteOrganization(organization.orgId, organization.version);
      if (mounted.current) onSaved();
    } catch (error) {
      if (mounted.current) {
        const message =
          isApiError(error) && [error.status, error.code].includes(409)
            ? "Archive active projects first. If projects are already archived, refresh and review the latest organization version before trying again."
            : mutationError(error);
        if (
          isApiError(error) &&
          [error.status, error.code].some(
            (code) => code === 401 || code === 403,
          )
        )
          onDenied(message);
        else setError(message);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive organization</DialogTitle>
          <DialogDescription>
            This removes the organization from the active directory. Archive
            active projects first. Historical project records remain.
            Organization restoration is not available in this view.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1 text-sm">
            <span>Type {organization.name} to confirm</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving || !!error}
            />
          </label>
          {error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button type="button" variant="outline" onClick={onReload}>
                Reload saved organization
              </Button>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={saving || name !== organization.name || !!error}
            >
              {saving ? "Archiving…" : "Confirm archive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
