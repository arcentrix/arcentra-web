import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Plus, RefreshCw } from "lucide-react";
import me from "@/api/me";
import {
  createStorageConfiguration,
  editableProvider,
  listStorageConfigurations,
  setDefaultStorageConfiguration,
  updateStorageConfiguration,
  type StorageConfiguration,
} from "@/api/storage";
import { ApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import { Panel, StatusBadge } from "@/components/blueprint";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runtimeNote, StorageEditor } from "./storage-editor";

function failure(error: unknown, writing = false) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return "Storage access restricted. Your current platform permissions do not allow this request. Refresh after access is restored.";
    if (writing && error.status === 400)
      return "The storage configuration was rejected. Refresh and check the required fields before trying again.";
    if (writing && error.status === 409)
      return "Storage configuration changed or this ID is already in use. Refresh and review the saved records before trying again.";
  }
  return writing
    ? "No successful change is confirmed. The request may have reached the server. Refresh the saved configurations before trying again."
    : "Storage configurations could not be loaded. Refresh to try again.";
}

export default function StoragePage({
  headless = false,
}: {
  headless?: boolean;
}) {
  const auth = authStore.useState();
  // A new session destroys drafts and ignores responses belonging to the old session.
  if (!auth.initialized)
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to view storage settings.
      </p>
    );
  return <StorageWorkspace key={auth.accessToken} headless={headless} />;
}
function StorageWorkspace({ headless }: { headless: boolean }) {
  const [rows, setRows] = useState<StorageConfiguration[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editor, setEditor] = useState<"new" | StorageConfiguration>();
  const [defaultTarget, setDefaultTarget] = useState<StorageConfiguration>();
  const alive = useRef(false);
  const generation = useRef(0);
  const reading = useRef<AbortController | undefined>(undefined);
  const writing = useRef(false);

  const load = useCallback(async () => {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    const request = ++generation.current;
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    setRows([]);
    setCanWrite(false);
    setEditor(undefined);
    setDefaultTarget(undefined);
    const current = () => alive.current && generation.current === request;
    try {
      const actions = await me.getEffectiveActions(
        { scopeType: "platform" },
        controller.signal,
      );
      if (!current()) return false;
      const has = (action: string) =>
        Array.isArray(actions) &&
        (actions.includes(action) || actions.includes("*:*"));
      if (!has("org:update")) {
        setError(
          "Storage access restricted. Platform org:update permission is required to view saved configurations.",
        );
        return false;
      }
      const next = await listStorageConfigurations(controller.signal);
      if (!current()) return false;
      setRows(next);
      setCanWrite(has("secret:write"));
      return true;
    } catch (cause) {
      if (current()) setError(failure(cause));
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      reading.current?.abort();
    };
  }, [load]);

  const mutate = async (operation: () => Promise<void>, success: string) => {
    if (writing.current || !canWrite || loading || error) return;
    writing.current = true;
    setBusy(true);
    setNotice(undefined);
    const request = generation.current;
    try {
      await operation();
      if (!alive.current || request !== generation.current) return;
      setEditor(undefined);
      setDefaultTarget(undefined);
      if (await load()) setNotice(success);
    } catch (cause) {
      if (!alive.current || request !== generation.current) return;
      setEditor(undefined);
      setDefaultTarget(undefined);
      setRows([]);
      setCanWrite(false);
      setError(failure(cause, true));
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <section
      className={
        headless ? "min-w-0 space-y-4" : "flex-1 min-w-0 space-y-6 p-4 md:p-8"
      }
    >
      {!headless && (
        <PageHeader
          eyebrow="workspace / configuration"
          title="Artifact storage"
          sub="Saved object-storage configuration."
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {headless && (
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Database className="size-5" aria-hidden />
              Artifact storage
            </h2>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Enabled configurations for build artifacts. Credentials are
            write-only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load();
            }}
            disabled={busy || loading}
            aria-label="Refresh storage configurations"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
          {canWrite && !error && !loading && (
            <Button size="sm" onClick={() => setEditor("new")} disabled={busy}>
              <Plus className="size-4" />
              New storage
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>{runtimeNote}</p>
        <a
          href="https://github.com/arcentrix/arcentra/blob/main/docs/operations/storage-configuration.md"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block underline underline-offset-4"
        >
          Storage setup and runtime reload guide
        </a>
      </div>
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading storage configurations…
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && (
        <>
          {!canWrite && (
            <p className="text-sm text-muted-foreground">
              Read-only access. Platform secret:write permission is also
              required to create, edit or choose default storage.
            </p>
          )}
          {rows.length === 0 ? (
            <Panel>
              <div className="space-y-2 p-6">
                <h3 className="font-medium">
                  No enabled storage configurations
                </h3>
                <p className="text-sm text-muted-foreground">
                  Create a configuration, then explicitly choose the default for
                  new artifact operations.
                </p>
              </div>
            </Panel>
          ) : (
            <ul
              className="grid min-w-0 gap-4"
              aria-label="Enabled storage configurations"
            >
              {rows.map((row) => {
                const editable =
                  editableProvider(row.storageType) &&
                  !!row.target &&
                  row.isEnabled;
                return (
                  <li
                    key={row.storageId}
                    data-testid={`storage-${row.storageId}`}
                    className="min-w-0 rounded-md border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="break-words font-medium">{row.name}</h3>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {row.storageId} · {row.storageType}
                        </p>
                      </div>
                      <StatusBadge tone="muted">
                        {row.isDefault ? "Default (saved)" : "Saved"}
                      </StatusBadge>
                    </div>
                    {row.description && (
                      <p className="mt-3 break-words text-sm text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    {row.target && (
                      <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            Endpoint
                          </dt>
                          <dd className="break-all font-mono text-xs">
                            {row.target.endpoint}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            Bucket / base path
                          </dt>
                          <dd className="break-all font-mono text-xs">
                            {row.target.bucket}
                            {row.target.basePath
                              ? ` / ${row.target.basePath}`
                              : ""}
                          </dd>
                        </div>
                      </dl>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Access key:{" "}
                      {row.credentials.accessKey
                        ? "Configured (write-only)"
                        : "Not reported"}
                      . Secret key:{" "}
                      {row.credentials.secretKey
                        ? "Configured (write-only)"
                        : "Not reported"}
                      . Connectivity not tested.
                    </p>
                    {!editable && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Read-only configuration. This editor supports only MinIO
                        and S3 records with a readable destination. Use the
                        operator setup guide for this record.
                      </p>
                    )}
                    {canWrite && editable && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          aria-label={`Edit storage ${row.name}`}
                          onClick={() => setEditor(row)}
                        >
                          Edit
                        </Button>
                        {!row.isDefault && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            aria-label={`Set ${row.name} as default`}
                            onClick={() => setDefaultTarget(row)}
                          >
                            Set as default
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {editor && canWrite && !error && (
        <StorageEditor
          key={editor === "new" ? "new" : editor.storageId}
          existing={editor === "new" ? undefined : editor}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onCreate={(input) =>
            mutate(
              () => createStorageConfiguration(input),
              "Storage configuration saved. Runtime reload is still required.",
            )
          }
          onUpdate={(id, changes) =>
            mutate(
              () => updateStorageConfiguration(id, changes),
              "Storage configuration saved. Runtime reload is still required.",
            )
          }
        />
      )}
      {defaultTarget && canWrite && !error && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDefaultTarget(undefined);
          }}
        >
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Change default storage</DialogTitle>
              <DialogDescription>
                Choose {defaultTarget.name} ({defaultTarget.storageId}) as the
                saved default for new artifact operations. Other configurations
                remain available for their historical artifacts.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{runtimeNote}</p>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDefaultTarget(undefined)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void mutate(
                    () =>
                      setDefaultStorageConfiguration(defaultTarget.storageId),
                    "Default storage saved. Runtime reload is still required.",
                  );
                }}
              >
                {busy ? "Saving…" : "Confirm default"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
