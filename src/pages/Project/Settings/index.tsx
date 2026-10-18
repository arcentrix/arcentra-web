import { repositoryAddress } from "@/lib/repository-address";
import { useEffect, useState } from "react";
import { getProjectSettings } from "@/api/project/settings";
import { ProjectSettingsEditor } from "@/components/organization/project-settings-editor";
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
  const settings = useApiResource(
    authenticated && projectId ? `project-edit-settings:${projectId}` : null,
    (signal) => getProjectSettings(projectId!, signal),
  );
  const [mode, setMode] = useState<"edit" | "archive" | "restore" | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const refresh = () => {
    setMode(null);
    project.refresh();
    settings.refresh();
  };
  const liveSettings =
    !settings.loading &&
    !settings.error &&
    settings.data?.projectId === projectId
      ? settings.data
      : undefined;
  const settingsDenied =
    isApiError(settings.error) &&
    [settings.error.status, settings.error.code].some(
      (code) => code === 401 || code === 403,
    );
  const accessDenied =
    isApiError(project.error) &&
    [project.error.status, project.error.code].some(
      (code) => code === 401 || code === 403,
    );
  useEffect(() => {
    if (settingsDenied || accessDenied)
      window.dispatchEvent(
        new CustomEvent("arcentra:project-read-denied", { detail: projectId }),
      );
  }, [settingsDenied, accessDenied, projectId]);
  // The shared hook retains the last snapshot after a failed refresh. Do not
  // render it while revalidating, after an error, or for another route identity.
  const snapshot =
    !project.loading &&
    !project.error &&
    !settingsDenied &&
    project.data?.projectId === projectId
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
            Review project details, edit supported metadata, or archive and
            restore this project when your current permissions allow it.
          </p>
        </div>
        {authenticated && projectId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={project.loading || settings.loading || !!mode}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh settings
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {failure && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {failure}
        </p>
      )}
      {!authenticated ? (
        <p role="status" className="mt-6 text-sm text-fg-muted">
          Sign in to view project settings.
        </p>
      ) : !projectId ? (
        <p role="alert" className="mt-6 text-sm text-fg-muted">
          Select a project to view its settings.
        </p>
      ) : project.error || settingsDenied ? (
        <InlineErrorState
          title={
            accessDenied || settingsDenied
              ? "Project settings access restricted"
              : "Project settings unavailable"
          }
          description={
            accessDenied || settingsDenied
              ? "Your current session cannot read this project's settings. Previously loaded details are hidden."
              : "The project details could not be loaded. Refresh to try again."
          }
          onRetry={refresh}
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
            <DetailRow
              label="Display name"
              value={liveSettings?.displayName ?? snapshot.displayName}
            />
            <DetailRow
              label="Description"
              value={liveSettings?.description ?? snapshot.description}
            />
            <DetailRow
              label="Linked repository"
              value={repositoryAddress(snapshot.repoUrl)}
              mono
            />
            <DetailRow
              label="Default branch"
              value={liveSettings?.defaultBranch ?? snapshot.defaultBranch}
              mono
            />
          </dl>
          {settings.error && !settingsDenied ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Editable settings are unavailable. Refresh to check the latest
              metadata and permissions.
            </p>
          ) : liveSettings ? (
            <div className="mt-5 space-y-4 border-t pt-5">
              <dl className="space-y-2 text-sm" aria-label="Project metadata">
                <DetailRow label="Tags" value={liveSettings.tags} />
                <DetailRow label="Language" value={liveSettings.language} />
                <DetailRow label="Framework" value={liveSettings.framework} />
                <DetailRow
                  label="Visibility metadata"
                  value={
                    ["Private", "Internal", "Public"][liveSettings.visibility]
                  }
                />
              </dl>
              <p className="text-xs text-fg-muted">
                Visibility metadata does not change access grants.
              </p>
              <div className="flex flex-wrap gap-2">
                {liveSettings.canUpdate && (
                  <Button size="sm" onClick={() => setMode("edit")}>
                    Edit settings
                  </Button>
                )}
                {liveSettings.canArchive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode("archive")}
                  >
                    Archive project
                  </Button>
                )}
                {liveSettings.canRestore && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode("restore")}
                  >
                    Restore project
                  </Button>
                )}
              </div>
              {!liveSettings.canUpdate &&
                !liveSettings.canArchive &&
                !liveSettings.canRestore && (
                  <p className="text-sm text-fg-muted">
                    No changes are available with your current permissions and
                    this project's status.
                  </p>
                )}
            </div>
          ) : (
            <p role="status" className="mt-4 text-sm">
              Checking editable settings…
            </p>
          )}
          {mode && liveSettings && (
            <ProjectSettingsEditor
              settings={liveSettings}
              mode={mode}
              onClose={() => setMode(null)}
              onReload={refresh}
              onSaved={() => {
                setNotice("Project settings saved.");
                setFailure("");
                refresh();
                window.dispatchEvent(
                  new CustomEvent("arcentra:project-updated", {
                    detail: projectId,
                  }),
                );
              }}
              onDenied={(message) => {
                setFailure(message);
                setNotice("");
                refresh();
              }}
            />
          )}
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
