import { useRef, useState, type FormEvent } from "react";
import {
  createPipeline,
  triggerPipeline,
  getPipelineSpec,
  validatePipelineSpec,
  savePipelineSpec,
} from "@/api/pipeline";
import type { Pipeline } from "@/api/pipeline/types";
import { getProject, listProjects } from "@/api/project";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineErrorState } from "@/components/inline-error-state";
import { errorMessage } from "./run-status";

export function CreatePipelineDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const projects = useApiResource(
    projectId ? null : "pipeline-projects",
    (signal) => listProjects({ pageSize: 100 }, signal),
  );
  const currentProject = useApiResource(
    projectId ? `new-pipeline-project:${projectId}` : null,
    (signal) => getProject(projectId!, signal),
  );
  const [selectedProject, setProject] = useState(projectId ?? "");
  const permission = useScopedPermission("project", selectedProject);
  const [name, setName] = useState("");
  const [repoUrl, setRepo] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const effectiveRepoUrl = repoUrl ?? currentProject.data?.repoUrl ?? "";
  const effectiveBranch =
    branch ?? currentProject.data?.defaultBranch ?? "main";
  const [path, setPath] = useState(".arcentra/pipeline.yaml");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useMountedRef();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !permission.has("pipeline:create")) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await createPipeline({
        projectId: selectedProject.trim(),
        name: name.trim(),
        description: "",
        repoUrl: effectiveRepoUrl.trim(),
        defaultBranch: effectiveBranch.trim(),
        pipelineFilePath: path.trim(),
        saveMode: "direct",
      });
      if (mounted.current) onCreated(response.pipelineID);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pipeline</DialogTitle>
          <DialogDescription>
            Connect a pipeline definition already committed to your repository.
            Creating a pipeline does not execute it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!projectId && (
            <label className="block space-y-1 text-sm">
              <span>Project</span>
              <select
                aria-label="Project"
                required
                value={selectedProject}
                onChange={(e) => {
                  setProject(e.target.value);
                  const project = projects.data?.list?.find(
                    (p) => p.projectId === e.target.value,
                  );
                  if (project) {
                    setRepo(project.repoUrl);
                    setBranch(project.defaultBranch || "main");
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3"
              >
                <option value="">
                  {projects.loading ? "Loading projects…" : "Select a project"}
                </option>
                {projects.data?.list?.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.displayName || p.name}
                  </option>
                ))}
              </select>
              {projects.error && (
                <span role="alert" className="text-destructive">
                  {projects.error.message}
                </span>
              )}
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span>Pipeline name</span>
            <Input
              required
              maxLength={128}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Build and test"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Repository URL</span>
            <Input
              required
              value={effectiveRepoUrl}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/your-team/your-repo.git"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span>Branch</span>
              <Input
                required
                value={effectiveBranch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Definition path</span>
              <Input
                required
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {selectedProject && permission.loading && (
            <p role="status" className="text-xs text-muted-foreground">
              Checking project permissions…
            </p>
          )}
          {permission.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not check project permissions: {permission.error.message}{" "}
              <button
                type="button"
                className="underline"
                onClick={permission.refresh}
              >
                Retry
              </button>
            </p>
          )}
          {selectedProject &&
            permission.data &&
            !permission.has("pipeline:create") && (
              <p role="alert" className="text-sm text-destructive">
                You do not have permission to create pipelines in this project.
              </p>
            )}
          <DialogFooter>
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
                !selectedProject ||
                permission.loading ||
                !permission.has("pipeline:create")
              }
            >
              {saving ? "Creating…" : "Create pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RunPipelineDialog({
  pipeline,
  onClose,
  onStarted,
}: {
  pipeline: Pipeline;
  onClose: () => void;
  onStarted: (runId: string) => void;
}) {
  const [variables, setVariables] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const mounted = useMountedRef();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const parsed: unknown = JSON.parse(variables);
      if (
        !parsed ||
        Array.isArray(parsed) ||
        typeof parsed !== "object" ||
        Object.values(parsed).some((v) => typeof v !== "string")
      )
        throw new Error(
          'Variables must be a JSON object with string values, for example {"ENV": "staging"}.',
        );
      const result = await triggerPipeline(
        pipeline.pipelineId,
        parsed as Record<string, string>,
        requestId.current,
      );
      if (mounted.current) onStarted(result.runID);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run {pipeline.name}</DialogTitle>
          <DialogDescription>
            Execute {pipeline.pipelineFilePath} from {pipeline.defaultBranch}.
            Jobs will be assigned to matching enabled agents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span>Variables (JSON)</span>
            <Textarea
              className="min-h-32 font-mono text-xs"
              value={variables}
              disabled={saving}
              onChange={(e) => {
                setVariables(e.target.value);
                requestId.current = crypto.randomUUID();
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Use configured secrets for credentials. Variables are stored with
            the run.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Starting…" : "Start run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PipelineSpecDialog({
  pipeline,
  onClose,
  readOnly = false,
}: {
  pipeline: Pipeline;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const resource = useApiResource(`spec:${pipeline.pipelineId}`, (signal) =>
    getPipelineSpec(pipeline.pipelineId, signal),
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const mounted = useMountedRef();
  const apply = async (save: boolean) => {
    if (readOnly || pending.current || !resource.data) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const spec: unknown = JSON.parse(
        draft ?? JSON.stringify(resource.data.spec),
      );
      if (!spec || Array.isArray(spec) || typeof spec !== "object")
        throw new Error("The pipeline definition must be a JSON object.");
      const result = await validatePipelineSpec(
        pipeline.pipelineId,
        spec as Record<string, unknown>,
      );
      if (save) {
        const saved = await savePipelineSpec(
          pipeline.pipelineId,
          spec as Record<string, unknown>,
          resource.data.headCommitSha,
          requestId.current,
        );
        if (!mounted.current) return;
        setNotice(
          saved.prUrl
            ? `Saved to a pull request: ${saved.prUrl}`
            : `Committed ${saved.commitSha.slice(0, 12)} to ${resource.data.branch}.`,
        );
        requestId.current = crypto.randomUUID();
        setDraft(null);
        resource.refresh();
      } else
        setNotice(
          `Valid definition · ${result.jobsCount} jobs${result.warnings?.length ? ` · ${result.warnings.join("; ")}` : ""}`,
        );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pipeline definition</DialogTitle>
          <DialogDescription>
            {pipeline.pipelineFilePath} ·{" "}
            {readOnly
              ? "Read-only definition. Editing requires pipeline update permission."
              : "Saving commits to the repository using this pipeline's configured save mode."}
          </DialogDescription>
        </DialogHeader>
        {resource.error ? (
          <InlineErrorState
            description={resource.error.message}
            onRetry={resource.refresh}
            minHeight={150}
          />
        ) : !resource.data ? (
          <p role="status">Loading definition…</p>
        ) : (
          <>
            <Textarea
              aria-label="Pipeline definition JSON"
              readOnly={readOnly}
              spellCheck={false}
              className="h-[45vh] font-mono text-xs"
              value={draft ?? JSON.stringify(resource.data.spec, null, 2)}
              disabled={busy}
              onChange={(e) => {
                setDraft(e.target.value);
                setNotice("");
                requestId.current = crypto.randomUUID();
              }}
            />
            <p className="truncate font-mono text-xs text-muted-foreground">
              Based on commit {resource.data.headCommitSha || "unknown"}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="break-all text-sm">
            {notice}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            disabled={readOnly || busy || !resource.data || !!resource.error}
            onClick={() => void apply(false)}
          >
            Validate
          </Button>
          <Button
            disabled={
              readOnly ||
              busy ||
              !resource.data ||
              !!resource.error ||
              resource.loading
            }
            onClick={() => void apply(true)}
          >
            {busy ? "Working…" : "Save to repository"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
