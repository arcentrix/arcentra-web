import { useRef, useState, type FormEvent } from "react";
import {
  editableProvider,
  endpointIsSafe,
  isSecretPlaceholder,
  type StorageChanges,
  type StorageConfiguration,
  type StorageCreation,
  type StorageProvider,
} from "@/api/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const runtimeNote =
  "Saving configuration does not test connectivity or reload running services. Restart Control and restart or re-register Agents using the setup guide to load the saved storage configuration.";

export function StorageEditor({
  existing,
  busy,
  onClose,
  onCreate,
  onUpdate,
}: {
  existing?: StorageConfiguration;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: StorageCreation) => Promise<void>;
  onUpdate: (id: string, changes: StorageChanges) => Promise<void>;
}) {
  const [storageId, setStorageId] = useState(existing?.storageId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [provider, setProvider] = useState<StorageProvider>(
    existing && editableProvider(existing.storageType)
      ? existing.storageType
      : "minio",
  );
  const [endpoint, setEndpoint] = useState(existing?.target?.endpoint ?? "");
  const [bucket, setBucket] = useState(existing?.target?.bucket ?? "");
  const [region, setRegion] = useState(existing?.target?.region ?? "");
  const [basePath, setBasePath] = useState(existing?.target?.basePath ?? "");
  const [useTLS, setUseTLS] = useState(existing?.target?.useTLS ?? true);
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [replaceAccess, setReplaceAccess] = useState(false);
  const [replaceSecret, setReplaceSecret] = useState(false);
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const close = () => {
    setAccessKey("");
    setSecretKey("");
    onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    setError(undefined);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const nextAccess =
      (!existing || replaceAccess) && accessKey.trim() ? accessKey : "";
    const nextSecret =
      (!existing || replaceSecret) && secretKey.trim() ? secretKey : "";
    if (isSecretPlaceholder(nextAccess) || isSecretPlaceholder(nextSecret)) {
      setError(
        "Enter a new credential value. Placeholder values cannot be saved.",
      );
      return;
    }
    if (!existing) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(storageId)) {
        setError(
          "Use a storage ID of 1–64 letters, numbers, dots, underscores or hyphens, starting with a letter or number.",
        );
        return;
      }
      if (
        !bucket.trim() ||
        !endpoint.trim() ||
        !nextAccess.trim() ||
        !nextSecret.trim()
      ) {
        setError("Endpoint, bucket, access key and secret key are required.");
        return;
      }
      if (!endpointIsSafe(endpoint)) {
        setError(
          "Use an endpoint without credentials, query parameters or fragments.",
        );
        return;
      }
      if (
        provider === "minio" &&
        (endpoint.includes("://") || endpoint.includes("/"))
      ) {
        setError(
          "MinIO endpoint must be a host with optional port, without a scheme or path.",
        );
        return;
      }
      if (provider === "s3" && !/^https?:\/\//.test(endpoint)) {
        setError("S3 endpoint must include an http:// or https:// scheme.");
        return;
      }
    }
    const changes: StorageChanges = {
      ...(name !== existing?.name ? { name: name.trim() } : {}),
      ...(description !== existing?.description ? { description } : {}),
      ...(nextAccess ? { accessKey: nextAccess } : {}),
      ...(nextSecret ? { secretKey: nextSecret } : {}),
    };
    if (existing && Object.keys(changes).length === 0) {
      setError("No changes to save.");
      return;
    }
    submitting.current = true;
    // Credentials live only in this mounted form and the single in-flight request.
    // Clear the inputs as soon as the user submits, even if the server rejects it.
    setAccessKey("");
    setSecretKey("");
    try {
      if (existing) await onUpdate(existing.storageId, changes);
      else
        await onCreate({
          storageId,
          name: name.trim(),
          description,
          storageType: provider,
          endpoint,
          bucket: bucket.trim(),
          region,
          basePath,
          useTLS:
            provider === "minio" ? useTLS : endpoint.startsWith("https://"),
          accessKey: nextAccess,
          secretKey: nextSecret,
        });
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit storage" : "New storage"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Update the display details or explicitly replace write-only credentials. Blank credentials preserve the saved values."
              : "Create an enabled MinIO or S3 configuration. Choose it as default separately after saving."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="min-w-0 space-y-4"
          autoComplete="off"
        >
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="storage-id">Storage ID</Label>
                <Input
                  id="storage-id"
                  value={storageId}
                  onChange={(e) => setStorageId(e.target.value)}
                  readOnly={!!existing}
                  maxLength={64}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="storage-name">Name</Label>
                <Input
                  id="storage-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="storage-provider">Provider</Label>
                <select
                  id="storage-provider"
                  value={provider}
                  disabled={!!existing || busy}
                  onChange={(e) =>
                    setProvider(e.target.value as StorageProvider)
                  }
                  className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value="minio">MinIO</option>
                  <option value="s3">S3</option>
                </select>
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="storage-endpoint">Endpoint</Label>
                <Input
                  id="storage-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  readOnly={!!existing}
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  {provider === "minio"
                    ? "Host and optional port, without a scheme (for example storage.example.com:9000)."
                    : "Include http:// or https://. The endpoint scheme controls S3 transport security."}{" "}
                  Never include credentials or signed URL parameters.
                </p>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="storage-bucket">Bucket</Label>
                <Input
                  id="storage-bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  readOnly={!!existing}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="storage-region">Region</Label>
                <Input
                  id="storage-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  readOnly={!!existing}
                />
                {provider === "minio" && (
                  <p className="text-xs text-muted-foreground">
                    Optional metadata; the current MinIO client discovers the
                    bucket region.
                  </p>
                )}
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="storage-base-path">Base path</Label>
                <Input
                  id="storage-base-path"
                  value={basePath}
                  onChange={(e) => setBasePath(e.target.value)}
                  readOnly={!!existing}
                />
              </div>
            </div>
            {provider === "minio" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useTLS}
                  disabled={!!existing || busy}
                  onChange={(e) => setUseTLS(e.target.checked)}
                />
                Use TLS
              </label>
            )}
            {existing && (
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Storage ID, provider and destination are locked to preserve
                historical artifact access. For a different endpoint, bucket,
                region, base path or TLS mode, create a new configuration, then
                explicitly choose the default. Keep the old configuration for
                its artifacts.
              </p>
            )}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                {existing && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={replaceAccess}
                      onChange={(e) => {
                        setReplaceAccess(e.target.checked);
                        setAccessKey("");
                      }}
                    />
                    Replace access key
                  </label>
                )}
                <Label htmlFor="storage-access-key">Access key</Label>
                <Input
                  id="storage-access-key"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={accessKey}
                  disabled={!!existing && !replaceAccess}
                  onChange={(e) => setAccessKey(e.target.value)}
                />
                {existing && (
                  <p className="text-xs text-muted-foreground">
                    {existing.credentials.accessKey
                      ? "Configured (write-only)."
                      : "No saved access key reported."}{" "}
                    Leave blank to keep the existing value.
                  </p>
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                {existing && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={replaceSecret}
                      onChange={(e) => {
                        setReplaceSecret(e.target.checked);
                        setSecretKey("");
                      }}
                    />
                    Replace secret key
                  </label>
                )}
                <Label htmlFor="storage-secret-key">Secret key</Label>
                <Input
                  id="storage-secret-key"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={secretKey}
                  disabled={!!existing && !replaceSecret}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                {existing && (
                  <p className="text-xs text-muted-foreground">
                    {existing.credentials.secretKey
                      ? "Configured (write-only)."
                      : "No saved secret key reported."}{" "}
                    Leave blank to keep the existing value.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storage-description">Description</Label>
              <Textarea
                id="storage-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">{runtimeNote}</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : existing ? "Save changes" : "Create storage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
