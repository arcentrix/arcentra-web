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
import { deploymentReviewError } from "./deployment-review";
import { ApiError } from "@/lib/api-error";
import { RetryPolicyEditor } from "./retry-policy-editor";

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

export function RunPipelineDialog(props: {
  pipeline: Pipeline;
  onClose: () => void;
  onStarted: (runId: string) => void;
}) {
  // Discard consent, request IDs, and late results across pipeline identity changes.
  return (
    <ReviewedRunDialog
      key={`${props.pipeline.projectId}:${props.pipeline.pipelineId}`}
      {...props}
    />
  );
}

function ReviewedRunDialog({
  pipeline,
  onClose,
  onStarted,
}: {
  pipeline: Pipeline;
  onClose: () => void;
  onStarted: (runId: string) => void;
}) {
  const resource = useApiResource(
    `run-definition:${pipeline.pipelineId}`,
    (signal) => getPipelineSpec(pipeline.pipelineId, signal),
  );
  const [variables, setVariables] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState("");
  const request = useRef({ key: "", id: "" });
  const pending = useRef(false);
  const completed = useRef(false);
  const mounted = useMountedRef();
  const definition = resource.data;
  const reviewError = definition
    ? deploymentReviewError(definition, pipeline.projectId)
    : "";
  const reviewKey = JSON.stringify({
    pipelineId: pipeline.pipelineId,
    projectId: pipeline.projectId,
    definition,
    variables,
  });
  const plan = definition?.deploymentPlan;
  const allowDeployments = !!plan && consent === reviewKey;
  const ready =
    !!definition && !resource.loading && !resource.error && !reviewError;
  const refresh = () => {
    if (pending.current || completed.current) return;
    setConsent("");
    resource.refresh();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      pending.current ||
      completed.current ||
      !ready ||
      (plan && !allowDeployments)
    )
      return;
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
      const input = {
        variables: parsed as Record<string, string>,
        allowDeployments,
        expectedDefinitionCommitSha: definition.headCommitSha,
        ...(plan
          ? { expectedDeploymentPlanHash: definition.deploymentPlanHash }
          : {}),
      };
      const key = JSON.stringify(input);
      if (request.current.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const result = await triggerPipeline(pipeline.pipelineId, {
        ...input,
        requestId: request.current.id,
      });
      completed.current = true;
      if (mounted.current) {
        setStarted(true);
        onStarted(result.runID);
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(errorMessage(err));
      if (
        (err instanceof ApiError && (err.status === 409 || err.code === 409)) ||
        /definition changed|expectedDefinitionCommitSha|deployment plan.*changed|target.*changed/i.test(
          errorMessage(err),
        )
      ) {
        setConsent("");
        resource.refresh();
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
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run {pipeline.name}</DialogTitle>
          <DialogDescription>
            Review the current repository definition before starting. Kubernetes
            deployment requires explicit consent for this definition and target.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {resource.loading && (
            <p role="status">
              Loading current definition and deployment review…
            </p>
          )}
          {resource.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not review the current definition: {resource.error.message}
            </p>
          )}
          {reviewError && (
            <p role="alert" className="text-sm text-destructive">
              {reviewError}
            </p>
          )}
          {definition && (
            <div className="space-y-2 rounded border p-3 text-xs">
              <p>
                Definition: {definition.pipelineFilePath} · {definition.branch}
              </p>
              <p className="break-all font-mono">
                Definition revision: {definition.headCommitSha || "Unknown"}
              </p>
              <p className="text-muted-foreground">
                Source commit: not verified. The definition revision is not
                proof of the code or image that will be built.
              </p>
              <details>
                <summary className="cursor-pointer">
                  Review exact pipeline definition
                </summary>
                <pre
                  aria-label="Reviewed pipeline definition"
                  className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all"
                >
                  {JSON.stringify(definition.spec, null, 2)}
                </pre>
              </details>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || started || resource.loading}
            onClick={refresh}
          >
            Refresh definition and review
          </Button>
          {plan && !reviewError && (
            <section
              aria-label="Kubernetes deployment review"
              className="space-y-2 rounded border p-3 text-sm"
            >
              <p className="font-medium">
                One final controller-managed Kubernetes deployment
              </p>
              <dl className="space-y-1 break-all text-xs">
                <div>
                  <dt className="inline text-muted-foreground">Job / step: </dt>
                  <dd className="inline">
                    {plan.jobName} / {plan.stepName}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">
                    Environment:{" "}
                  </dt>
                  <dd className="inline">
                    {plan.target.name} ({plan.environmentId})
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">
                    Operator target:{" "}
                  </dt>
                  <dd className="inline">{plan.target.targetRef}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">
                    Namespace / Deployment / container:{" "}
                  </dt>
                  <dd className="inline">
                    {plan.target.namespace} / {plan.target.deployment} /{" "}
                    {plan.target.container}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">
                    Producer artifact:{" "}
                  </dt>
                  <dd className="inline">
                    {plan.artifact.job} / {plan.artifact.step} /{" "}
                    {plan.artifact.name}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">
                    Deployment timeout:{" "}
                  </dt>
                  <dd className="inline">{plan.timeoutSeconds} seconds</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                The artifact must be produced and verified in this run. Its
                image digest is not known yet. This deployment has no agent,
                automatic retry, or continue-on-error.
              </p>
              <p className="text-xs text-muted-foreground">
                Cancellation or timeout after apply does not roll back
                Kubernetes changes. An unresolved apply keeps the target
                reserved; an operator must inspect and explicitly recover the
                same release ID, rather than create a duplicate.
              </p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={allowDeployments}
                  disabled={!ready || saving || started}
                  onChange={(event) =>
                    setConsent(event.target.checked ? reviewKey : "")
                  }
                />
                <span>
                  Allow Kubernetes deployment to this reviewed environment and
                  target for this run
                </span>
              </label>
            </section>
          )}
          {ready && !plan && (
            <p className="text-xs text-muted-foreground">
              The backend review found no Kubernetes deployment job. Deployment
              opt-in stays off.
            </p>
          )}
          <label className="block space-y-2 text-sm">
            <span>Variables (JSON)</span>
            <Textarea
              className="min-h-24 font-mono text-xs"
              value={variables}
              disabled={saving || started}
              onChange={(event) => {
                setVariables(event.target.value);
                setConsent("");
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Use configured secrets for credentials. Variables are stored with
            the run. Changing variables or refreshing the review clears
            deployment consent.
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
            <Button
              type="submit"
              disabled={
                saving || started || !ready || (!!plan && !allowDeployments)
              }
            >
              {saving ? "Starting…" : started ? "Run started" : "Start run"}
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
            <RetryPolicyEditor
              value={draft ?? JSON.stringify(resource.data.spec, null, 2)}
              disabled={readOnly || busy}
              onChange={(value) => {
                setDraft(value);
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
