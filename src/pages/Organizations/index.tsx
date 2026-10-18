import { scopedReadError } from "@/components/organization/mutation-error";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowUpRight } from "lucide-react";
import { getOrganizations } from "@/api/organization";
import { useApiResource } from "@/hooks/use-api-resource";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrgSettingsDialog } from "@/components/org-settings-dialog";
import { SnapshotError } from "@/components/observe/shared";
import { Pagination } from "@/components/build/pipeline-workspace";
import authStore from "@/store/auth";
import userStore from "@/store/user";

export default function Organizations() {
  const auth = authStore.useState();
  const user = userStore.useState();
  if (!auth.initialized)
    return (
      <p role="status" className="p-6">
        Sign in to view organizations.
      </p>
    );
  return (
    <OrganizationDirectory
      key={JSON.stringify([auth.accessToken, user.userinfo?.userId])}
    />
  );
}
function OrganizationDirectory() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const organizations = useApiResource(
    `organizations:${page}:${search}`,
    (signal) => getOrganizations({ name: search, page }, signal),
  );
  const snapshot =
    !organizations.loading && !organizations.error
      ? organizations.data
      : undefined;
  const reload = () => {
    setCreate(false);
    organizations.refresh();
  };
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="workspace / organizations"
        title="Organizations"
        sub="Real organizations you can access. Membership is shown only when explicitly recorded."
        action={
          snapshot?.canCreate ? (
            <Button size="sm" onClick={() => setCreate(true)}>
              Create organization
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search organizations"
          placeholder="Search organizations…"
          className="max-w-sm"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={organizations.loading}
          onClick={reload}
        >
          Refresh organizations
        </Button>
      </div>
      <p className="text-sm text-fg-muted">
        Legacy scope IDs are not organization records and do not establish
        membership.{" "}
        <Link className="underline" to="/projects">
          View projects
        </Link>
      </p>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {organizations.error ? (
        <Panel>
          <SnapshotError
            subject="Organizations"
            permission="organization access"
            error={scopedReadError(organizations.error)}
            retry={reload}
            loading={organizations.loading}
          />
        </Panel>
      ) : organizations.loading ? (
        <p role="status">Loading organizations…</p>
      ) : snapshot ? (
        <>
          <p className="text-sm text-fg-muted">
            {snapshot.total} organizations
          </p>
          {snapshot.list.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.list.map((org) => (
                <Link
                  to={`/organizations/${encodeURIComponent(org.orgId)}`}
                  key={org.orgId}
                  className="min-w-0 space-y-3 rounded-lg border p-5 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="size-5 shrink-0 text-fg-muted" />
                    <h2 className="min-w-0 flex-1 truncate font-semibold">
                      {org.displayName || org.name}
                    </h2>
                    <ArrowUpRight className="size-4 shrink-0" />
                  </div>
                  <p className="break-words text-sm text-fg-muted">
                    {org.description || "No description added."}
                  </p>
                  <p className="break-all font-mono text-xs text-fg-muted">
                    {org.orgId}
                  </p>
                  <p className="text-xs">
                    {org.isMember
                      ? "Explicit member"
                      : "Accessible through permissions"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Panel className="p-8 text-sm">
              {search
                ? "No matching organizations."
                : "No accessible organization records. A legacy scope grant alone does not create an organization."}
            </Panel>
          )}
          {snapshot.total > 20 && (
            <Pagination
              page={page}
              total={snapshot.total}
              pageSize={20}
              onPage={setPage}
              loading={organizations.loading}
            />
          )}
        </>
      ) : null}
      {create && (
        <OrgSettingsDialog
          onClose={() => setCreate(false)}
          onReload={reload}
          onDenied={(message) => {
            setFailure(message);
            reload();
          }}
          onSaved={(org) => {
            setCreate(false);
            navigate(`/organizations/${encodeURIComponent(org.orgId)}`);
          }}
        />
      )}
    </section>
  );
}
