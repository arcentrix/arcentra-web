import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";
import { useParams } from "react-router-dom";
import {
  createProjectSecret,
  disableProjectSecret,
  listProjectSecrets,
  projectSecretLimit,
  validSecretDescription,
  rotateProjectSecret,
  secretTypes,
  updateProjectSecret,
  validSecretName,
  validSecretValue,
  type ProjectSecret,
  type ProjectSecretList,
  type SecretType,
} from "@/api/project-secrets";
import { Panel, PanelHeader } from "@/components/blueprint";
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
import { useApiResource } from "@/hooks/use-api-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { isApiError } from "@/lib/api-error";
import authStore from "@/store/auth";
import userStore from "@/store/user";

type Operation = "create" | "edit" | "rotate" | "disable";
const deliveryWarning =
  "Rotation or disabling affects later secret resolution. Already queued or running jobs, and their already-approved retries, may retain old values. New unqueued jobs and approval releases recheck pinned versions and fail closed if they changed.";
const typeLabels: Record<SecretType, string> = {
  password: "Password",
  token: "Token",
  ssh_key: "SSH key",
  env: "Environment value",
};
const hasStatus = (error: unknown, ...statuses: number[]) =>
  isApiError(error) &&
  statuses.some((status) => error.status === status || error.code === status);
