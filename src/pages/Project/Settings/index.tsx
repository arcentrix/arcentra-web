import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getProject } from "@/api/project";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { Button } from "@/components/ui/button";
import { InlineErrorState } from "@/components/inline-error-state";
import { Panel, SectionEyebrow } from "@/components/blueprint";

function textValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Not provided";
}

/** Display only a repository address, never an actionable or credentialed URL. */
function repositoryAddress(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Not provided";
  const address = value.trim();
  // Git also accepts SCP-style addresses such as git@host:owner/repo.git.
  const scp = /^[^\s@/:]+@([\w.-]+):([^\s?#]+)(?:[?#].*)?$/.exec(address);
  if (scp) return `${scp[1]}:${scp[2]}`;
  try {
    const url = new URL(address);
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol))
      return "Unsupported repository address";
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "Unsupported repository address";
  }
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-2 border-b py-3 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-[13px] font-medium">{label}</dt>
      <dd
        className={`min-w-0 break-words text-[13px] text-fg-muted ${mono ? "font-mono" : ""}`}
      >
        {textValue(value)}
      </dd>
    </div>
  );
}

export default function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const auth = authStore.useState();
  const user = userStore.useState();
  // Rebuild the snapshot on every account, sign-in, or route identity change.
  // Unmounting also aborts reads and prevents late responses restoring old data.
  return (
    <ProjectSettingsSnapshot
      key={JSON.stringify([
        auth.initialized,
        auth.accessToken,
        user.userinfo?.userId,
        projectId,
      ])}
      projectId={projectId}
      authenticated={auth.initialized}
    />
  );
}

function ProjectSettingsSnapshot({
  projectId,
  authenticated,
}: {
  projectId?: string;
  authenticated: boolean;
}) {
  const project = useApiResource(
    authenticated && projectId ? `project-settings:${projectId}` : null,
    (signal) => getProject(projectId!, signal),
  );
  const accessDenied =
    isApiError(project.error) &&
    [project.error.status, project.error.code].some(
      (code) => code === 401 || code === 403,
    );
  // The shared hook retains the last snapshot after a failed refresh. Do not
  // render it while revalidating, after an error, or for another route identity.
  const snapshot =
    !project.loading && !project.error && project.data?.projectId === projectId
      ? project.data
      : undefined;

  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionEyebrow className="mb-2">project / settings</SectionEyebrow>
          <h2 className="display text-[18px] font-semibold leading-tight tracking-[-0.02em]">
            Project settings
          </h2>
          <p className="mt-2 text-[13px] text-fg-muted">
            Read-only project details. Editing, archiving, and deleting projects
            are not connected in this view.
          </p>
        </div>
        {authenticated && projectId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={project.refresh}
            disabled={project.loading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh settings
          </Button>
        )}
      </div>

      {!authenticated ? (
        <p role="status" className="mt-6 text-sm text-fg-muted">
          Sign in to view project settings.
        </p>
      ) : !projectId ? (
        <p role="alert" className="mt-6 text-sm text-fg-muted">
          Select a project to view its settings.
        </p>
      ) : project.error ? (
        <InlineErrorState
          title={
            accessDenied
              ? "Project settings access restricted"
              : "Project settings unavailable"
          }
          description={
            accessDenied
              ? "Your current session cannot read this project's settings. Previously loaded details are hidden."
              : "The project details could not be loaded. Refresh to try again."
          }
          onRetry={project.refresh}
        />
      ) : project.loading ? (
        <p role="status" className="mt-6 text-sm text-fg-muted">
          Loading project settings…
        </p>
      ) : snapshot ? (
        <>
          <dl aria-label="Project details" className="mt-5">
            <DetailRow label="Project ID" value={snapshot.projectId} mono />
            <DetailRow label="Scope ID" value={snapshot.orgId} mono />
            <DetailRow label="Project name" value={snapshot.name} mono />
            <DetailRow label="Display name" value={snapshot.displayName} />
            <DetailRow label="Description" value={snapshot.description} />
            <DetailRow
              label="Linked repository"
              value={repositoryAddress(snapshot.repoUrl)}
              mono
            />
            <DetailRow
              label="Default branch"
              value={snapshot.defaultBranch}
              mono
            />
          </dl>
          <p className="mt-3 text-xs text-fg-muted">
            Repository addresses omit credentials, query parameters, and
            fragments.
          </p>
        </>
      ) : (
        <p role="alert" className="mt-6 text-sm text-fg-muted">
          No settings snapshot was returned for this project. Refresh to try
          again.
        </p>
      )}
    </Panel>
  );
}
