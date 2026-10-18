import { useRef, useState, type FormEvent } from "react";
import {
  archiveProject,
  restoreProject,
  updateProjectSettings,
  type ProjectSettings,
  type ProjectSettingsDraft,
} from "@/api/project/settings";
import { isApiError } from "@/lib/api-error";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mutationError } from "./mutation-error";

export function ProjectSettingsEditor({
  settings,
  mode,
  onClose,
  onSaved,
  onReload,
  onDenied,
}: {
  settings: ProjectSettings;
  mode: "edit" | "archive" | "restore";
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
  onDenied: (message: string) => void;
}) {
  const [draft, setDraft] = useState<ProjectSettingsDraft>({
    displayName: settings.displayName,
    description: settings.description,
    defaultBranch: settings.defaultBranch,
    tags: settings.tags,
    language: settings.language,
    framework: settings.framework,
    visibility: settings.visibility,
  });
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useMountedRef();
  const set = (field: keyof ProjectSettingsDraft, value: string | number) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      pending.current ||
      error ||
      (mode !== "edit" && confirm !== settings.name)
    )
      return;
    pending.current = true;
    setSaving(true);
    try {
      if (mode === "edit")
        await updateProjectSettings(settings.projectId, {
          ...draft,
          displayName: draft.displayName.trim(),
          defaultBranch: draft.defaultBranch.trim(),
          version: settings.version,
        });
      else if (mode === "archive")
        await archiveProject(settings.projectId, settings.version);
      else await restoreProject(settings.projectId, settings.version);
      if (mounted.current) onSaved();
    } catch (error) {
      if (mounted.current) {
        const message = mutationError(error);
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
  const title =
    mode === "edit"
      ? "Edit project settings"
      : mode === "archive"
        ? "Archive project"
        : "Restore project";
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
            {mode === "edit"
              ? "Update project metadata and the default branch. Repository address, credentials, and organization targeting are not editable here."
              : mode === "archive"
                ? "Archiving stops new work from being admitted. It does not cancel or roll back work already executing. The project can be restored later."
                : "Restore this archived project to active status. This does not enable a separately disabled project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={saving || !!error} className="space-y-4">
            {mode === "edit" ? (
              <>
                <label className="block space-y-1 text-sm">
                  <span>Display name</span>
                  <Input
                    required
                    maxLength={128}
                    value={draft.displayName}
                    onChange={(event) => set("displayName", event.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Description</span>
                  <Textarea
                    maxLength={4096}
                    value={draft.description}
                    onChange={(event) => set("description", event.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Default branch</span>
                  <Input
                    required
                    maxLength={255}
                    value={draft.defaultBranch}
                    onChange={(event) =>
                      set("defaultBranch", event.target.value)
                    }
                  />
                </label>
                <p className="text-xs text-fg-muted">
                  Changing the default branch affects future work that uses this
                  project's default.
                </p>
                <label className="block space-y-1 text-sm">
                  <span>Tags (comma-separated)</span>
                  <Input
                    maxLength={1024}
                    value={draft.tags}
                    onChange={(event) => set("tags", event.target.value)}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span>Language</span>
                    <Input
                      maxLength={128}
                      value={draft.language}
                      onChange={(event) => set("language", event.target.value)}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span>Framework</span>
                    <Input
                      maxLength={128}
                      value={draft.framework}
                      onChange={(event) => set("framework", event.target.value)}
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span>Visibility metadata</span>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3"
                    value={draft.visibility}
                    onChange={(event) =>
                      set("visibility", Number(event.target.value))
                    }
                  >
                    <option value={0}>Private</option>
                    <option value={1}>Internal</option>
                    <option value={2}>Public</option>
                  </select>
                </label>
                <p className="text-xs text-fg-muted">
                  Visibility is descriptive metadata. It does not add or remove
                  access grants.
                </p>
              </>
            ) : (
              <label className="block space-y-1 text-sm">
                <span>Type {settings.name} to confirm</span>
                <Input
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            )}
          </fieldset>
          {error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <p className="text-xs text-fg-muted">
                Your draft is preserved above. Reloading discards it and fetches
                the latest saved values.
              </p>
              <Button type="button" variant="outline" onClick={onReload}>
                Reload latest settings
              </Button>
            </div>
          )}
          {saving && (
            <p role="status" className="text-sm">
              Saving project settings…
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
              variant={mode === "archive" ? "destructive" : "default"}
              disabled={
                saving ||
                !!error ||
                (mode !== "edit" && confirm !== settings.name) ||
                (mode === "edit" &&
                  (!draft.displayName.trim() || !draft.defaultBranch.trim()))
              }
            >
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : mode === "archive"
                    ? "Confirm archive"
                    : "Confirm restore"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