function failureMessage(error: unknown) {
  if (hasStatus(error, 401, 403))
    return "Secret access changed. Previously loaded metadata and entered values are hidden. Refresh to check current access.";
  if (hasStatus(error, 409))
    return "The secret version, project status, or name changed. Nothing was retried. Refresh and review the latest metadata before trying again.";
  if (hasStatus(error, 404))
    return "This project or secret is no longer available. Refresh to check the current inventory.";
  if (hasStatus(error, 503))
    return "Secret storage or encryption is unavailable. Refresh to check readiness before trying again.";
  if (hasStatus(error, 400))
    return "The server rejected the secret fields. Refresh and check the name, type, description, and new value.";
  return "The secret request could not be verified. Entered values were cleared. Refresh to check whether the change took effect before trying again.";
}
function blocked(
  snapshot: ProjectSecretList,
  operation: Operation,
  row?: ProjectSecret,
) {
  if (!snapshot.projectActive)
    return "The project or its organization is inactive. Secret changes are unavailable.";
  if (row?.isEnabled === 0)
    return "This secret is disabled. It cannot be changed or re-enabled here.";
  if (operation === "disable" ? !snapshot.canDisable : !snapshot.canWrite)
    return `Current access requires ${operation === "disable" ? "secret:delete" : "secret:write"} for this project.`;
  if (
    (operation === "create" || operation === "rotate") &&
    !snapshot.encryptionConfigured
  )
    return "The server encryption key is unavailable. Creation and rotation are blocked.";
  if (operation === "create" && snapshot.total >= projectSecretLimit)
    return "This project has reached the 1,000-secret inventory limit. Creation is unavailable; existing enabled secrets can still be managed.";
  return "";
}
export default function Secrets() {
  const { projectId } = useParams<{ projectId: string }>();
  const auth = authStore.useState();
  const user = userStore.useState();
  return (
    <SecretsSnapshot
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
function SecretsSnapshot({
  projectId,
  authenticated,
}: {
  projectId?: string;
  authenticated: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const pendingMutation = useRef(false);
  const [edit, setEdit] = useState<{
    operation: Operation;
    row?: ProjectSecret;
  } | null>(null);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const resource = useApiResource(
    authenticated && projectId ? `secrets:${projectId}:${revision}` : null,
    (signal) => listProjectSecrets(projectId!, signal),
  );
  const snapshot =
    !failure &&
    !resource.loading &&
    !resource.error &&
    resource.data?.projectId === projectId
      ? resource.data
      : undefined;
  const refresh = () => {
    setEdit(null);
    setFailure("");
    setRevision((value) => value + 1);
  };
  // Returning from another tab revalidates live permissions and clears any unfinished value.
  useEffect(() => {
    const revalidate = () => {
      if (pendingMutation.current) return;
      setEdit(null);
      setNotice("");
      setFailure("");
      setRevision((value) => value + 1);
    };
    window.addEventListener("focus", revalidate);
    return () => window.removeEventListener("focus", revalidate);
  }, []);
  const open = (operation: Operation, row?: ProjectSecret) => {
    setNotice("");
    setEdit({ operation, row });
  };
  return (
    <Panel>
      <PanelHeader
        title="Project secrets"
        className="flex-wrap"
        sub="Scoped metadata and write-only secret values"
        action={
          authenticated && projectId ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={resource.loading || !!edit}
                onClick={() => {
                  setNotice("");
                  refresh();
                }}
              >
                Refresh secrets
              </Button>
              {snapshot && (
                <Button
                  size="sm"
                  disabled={!snapshot.canCreate}
                  title={blocked(snapshot, "create")}
                  onClick={() => open("create")}
                >
                  Create secret
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="space-y-2 border-b px-5 py-4 text-sm text-fg-muted">
        <p>
          Only metadata is shown. Existing secret values are never retrieved or
          revealed.
        </p>
        <p>{deliveryWarning}</p>
      </div>
      {notice && (
        <p role="status" className="px-5 py-3 text-sm">
          {notice}
        </p>
      )}
      {!authenticated ? (
        <p role="status" className="p-5 text-sm">
          Sign in to view project secrets.
        </p>
      ) : !projectId ? (
        <p role="alert" className="p-5 text-sm">
          Choose a project to view secrets.
        </p>
      ) : failure || resource.error ? (
        <div className="space-y-3 p-5">
          <h3 className="font-medium">
            {hasStatus(resource.error, 401, 403) ||
            failure.startsWith("Secret access changed")
              ? "Secret access restricted"
              : "Project secrets unavailable"}
          </h3>
          <p role="alert" className="text-sm">
            {failure ||
              (hasStatus(resource.error, 401, 403)
                ? "Current access requires secret:read for this project. Previously loaded metadata is hidden."
                : "No verified secret inventory is available. Refresh to check access and try again.")}
          </p>
          <Button size="sm" variant="outline" onClick={refresh}>
            Check secret access again
          </Button>
        </div>
      ) : resource.loading ? (
        <p role="status" className="p-5 text-sm">
          Loading secret metadata…
        </p>
      ) : snapshot ? (
        <div className="space-y-4 p-5">
          {!snapshot.canCreate && (
            <p className="text-sm text-fg-muted">
              {blocked(snapshot, "create")}
            </p>
          )}
          {snapshot.canWrite && !snapshot.canDisable && (
            <p className="text-sm text-fg-muted">
              Disabling secrets requires secret:delete for this project.
            </p>
          )}
          <p className="text-sm text-fg-muted">
            {snapshot.total} recorded{" "}
            {snapshot.total === 1 ? "secret" : "secrets"}
          </p>
          {snapshot.list.length === 0 ? (
            <p className="text-sm">No secrets are recorded for this project.</p>
          ) : (
            <ul
              aria-label="Project secret metadata"
              className="divide-y rounded-md border"
            >
              {snapshot.list.map((row) => (
                <li key={row.secretId} className="space-y-3 p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="break-all font-mono text-sm font-semibold">
                        {row.name}
                      </h3>
                      <p className="text-sm text-fg-muted">
                        {typeLabels[row.secretType]} ·{" "}
                        {row.isEnabled ? "Enabled" : "Disabled"} ·{" "}
                        {row.configured
                          ? "Value configured"
                          : "Value unavailable"}
                      </p>
                      {row.description && (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {row.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["edit", "rotate", "disable"] as const).map(
                        (operation) => (
                          <Button
                            key={operation}
                            size="sm"
                            variant="outline"
                            disabled={
                              !row[
                                operation === "edit"
                                  ? "canUpdate"
                                  : operation === "rotate"
                                    ? "canRotate"
                                    : "canDisable"
                              ]
                            }
                            title={blocked(snapshot, operation, row)}
                            aria-label={`${operation === "edit" ? "Edit metadata for" : operation === "rotate" ? "Rotate" : "Disable"} ${row.name}`}
                            onClick={() => open(operation, row)}
                          >
                            {operation === "edit"
                              ? "Edit metadata"
                              : operation === "rotate"
                                ? "Rotate"
                                : "Disable"}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>
                  <dl className="grid min-w-0 gap-2 text-xs text-fg-muted sm:grid-cols-2">
                    <div>
                      <dt>Created</dt>
                      <dd className="break-all">
                        <time dateTime={row.createdAt}>{row.createdAt}</time>
                      </dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd className="break-all">
                        <time dateTime={row.updatedAt}>{row.updatedAt}</time>
                      </dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt>Version</dt>
                      <dd className="break-all font-mono">{row.version}</dd>
                    </div>
                  </dl>
                  {!row.isEnabled && (
                    <p className="text-xs text-fg-muted">
                      Disabled secrets cannot be changed or re-enabled here.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {edit && snapshot && projectId && (
        <SecretDialog
          key={`${edit.operation}:${edit.row?.secretId || "new"}`}
          projectId={projectId}
          pending={pendingMutation}
          operation={edit.operation}
          row={edit.row}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setNotice(
              edit.operation === "create"
                ? "Secret created."
                : edit.operation === "edit"
                  ? "Secret metadata updated. The stored value was preserved."
                  : edit.operation === "rotate"
                    ? "Secret rotated. Later resolutions will use the new value."
                    : "Secret disabled. Later resolutions will no longer receive this secret.",
            );
            refresh();
          }}
          onFailed={(error) => {
            setNotice("");
            setFailure(failureMessage(error));
            setEdit(null);
          }}
        />
      )}
    </Panel>
  );
}
function SecretDialog({
  projectId,
  pending,
  operation,
  row,
  onClose,
  onSaved,
  onFailed,
}: {
  projectId: string;
  pending: MutableRefObject<boolean>;
  operation: Operation;
  row?: ProjectSecret;
  onClose: () => void;
  onSaved: () => void;
  onFailed: (error: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [secretType, setSecretType] = useState<SecretType>("token");
  const [description, setDescription] = useState(row?.description || "");
  const [valueValid, setValueValid] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const valueInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );
  const attachValueField = useCallback(
    (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (!element && valueInput.current) valueInput.current.value = "";
      valueInput.current = element;
    },
    [],
  );
  const multiline = (row?.secretType || secretType) === "ssh_key";
  const maskedMultilineSupported =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("-webkit-text-security", "disc");
  const mounted = useMountedRef();
  const needsValue = operation === "create" || operation === "rotate";
  const needsAcknowledgment = operation === "rotate" || operation === "disable";
  const clear = () => {
    if (valueInput.current) valueInput.current.value = "";
    setValueValid(false);
  };
  const close = () => {
    clear();
    onClose();
  };
  const valid =
    (!needsValue || (valueValid && (!multiline || maskedMultilineSupported))) &&
    (!needsAcknowledgment || acknowledged) &&
    (operation !== "create" || validSecretName(name)) &&
    (!(["create", "edit"] as Operation[]).includes(operation) ||
      validSecretDescription(description)) &&
    (operation !== "edit" || description !== row?.description);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !valid) return;
    let value = valueInput.current?.value || "";
    if (needsValue && !validSecretValue(value)) return;
    pending.current = true;
    setSaving(true);
    clear();
    try {
      const request =
        operation === "create"
          ? createProjectSecret(projectId, {
              name,
              secretType,
              description,
              value,
            })
          : operation === "edit"
            ? updateProjectSecret(projectId, row!.secretId, {
                version: row!.version,
                description,
              })
            : operation === "rotate"
              ? rotateProjectSecret(projectId, row!.secretId, {
                  version: row!.version,
                  value,
                })
              : disableProjectSecret(projectId, row!.secretId, row!.version);
      value = "";
      await request;
      if (mounted.current) onSaved();
    } catch (error) {
      if (mounted.current) onFailed(error);
    } finally {
      value = "";
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const title = {
    create: "Create secret",
    edit: "Edit secret metadata",
    rotate: "Rotate secret",
    disable: "Disable secret",
  }[operation];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (pending.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {operation === "edit"
              ? "Update the description only. Name, type, project, and stored value are unchanged."
              : operation === "disable"
                ? "Disabling prevents later resolution. This cannot be undone here."
                : "Enter a new value. It will be sent once and cleared from the form, including after an error."}
          </DialogDescription>
        </DialogHeader>
        <form autoComplete="off" onSubmit={submit} className="space-y-4">
          <p className="break-all text-xs text-fg-muted">
            Project: {projectId}
          </p>
          {row && (
            <p className="break-all font-mono text-sm">
              {row.name} · {typeLabels[row.secretType]}
            </p>
          )}
          {operation === "create" && (
            <>
              <label className="block space-y-1 text-sm">
                <span>Secret name</span>
                <Input
                  required
                  maxLength={128}
                  pattern="[A-Za-z_][A-Za-z0-9_]{0,127}"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={saving}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p className="text-xs text-fg-muted">
                Letters, digits, and underscores; start with a letter or
                underscore. Names and types cannot be changed later.
              </p>
              <label className="block space-y-1 text-sm">
                <span>Secret type</span>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3"
                  aria-label="Secret type"
                  value={secretType}
                  onChange={(event) => {
                    clear();
                    setSecretType(event.target.value as SecretType);
                  }}
                  disabled={saving}
                >
                  {secretTypes.map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(operation === "create" || operation === "edit") && (
            <label className="block space-y-1 text-sm">
              <span>Description</span>
              <textarea
                className="min-h-20 w-full rounded-md border bg-background p-3"
                aria-label="Description"
                maxLength={8192}
                aria-invalid={!validSecretDescription(description)}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving}
              />
              <span className="block text-xs text-fg-muted">
                {[...description].length}/4096 characters
              </span>
              {!validSecretDescription(description) && (
                <span role="alert" className="block text-xs text-destructive">
                  Use up to 4,096 valid Unicode characters without NUL.
                </span>
              )}
              <span className="text-xs text-fg-muted">
                Metadata is readable by people with secret:read. Do not put
                credentials in the description.
              </span>
            </label>
          )}
          {needsValue && (
            <label className="block space-y-1 text-sm">
              <span>New secret value</span>
              {multiline ? (
                maskedMultilineSupported ? (
                  <textarea
                    ref={attachValueField}
                    aria-label="New secret value"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-private="true"
                    className="min-h-24 w-full rounded-md border bg-background p-3 font-mono text-sm [-webkit-text-security:disc]"
                    aria-describedby="secret-value-help"
                    onChange={(event) =>
                      setValueValid(validSecretValue(event.target.value))
                    }
                    disabled={saving}
                  />
                ) : (
                  <span role="alert" className="block text-sm text-destructive">
                    This browser cannot mask multiline SSH keys. Use a browser
                    with masked multiline input support to enter an SSH key.
                  </span>
                )
              ) : (
                <Input
                  key={row?.secretType || secretType}
                  type="password"
                  ref={attachValueField}
                  aria-label="New secret value"
                  required
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-private="true"
                  aria-describedby="secret-value-help"
                  onChange={(event) =>
                    setValueValid(validSecretValue(event.target.value))
                  }
                  disabled={saving}
                />
              )}
              <span id="secret-value-help" className="text-xs text-fg-muted">
                Required, up to 65,536 UTF-8 bytes. Blank values and
                configured/redacted placeholders are rejected.
              </span>
            </label>
          )}
          {needsAcknowledgment && (
            <>
              <p className="text-sm text-fg-muted">{deliveryWarning}</p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  required
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  disabled={saving}
                  className="mt-1 size-4 shrink-0"
                />
                <span>I understand this affects later secret resolution.</span>
              </label>
            </>
          )}
          <p className="text-xs text-fg-muted">
            The server checks current project access, lifecycle, and the exact
            version before applying changes.
          </p>
          {saving && (
            <p role="status" className="text-sm">
              Saving secret…
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={operation === "disable" ? "destructive" : "default"}
              disabled={saving || !valid}
            >
              {saving
                ? "Saving…"
                : operation === "edit"
                  ? "Save metadata"
                  : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
