import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Apis } from "@/api";
import { listProjectMembers } from "@/api/project";
import {
  ColumnHead,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/blueprint";
import { SnapshotError } from "@/components/observe/shared";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import authStore from "@/store/auth";
import userStore from "@/store/user";

export default function Members() {
  const { projectId } = useParams<{ projectId: string }>();
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized || !projectId) {
    return (
      <Panel>
        <PanelHeader title="Members" />
        <p className="p-5 text-sm text-fg-muted">
          {!auth.initialized
            ? "Sign in to view project member associations."
            : "Choose a project to view member associations."}
        </p>
      </Panel>
    );
  }
  // A different account or project discards prior permissions, rows, and requests.
  return (
    <MemberAssociations
      key={JSON.stringify([auth.accessToken, user.userinfo?.userId, projectId])}
      projectId={projectId}
    />
  );
}

function MemberAssociations({ projectId }: { projectId: string }) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const permission = useApiResource(
    `members:permission:${JSON.stringify([projectId, revision])}`,
    (signal) =>
      Apis.me.getEffectiveActions(
        { scopeType: "project", scopeId: projectId },
        signal,
      ),
  );
  const allowed =
    !permission.loading &&
    !permission.error &&
    Array.isArray(permission.data) &&
    (permission.data.includes("project:manage_member") ||
      permission.data.includes("*:*"));
  const members = useApiResource(
    allowed ? `members:list:${JSON.stringify([projectId, revision])}` : null,
    (signal) => listProjectMembers(projectId, signal),
  );
  const snapshot = members.loading || members.error ? undefined : members.data;

  return (
    <Panel>
      <PanelHeader
        title="Members"
        sub="Recorded project member associations"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="muted">Read only</StatusBadge>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw aria-hidden className="size-3.5" />
              Refresh members
            </Button>
          </div>
        }
      />
      <div className="space-y-2 border-b px-5 py-4 text-sm text-fg-muted">
        <p>
          These stored associations do not establish a user's current roles or
          effective permissions. Names, email addresses, and role grants are not
          returned by this endpoint.
        </p>
        <p>
          Adding, editing, and removing members are unavailable from this page.
        </p>
      </div>
      {permission.error ? (
        <SnapshotError
          subject="Member access check"
          permission="project:manage_member for this project"
          error={permission.error}
          retry={refresh}
          loading={permission.loading}
        />
      ) : permission.loading ? (
        <p role="status" className="p-5 text-sm text-fg-muted">
          Checking project member access…
        </p>
      ) : !allowed ? (
        <div className="space-y-3 p-5 text-sm text-fg-muted">
          <h3 className="font-medium text-foreground">
            Members access restricted
          </h3>
          <p>
            Member access requires project:manage_member for this project.
            Project read access alone does not include member management.
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Check member access again
          </Button>
        </div>
      ) : members.error ? (
        <SnapshotError
          subject="Member associations"
          permission="project:manage_member for this project"
          error={members.error}
          retry={refresh}
          loading={members.loading}
        />
      ) : members.loading ? (
        <p role="status" className="p-5 text-sm text-fg-muted">
          Loading member associations…
        </p>
      ) : snapshot ? (
        <>
          <p className="px-5 py-4 text-sm text-fg-muted">
            {snapshot.total} recorded associations
          </p>
          {snapshot.list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-fg-muted">
              No member associations are recorded for this project. Access may
              still be granted through role grants.
            </p>
          ) : (
            <Table aria-label="Project member associations">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <ColumnHead>User ID</ColumnHead>
                  </TableHead>
                  <TableHead>
                    <ColumnHead>Project ID</ColumnHead>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.list.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell className="break-all font-mono text-xs">
                      {member.userId}
                    </TableCell>
                    <TableCell className="break-all font-mono text-xs">
                      {member.projectId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}
      <nav aria-label="Project navigation" className="border-t p-5">
        <Button asChild size="sm" variant="outline">
          <Link to={`/projects/${encodeURIComponent(projectId)}`}>
            Back to project
          </Link>
        </Button>
      </nav>
    </Panel>
  );
}
