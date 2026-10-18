import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  dependencies,
  editDraft,
  identityBlockReason,
  isObject,
  isOffline,
  parseGraph,
  shellCommand,
  type DraftEdit,
  type DraftJob,
  type GraphDraft,
} from "./visual-ci-draft";

/** Deterministic diagram only; coordinates and selection are never persisted in the DSL. */
function Diagram({
  spec,
  selected,
  onSelect,
}: {
  spec: GraphDraft;
  selected: string;
  onSelect: (name: string) => void;
}) {
  const levels = new Map<string, number>();
  const depth = (job: DraftJob): number => {
    if (levels.has(job.name)) return levels.get(job.name)!;
    const level =
      Math.max(
        -1,
        ...dependencies(job).map((dep) =>
          depth(spec.jobs.find((item) => item.name === dep)!),
        ),
      ) + 1;
    levels.set(job.name, level);
    return level;
  };
  spec.jobs.forEach(depth);
  const rows = new Map<number, number>();
  const positions = new Map(
    spec.jobs.map((job) => {
      const level = levels.get(job.name)!;
      const row = rows.get(level) ?? 0;
      rows.set(level, row + 1);
      return [job.name, { x: level * 240 + 12, y: row * 100 + 12 }];
    }),
  );
  const width = (Math.max(...levels.values()) + 1) * 240;
  const height = Math.max(...rows.values()) * 100;
  return (
    <div
      className="max-w-full overflow-x-auto rounded border"
      aria-label="Job dependency diagram"
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Static job dependency graph. Use the job buttons below to edit."
      >
        <title>Authored jobs and dependencies, not execution status</title>
        {spec.jobs.flatMap((job) =>
          dependencies(job).map((dep) => {
            const a = positions.get(dep)!,
              b = positions.get(job.name)!;
            return (
              <g key={`${dep}:${job.name}`}>
                <path
                  d={`M${a.x + 200},${a.y + 36} C${a.x + 220},${a.y + 36} ${b.x - 20},${b.y + 36} ${b.x},${b.y + 36}`}
                  fill="none"
                  stroke="currentColor"
                />
                <path
                  d={`M${b.x - 6},${b.y + 32} L${b.x},${b.y + 36} L${b.x - 6},${b.y + 40}`}
                  fill="none"
                  stroke="currentColor"
                />
              </g>
            );
          }),
        )}
        {spec.jobs.map((job) => {
          const p = positions.get(job.name)!;
          return (
            <g
              key={job.name}
              aria-hidden="true"
              onClick={() => onSelect(job.name)}
              className="cursor-pointer"
            >
              <rect
                x={p.x}
                y={p.y}
                width="200"
                height="72"
                rx="8"
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth={selected === job.name ? 3 : 1}
              />
              <text x={p.x + 12} y={p.y + 27} fill="currentColor" fontSize="13">
                {job.name.length > 23 ? `${job.name.slice(0, 20)}…` : job.name}
              </text>
              <text x={p.x + 12} y={p.y + 49} fill="currentColor" fontSize="12">
                {job.steps.length} ordered step
                {job.steps.length === 1 ? "" : "s"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
export function VisualCIEditor({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  let spec: GraphDraft | undefined,
    unavailable = "";
  try {
    spec = parseGraph(value);
  } catch (error) {
    unavailable =
      error instanceof Error
        ? error.message
        : "Graph editing is unavailable. Use JSON mode.";
  }
  const [selection, select] = useState("");
  const [newJob, setNewJob] = useState("");
  const [error, setError] = useState("");
  if (!spec)
    return (
      <p role="status" className="rounded border p-3 text-sm">
        Graph unavailable: {unavailable} No draft fields have been changed.
      </p>
    );
  const job = spec.jobs.find((item) => item.name === selection) ?? spec.jobs[0];
  const identityReason = identityBlockReason(spec);
  const edit = (operation: DraftEdit) => {
    if (disabled) return;
    setError("");
    try {
      onChange(editDraft(value, operation));
      if (
        operation.type === "rename-job" ||
        operation.type === "copy-job" ||
        operation.type === "add-job"
      )
        select(operation.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The edit could not be applied.",
      );
    }
  };
  return (
    <section aria-label="Visual pipeline editor" className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">
        This is an authored dependency graph, not a running pipeline. Edits stay
        in this draft until you explicitly save.
      </p>
      <Diagram spec={spec} selected={job.name} onSelect={select} />
      <div className="flex flex-wrap gap-2" aria-label="Select a job">
        {spec.jobs.map((item) => (
          <Button
            key={item.name}
            className="h-auto max-w-full whitespace-normal break-all text-left"
            type="button"
            size="sm"
            variant={item.name === job.name ? "default" : "outline"}
            aria-pressed={item.name === job.name}
            onClick={() => select(item.name)}
          >
            Job {item.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          New job name
          <Input
            value={newJob}
            disabled={disabled}
            onChange={(event) => setNewJob(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={disabled || !newJob}
          onClick={() => edit({ type: "add-job", name: newJob })}
        >
          Add job
        </Button>
      </div>
      {isOffline(spec) && (
        <p className="text-sm">
          Offline container mode requires one explicit linear chain. New and
          copied jobs append to its tail. Server runtime policy still decides
          whether this definition is supported.
        </p>
      )}
      {spec.jobs.some(
        (item) =>
          typeof item.concurrency === "string" && item.concurrency !== "",
      ) && (
        <p role="status" className="text-sm">
          Named concurrency is unsupported by the executor. The authored field
          is retained; remove it explicitly in JSON before server validation.
        </p>
      )}
      {spec.jobs.some((item) => item.approval != null) && (
        <p className="text-sm">
          Approval gates remain server-controlled. Graph edits never grant, vote
          on or bypass an approval.
        </p>
      )}
      {isObject(spec.runtime) &&
        typeof spec.runtime.type === "string" &&
        !["", "local", "baremetal", "containerd-offline-v1"].includes(
          spec.runtime.type,
        ) && (
          <p role="status" className="text-sm">
            This runtime is not supported by the graph editor. Its settings are
            preserved; review them in JSON and validate on the server.
          </p>
        )}
      <p className="text-xs text-muted-foreground">
        Advanced fields, plugin arguments, runtime, source, approval and retry
        policies are retained. Use JSON for fields not shown here; server
        validation remains authoritative.
      </p>
      {identityReason && (
        <p role="status" className="text-sm">
          {identityReason} Rename, copy, delete and step reordering are
          unavailable.
        </p>
      )}
      <JobEditor
        key={job.name}
        job={job}
        spec={spec}
        disabled={disabled}
        identityBlocked={!!identityReason}
        edit={edit}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
function JobEditor({
  job,
  spec,
  disabled,
  identityBlocked,
  edit,
}: {
  job: DraftJob;
  spec: GraphDraft;
  disabled: boolean;
  identityBlocked: boolean;
  edit: (operation: DraftEdit) => void;
}) {
  const [name, setName] = useState(job.name);
  const [newStep, setNewStep] = useState("");
  const identityDisabled = disabled || identityBlocked;
  return (
    <div className="min-w-0 space-y-3 rounded border p-3">
      <h3 className="break-all font-medium">Edit job {job.name}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Job identity
          <Input
            value={name}
            disabled={identityDisabled}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={identityDisabled}
          onClick={() => edit({ type: "rename-job", job: job.name, name })}
        >
          Rename job
        </Button>
        <Button
          type="button"
          disabled={identityDisabled}
          onClick={() => edit({ type: "copy-job", job: job.name, name })}
        >
          Copy job
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={identityDisabled}
          onClick={() => edit({ type: "delete-job", job: job.name })}
        >
          Delete job
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Names are DSL identities. Rename updates known dependency references;
        deleting a job with dependents is blocked. Copy uses the new identity
        above.
      </p>
      <label className="block text-sm">
        Job description
        <Input
          value={typeof job.description === "string" ? job.description : ""}
          disabled={
            disabled ||
            (job.description != null && typeof job.description !== "string")
          }
          onChange={(event) =>
            edit({
              type: "description",
              job: job.name,
              value: event.target.value,
            })
          }
        />
      </label>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="text-sm font-medium">Depends on</legend>
        {spec.jobs
          .filter((item) => item.name !== job.name)
          .map((other) => (
            <label
              key={other.name}
              className="flex items-center gap-2 break-all text-sm"
            >
              <input
                type="checkbox"
                checked={dependencies(job).includes(other.name)}
                onChange={(event) =>
                  edit({
                    type: "dependency",
                    job: job.name,
                    dependency: other.name,
                    enabled: event.target.checked,
                  })
                }
              />
              {other.name}
            </label>
          ))}
        {spec.jobs.length === 1 && <p className="text-xs">No other jobs.</p>}
      </fieldset>
      <ol className="space-y-3" aria-label={`Ordered steps for ${job.name}`}>
        {job.steps.map((step, index) => (
          <StepEditor
            key={step.name}
            job={job.name}
            step={step}
            index={index}
            count={job.steps.length}
            disabled={disabled}
            identityDisabled={identityDisabled}
            edit={edit}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          New step name
          <Input
            value={newStep}
            disabled={disabled}
            onChange={(event) => setNewStep(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={disabled || !newStep}
          onClick={() =>
            edit({ type: "add-step", job: job.name, name: newStep })
          }
        >
          Add step
        </Button>
      </div>
    </div>
  );
}
function StepEditor({
  job,
  step,
  index,
  count,
  disabled,
  identityDisabled,
  edit,
}: {
  job: string;
  step: DraftJob["steps"][number];
  index: number;
  count: number;
  disabled: boolean;
  identityDisabled: boolean;
  edit: (operation: DraftEdit) => void;
}) {
  const [name, setName] = useState(step.name);
  return (
    <li className="min-w-0 space-y-2 rounded border p-3">
      <h4 className="break-all text-sm font-medium">
        {index + 1}. {step.name} · {step.uses}
      </h4>
      <label className="block break-all text-sm">
        Identity for step {step.name}
        <Input
          value={name}
          disabled={identityDisabled}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal break-all"
          size="sm"
          disabled={identityDisabled}
          onClick={() =>
            edit({ type: "rename-step", job, step: step.name, name })
          }
        >
          Rename {step.name}
        </Button>
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal break-all"
          size="sm"
          disabled={identityDisabled}
          onClick={() =>
            edit({ type: "copy-step", job, step: step.name, name })
          }
        >
          Copy {step.name}
        </Button>
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal break-all"
          size="sm"
          variant="outline"
          disabled={identityDisabled}
          onClick={() => edit({ type: "delete-step", job, step: step.name })}
        >
          Delete {step.name}
        </Button>
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal break-all"
          size="sm"
          variant="outline"
          disabled={identityDisabled || index === 0}
          onClick={() =>
            edit({ type: "move-step", job, step: step.name, direction: -1 })
          }
        >
          Move {step.name} up
        </Button>
        <Button
          type="button"
          className="h-auto max-w-full whitespace-normal break-all"
          size="sm"
          variant="outline"
          disabled={identityDisabled || index === count - 1}
          onClick={() =>
            edit({ type: "move-step", job, step: step.name, direction: 1 })
          }
        >
          Move {step.name} down
        </Button>
      </div>
      {shellCommand(step) ? (
        <label className="block break-all text-sm">
          Command for {step.name}
          <Textarea
            className="min-h-24 font-mono text-xs"
            disabled={disabled}
            value={
              isObject(step.args) && typeof step.args.run === "string"
                ? step.args.run
                : ""
            }
            onChange={(event) =>
              edit({
                type: "command",
                job,
                step: step.name,
                value: event.target.value,
              })
            }
          />
        </label>
      ) : (
        <p className="text-xs">
          Plugin/action arguments are preserved. Edit this step in JSON mode.
        </p>
      )}
    </li>
  );
}
