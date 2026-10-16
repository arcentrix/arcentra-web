import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  FolderGit2,
  GitBranch,
  Plus,
  RefreshCw,
} from "lucide-react";
import { listProjects, createProject } from "@/api/project";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { useApiResource } from "@/hooks/use-api-resource";
import { useScopedPermission } from "@/hooks/use-scoped-permission";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/blueprint";
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
import { InlineErrorState } from "@/components/inline-error-state";
import { Pagination } from "@/components/build/pipeline-workspace";
import { errorMessage } from "@/components/build/run-status";

export default function Projects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const projects = useApiResource(`projects:${page}:${search}`, (signal) =>
    listProjects({ name: search, pageNum: page }, signal),
  );
  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="workspace / projects"
        title="Projects"
        sub="Your repositories and their build pipelines."
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            New project
          </Button>
        }
      />
      <div className="flex items-center gap-2">
        <Input
          aria-label="Search projects"
          placeholder="Search projects…"
          className="max-w-sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          aria-label="Refresh projects"
          onClick={projects.refresh}
        >
          <RefreshCw
            className={projects.loading ? "size-3.5 animate-spin" : "size-3.5"}
          />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {projects.data ? `${projects.data.total} projects` : ""}
        </span>
      </div>
      {projects.error && (
        <Panel>
          <InlineErrorState
            title="Projects unavailable"
            description={projects.error.message}
            onRetry={projects.refresh}
          />
        </Panel>
      )}
      {!projects.data && projects.loading && (
        <p role="status" className="p-8 text-sm text-muted-foreground">
          Loading projects…
        </p>
      )}
      {projects.data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.data.list?.map((project) => (
              <Link
                key={project.projectId}
                to={`/projects/${encodeURIComponent(project.projectId)}`}
                className="group flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-5 transition-colors hover:border-foreground/30 hover:bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <FolderGit2 className="size-5 text-muted-foreground" />
                  <h2 className="min-w-0 flex-1 truncate font-semibold">
                    {project.displayName || project.name}
                  </h2>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </div>
                <p className="min-h-10 text-sm text-muted-foreground">
                  {project.description || "No description added."}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {project.repoUrl}
                </p>
                <div className="mt-auto flex items-center gap-2 border-t pt-4 text-xs">
                  <GitBranch className="size-3" />
                  <span className="truncate">
                    {project.defaultBranch || "main"}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {project.isEnabled === 1 ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {!projects.data.list?.length && (
            <Panel>
              <div className="p-12 text-center">
                <FolderGit2 className="mx-auto mb-4 size-8 text-muted-foreground" />
                <h2 className="font-semibold">
                  {search
                    ? "No matching projects"
                    : "Connect your first project"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search
                    ? "Try another project name."
                    : "Add a repository to start managing its pipeline definitions and executions."}
                </p>
              </div>
            </Panel>
          )}
          {projects.data.total > 20 && (
            <Pagination
              page={page}
              total={projects.data.total}
              pageSize={20}
              onPage={setPage}
              loading={projects.loading}
            />
          )}
        </>
      )}
      {open && (
        <CreateProjectDialog
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            navigate(`/projects/${encodeURIComponent(id)}/pipelines`);
          }}
        />
      )}
    </section>
  );
}
function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const permission = useScopedPermission("org", orgId.trim());
  const [repoUrl, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useMountedRef();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !permission.has("org:create_project")) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const project = await createProject({
        name: name.trim(),
        orgId: orgId.trim(),
        repoUrl: repoUrl.trim(),
        defaultBranch: branch.trim(),
        description: "",
      });
      if (mounted.current) onCreated(project.projectId);
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
      onOpenChange={(value) => {
        if (!value && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Connect a Git repository in your organization. This form supports
            repositories accessible to your control service.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Organization ID</span>
            <Input
              required
              aria-describedby="project-organization-help"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Your organization ID"
            />
          </label>
          <p
            id="project-organization-help"
            className="text-xs text-muted-foreground"
          >
            Enter a stable organization scope ID approved by your administrator.
            Creating a project does not create an organization. Organization and
            member management are not available yet.
          </p>
          <label className="block space-y-1 text-sm">
            <span>Project name</span>
            <Input
              required
              minLength={2}
              maxLength={128}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="api-service"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Repository URL</span>
            <Input
              required
              value={repoUrl}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/your-team/your-repo.git"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Default branch</span>
            <Input
              required
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {orgId && permission.loading && (
            <p role="status" className="text-xs text-muted-foreground">
              Checking organization permissions…
            </p>
          )}
          {permission.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not check organization permissions:{" "}
              {permission.error.message}{" "}
              <button
                type="button"
                className="underline"
                onClick={permission.refresh}
              >
                Retry
              </button>
            </p>
          )}
          {permission.data && !permission.has("org:create_project") && (
            <p role="alert" className="text-sm text-destructive">
              You do not have permission to create projects in this
              organization.
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
                permission.loading ||
                !permission.has("org:create_project")
              }
            >
              {saving ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
