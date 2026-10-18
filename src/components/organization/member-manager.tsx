import { useId, useRef, useState, type FormEvent } from "react";
import { Apis } from "@/api";
import {
  addScopedMember,
  listScopedMembers,
  removeScopedMember,
  roleLabel,
  updateScopedMember,
  type MemberScope,
  type ScopedMember,
} from "@/api/membership";
import { useApiResource } from "@/hooks/use-api-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { Panel, PanelHeader } from "@/components/blueprint";
import { SnapshotError } from "@/components/observe/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mutationError, scopedReadError } from "./mutation-error";

export function MemberManager({
  scope,
  scopeId,
}: {
  scope: MemberScope;
  scopeId: string;
}) {
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<{
    kind: "add" | "edit" | "remove";
    member?: ScopedMember;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const refresh = () => {
    setEdit(null);
    setRevision((value) => value + 1);
  };
  const permission = useApiResource(
    `members:permission:${scope}:${scopeId}:${revision}`,
    (signal) =>
      Apis.me.getEffectiveActions({ scopeType: scope, scopeId }, signal),
  );
  const action = `${scope === "org" ? "org" : "project"}:manage_member`;
  const allowed =
    !permission.loading &&
    !permission.error &&
    Array.isArray(permission.data) &&
    (permission.data.includes(action) || permission.data.includes("*:*"));
  const members = useApiResource(
    allowed ? `members:list:${scope}:${scopeId}:${revision}` : null,
    (signal) => listScopedMembers(scope, scopeId, signal),
  );
  const snapshot =
    !members.loading && !members.error && allowed ? members.data : undefined;
  return (
    <Panel>
      <PanelHeader
        title="Members"
        sub={`Explicit ${scope === "org" ? "organization" : "project"} memberships and managed roles`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={permission.loading || !!edit}
              onClick={() => {
                setFailure("");
                setNotice("");
                refresh();
              }}
            >
              Refresh members
            </Button>
            {snapshot?.canManageMembers &&
              snapshot.assignableRoleIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setFailure("");
                    setNotice("");
                    setEdit({ kind: "add" });
                  }}
                >
                  Add member
                </Button>
              )}
          </div>
        }
      />
      <p className="border-b px-5 py-4 text-sm text-fg-muted">
        Managed roles apply only to this{" "}
        {scope === "org" ? "organization" : "project"}. Other direct, team, or
        inherited grants may still provide access after a membership is removed.
      </p>
      {notice && (
        <p role="status" className="px-5 py-3 text-sm">
          {notice}
        </p>
      )}
      {failure && (
        <p role="alert" className="px-5 py-3 text-sm text-destructive">
          {failure}
        </p>
      )}
      {permission.error ? (
        <SnapshotError
          subject="Member access check"
          permission={`${action} for this scope`}
          error={scopedReadError(permission.error)}
          retry={refresh}
          loading={permission.loading}
        />
      ) : permission.loading ? (
        <p role="status" className="p-5 text-sm">
          Checking {scope === "org" ? "organization" : "project"} member access…
        </p>
      ) : !allowed ? (
        <div className="space-y-3 p-5 text-sm">
          <h3>Members access restricted</h3>
          <p>Member access requires {action} for this scope.</p>
          <Button size="sm" variant="outline" onClick={refresh}>
            Check member access again
          </Button>
        </div>
      ) : members.error ? (
        <SnapshotError
          subject="Members"
          permission={`${action} for this scope`}
          error={scopedReadError(members.error)}
          retry={refresh}
          loading={members.loading}
        />
      ) : members.loading ? (
        <p role="status" className="p-5 text-sm">
          Loading members…
        </p>
      ) : snapshot ? (
        <div className="space-y-3 p-5">
          <p className="text-sm text-fg-muted">
            {snapshot.total} recorded memberships
          </p>
          {!snapshot.list.length ? (
            <p className="text-sm text-fg-muted">
              No memberships are recorded for this scope. Other grants may still
              provide access.
            </p>
          ) : (
            <ul
              aria-label={
                scope === "org" ? "Organization members" : "Project members"
              }
              className="divide-y rounded-md border"
            >
              {snapshot.list.map((member) => (
                <li
                  key={member.userId}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-medium">
                      {member.displayName || member.username || "Member"}
                    </p>
                    <p className="break-all font-mono text-xs text-fg-muted">
                      {member.userId}
                    </p>
                    <p className="text-sm">{roleLabel(member.roleId)}</p>
                    {member.isProtectedOwner && (
                      <p className="text-xs text-fg-muted">Protected owner</p>
                    )}
                    {member.hasOtherAccess && (
                      <p className="text-xs text-fg-muted">
                        Other direct or inherited grants may remain
                      </p>
                    )}
                  </div>
                  {snapshot.canManageMembers &&
                    !member.isProtectedOwner &&
                    (!member.roleId.endsWith("_owner") ||
                      snapshot.canAssignOwner) && (
                      <div className="flex flex-wrap gap-2">
                        {snapshot.assignableRoleIds.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Edit role for ${member.userId}`}
                            onClick={() => setEdit({ kind: "edit", member })}
                          >
                            Edit role
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Remove ${member.userId}`}
                          onClick={() => setEdit({ kind: "remove", member })}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {edit && snapshot && (
        <MemberDialog
          scope={scope}
          scopeId={scopeId}
          kind={edit.kind}
          member={edit.member}
          assignableRoleIds={snapshot.assignableRoleIds}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setNotice(
              edit.kind === "remove"
                ? "Membership removed. Other grants may still provide access."
                : "Membership saved.",
            );
            refresh();
          }}
          onFailed={(error) => {
            setFailure(mutationError(error));
            refresh();
          }}
        />
      )}
    </Panel>
  );
}

function MemberDialog({
  scope,
  scopeId,
  kind,
  member,
  assignableRoleIds,
  onClose,
  onSaved,
  onFailed,
}: {
  scope: MemberScope;
  scopeId: string;
  kind: "add" | "edit" | "remove";
  member?: ScopedMember;
  assignableRoleIds: string[];
  onClose: () => void;
  onSaved: () => void;
  onFailed: (error: unknown) => void;
}) {
  const roleControlId = useId();
  const [userId, setUserId] = useState(member?.userId ?? "");
  const [role, setRole] = useState(
    member?.roleId ||
      assignableRoleIds.find(
        (role) => role === (scope === "org" ? "org_member" : "project_guest"),
      ) ||
      assignableRoleIds[0] ||
      "",
  );
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useMountedRef();
  const roles = assignableRoleIds;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || (kind !== "remove" && !roles.includes(role))) return;
    pending.current = true;
    setSaving(true);
    try {
      if (kind === "add")
        await addScopedMember(scope, scopeId, {
          userId: userId.trim(),
          roleId: role,
        });
      else if (kind === "edit")
        await updateScopedMember(scope, scopeId, member!.userId, {
          roleId: role,
          version: member!.version,
        });
      else
        await removeScopedMember(
          scope,
          scopeId,
          member!.userId,
          member!.version,
        );
      if (mounted.current) onSaved();
    } catch (error) {
      if (mounted.current) onFailed(error);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const title =
    kind === "remove"
      ? "Remove membership"
      : kind === "edit"
        ? "Edit member role"
        : "Add member";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "remove"
              ? "Remove this explicit membership and its managed role. Separate grants can continue to provide access."
              : "Use an existing user ID. This does not send an invitation or create a user account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="break-all text-xs text-fg-muted">Scope: {scopeId}</p>
          {kind === "add" ? (
            <label className="block space-y-1 text-sm">
              <span>User ID</span>
              <Input
                required
                maxLength={64}
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={saving}
              />
            </label>
          ) : (
            <p className="break-all text-sm">
              User: {member?.displayName || member?.username || member?.userId}{" "}
              ({member?.userId})
            </p>
          )}
          {kind !== "remove" && (
            <div className="space-y-1 text-sm">
              <label htmlFor={roleControlId} className="block">
                Role
              </label>
              <select
                id={roleControlId}
                className="h-9 w-full rounded-md border bg-background px-3"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={saving}
                required
              >
                {!roles.includes(role) && (
                  <option value={role} disabled>
                    {roleLabel(role)} (restricted)
                  </option>
                )}
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-fg-muted">
            The server checks current access, protected owners, and the latest
            membership version.
          </p>
          {saving && (
            <p role="status" className="text-sm">
              Saving membership…
            </p>
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
              variant={kind === "remove" ? "destructive" : "default"}
              disabled={
                saving ||
                (kind === "add" && (!userId.trim() || !roles.includes(role))) ||
                (kind === "edit" &&
                  (!roles.includes(role) || role === member?.roleId))
              }
            >
              {saving
                ? "Saving…"
                : kind === "remove"
                  ? "Remove membership"
                  : "Save membership"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
