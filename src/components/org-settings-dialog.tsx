import { isApiError } from "@/lib/api-error";
import { useRef, useState, type FormEvent } from "react";
import {
  createOrganization,
  updateOrganization,
  type Organization,
  type CreateOrganizationRequest,
} from "@/api/organization";
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
import { mutationError } from "@/components/organization/mutation-error";

export function OrgSettingsDialog({
  organization,
  onClose,
  onSaved,
  onReload,
  onDenied,
}: {
  organization?: Organization;
  onClose: () => void;
  onSaved: (organization: Organization) => void;
  onReload: () => void;
  onDenied: (message: string) => void;
}) {
  const [draft, setDraft] = useState<CreateOrganizationRequest>({
    name: organization?.name ?? "",
    displayName: organization?.displayName ?? "",
    description: organization?.description ?? "",
    website: organization?.website ?? "",
    email: organization?.email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useMountedRef();
  const set = (key: keyof CreateOrganizationRequest, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || error) return;
    pending.current = true;
    setSaving(true);
    const data = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    ) as unknown as CreateOrganizationRequest;
    try {
      const { name: _name, ...metadata } = data;
      const saved = organization
        ? await updateOrganization(organization.orgId, {
            ...metadata,
            version: organization.version,
          })
        : await createOrganization(data);
      if (mounted.current) onSaved(saved);
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {organization ? "Edit organization" : "Create organization"}
          </DialogTitle>
          <DialogDescription>
            {organization
              ? "Update this organization's metadata. Current permissions and record version are checked when you save."
              : "Create a new organization with an explicit owner membership. Existing legacy permission scopes are not adopted."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={saving || !!error} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span>Organization name</span>
              <Input
                value={draft.name}
                required
                minLength={2}
                maxLength={64}
                pattern="[a-z0-9][a-z0-9_-]{1,63}"
                readOnly={!!organization}
                onChange={(event) => set("name", event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Display name</span>
              <Input
                value={draft.displayName}
                required={!!organization}
                maxLength={128}
                onChange={(event) => set("displayName", event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Description</span>
              <Textarea
                value={draft.description}
                maxLength={2000}
                onChange={(event) => set("description", event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Website</span>
              <Input
                type="url"
                value={draft.website}
                maxLength={2048}
                onChange={(event) => set("website", event.target.value)}
                placeholder="https://example.com"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Contact email</span>
              <Input
                type="email"
                value={draft.email}
                maxLength={254}
                onChange={(event) => set("email", event.target.value)}
              />
            </label>
          </fieldset>
          {error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <p className="text-xs text-fg-muted">
                Your draft is still shown. Reloading discards this draft and
                checks the saved state.
              </p>
              <Button type="button" variant="outline" onClick={onReload}>
                Reload saved organization
              </Button>
            </div>
          )}
          {saving && (
            <p role="status" className="text-sm">
              Saving organization…
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
              disabled={
                saving ||
                !!error ||
                !draft.name.trim() ||
                (!!organization && !draft.displayName.trim())
              }
            >
              {saving
                ? "Saving…"
                : organization
                  ? "Save organization"
                  : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
