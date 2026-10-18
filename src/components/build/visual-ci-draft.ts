/** Graph projections never own serialization: every edit patches the retained JSON. */
export type JsonObject = Record<string, unknown>;
export type DraftJob = JsonObject & { name: string; steps: DraftStep[] };
export type DraftStep = JsonObject & { name: string; uses: string };
export type GraphDraft = JsonObject & { jobs: DraftJob[] };
export const isObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validName = /^[a-zA-Z0-9_-]+$/;
const fail = (message: string): never => {
  throw new Error(message);
};
export const isOffline = (spec: GraphDraft) =>
  isObject(spec.runtime) && spec.runtime.type === "containerd-offline-v1";
export function dependencies(job: DraftJob): string[] {
  if (job.dependsOn === undefined || job.dependsOn === null) return [];
  if (
    !Array.isArray(job.dependsOn) ||
    job.dependsOn.some((name) => typeof name !== "string")
  )
    return fail(
      "Dependencies must be an array of job names. Edit the JSON to repair them.",
    );
  return job.dependsOn as string[];
}
function name(value: unknown) {
  if (typeof value !== "string" || !validName.test(value))
    fail("Names must contain only letters, numbers, hyphens and underscores.");
}
export function validateGraph(spec: GraphDraft): void {
  if (!spec.jobs.length) fail("A pipeline needs at least one job.");
  const byName = new Map<string, DraftJob>();
  for (const job of spec.jobs) {
    name(job.name);
    if (byName.has(job.name)) fail("Job names must be unique.");
    byName.set(job.name, job);
    if (!job.steps.length) fail("Every job needs at least one step.");
    const names = new Set<string>();
    for (const step of job.steps) {
      name(step.name);
      if (names.has(step.name))
        fail("Step names must be unique within their job.");
      names.add(step.name);
    }
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) fail("A dependency would create a cycle.");
    if (visited.has(id)) return;
    const job = byName.get(id);
    if (!job) return fail("A dependency refers to a missing job.");
    visiting.add(id);
    const deps = dependencies(job);
    if (new Set(deps).size !== deps.length)
      fail("Duplicate dependencies are not allowed.");
    for (const dep of deps) visit(dep);
    visiting.delete(id);
    visited.add(id);
  };
  for (const job of spec.jobs) visit(job.name);
  if (isOffline(spec)) {
    const roots = spec.jobs.filter((job) => !dependencies(job).length);
    const outgoing = new Map<string, number>();
    for (const job of spec.jobs) {
      const deps = dependencies(job);
      if (deps.length > 1)
        fail("Offline container jobs require one explicit linear chain.");
      for (const dep of deps) outgoing.set(dep, (outgoing.get(dep) ?? 0) + 1);
    }
    if (roots.length !== 1 || [...outgoing.values()].some((count) => count > 1))
      fail("Offline container jobs require one explicit linear chain.");
  }
}
/** Reject ambiguous JSON before a parse/stringify edit can discard authored data. */
export function parseDefinition(text: string): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(
      "Invalid JSON. The draft is unchanged; repair it in JSON mode.",
    );
  }
  const tokens =
    text.match(
      /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g,
    ) ?? [];
  let index = 0;
  const walk = (): void => {
    const token = tokens[index++];
    if (token === "{") {
      const keys = new Set<string>();
      while (tokens[index] !== "}") {
        const key = JSON.parse(tokens[index++]) as string;
        if (keys.has(key))
          fail(
            "Duplicate JSON keys cannot be edited safely. Repair them in JSON mode.",
          );
        keys.add(key);
        index++;
        walk();
        if (tokens[index] !== ",") break;
        index++;
      }
      index++;
    } else if (token === "[") {
      while (tokens[index] !== "]") {
        walk();
        if (tokens[index] !== ",") break;
        index++;
      }
      index++;
    } else if (/^-?\d/.test(token)) {
      const number = Number(token);
      if (
        !Number.isFinite(number) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number))
      )
        fail(
          "A numeric value cannot round-trip safely in this editor. The JSON is unchanged.",
        );
    }
  };
  walk();
  if (!isObject(value))
    return fail("The pipeline definition must be a JSON object.");
  return value;
}
/** Both spellings are legal protobuf JSON, but graph editing must not introduce aliases. */
const aliases = [
  "depends_on",
  "run_on_agent",
  "continue_on_error",
  "agent_selector",
];
export function parseGraph(text: string): GraphDraft {
  const value = parseDefinition(text);
  if (!isObject(value) || !Array.isArray(value.jobs))
    return fail(
      "Graph editing requires a jobs array. The original JSON is retained.",
    );
  for (const job of value.jobs) {
    if (!isObject(job) || !Array.isArray(job.steps))
      return fail("Every job needs a steps array. Use JSON mode to repair it.");
    if (aliases.some((key) => key in job))
      return fail(
        "This draft uses alternate field spellings. Use JSON mode; graph edits will not normalize or duplicate them.",
      );
    for (const step of job.steps) {
      if (!isObject(step) || typeof step.uses !== "string")
        return fail(
          "Every step needs a uses string. Use JSON mode to repair it.",
        );
      if (aliases.some((key) => key in step))
        return fail(
          "This draft uses alternate field spellings. Use JSON mode; graph edits will not normalize or duplicate them.",
        );
    }
  }
  const spec = value as GraphDraft;
  validateGraph(spec);
  return spec;
}
const populated = (value: unknown) =>
  value != null &&
  value !== "" &&
  value !== false &&
  !(Array.isArray(value) && value.length === 0) &&
  !(isObject(value) && Object.keys(value).length === 0);
const only = (obj: JsonObject, fields: string[]) =>
  Object.keys(obj).every((key) => fields.includes(key) || !populated(obj[key]));
const stringMap = (value: unknown) =>
  value == null ||
  (isObject(value) &&
    Object.values(value).every((entry) => typeof entry === "string"));
const optionalStrings = (object: JsonObject, keys: string[]) =>
  keys.every((key) => object[key] == null || typeof object[key] === "string");
function opaqueIdentityReference(spec: GraphDraft): boolean {
  const identities = new Set(
    spec.jobs.flatMap((job) => [
      job.name,
      ...job.steps.map((step) => step.name),
    ]),
  );
  const mentionsIdentity = (value: unknown): boolean => {
    if (typeof value === "string")
      return value
        .split(/[^a-zA-Z0-9_-]+/)
        .some((part) => identities.has(part));
    if (Array.isArray(value)) return value.some(mentionsIdentity);
    if (isObject(value)) return Object.values(value).some(mentionsIdentity);
    return false;
  };
  return (
    mentionsIdentity(spec.variables) ||
    mentionsIdentity(spec.runtime) ||
    spec.jobs.some(
      (job) =>
        mentionsIdentity(job.env) ||
        job.steps.some(
          (step) => mentionsIdentity(step.args) || mentionsIdentity(step.env),
        ),
    )
  );
}
/** Conservative proof: opaque plugins, expressions and extension data may refer to identities. */
export function identityBlockReason(spec: GraphDraft): string {
  if (
    !optionalStrings(spec, ["namespace", "version"]) ||
    !stringMap(spec.variables) ||
    (spec.runtime != null &&
      (!isObject(spec.runtime) ||
        !optionalStrings(spec.runtime, ["type", "image"]) ||
        !stringMap(spec.runtime.env) ||
        (spec.runtime.resources != null &&
          (!isObject(spec.runtime.resources) ||
            !only(spec.runtime.resources, [
              "cpuRequest",
              "cpuLimit",
              "memoryRequest",
              "memoryLimit",
            ]) ||
            !Object.values(spec.runtime.resources).every(
              (value) => typeof value === "string",
            )))))
  )
    return "Identity changes are blocked because fields have an unsupported shape. Repair them explicitly in JSON mode.";

  if (/\$|\{\{|\b(?:jobs|steps)\s*[.[]/.test(JSON.stringify(spec)))
    return "Identity changes are blocked because expressions may reference job or step names. Edit and review the JSON explicitly.";
  if (opaqueIdentityReference(spec))
    return "Identity changes are blocked because commands or data mention existing job/step names. Their references cannot be rewritten safely; review JSON explicitly.";
  if (
    !only(spec, ["namespace", "version", "variables", "runtime", "jobs"]) ||
    (isObject(spec.runtime) &&
      !only(spec.runtime, ["type", "image", "env", "resources"]))
  )
    return "Identity changes are blocked because advanced pipeline fields may contain references. The JSON is preserved.";
  for (const job of spec.jobs) {
    if (
      !optionalStrings(job, ["description", "timeout"]) ||
      !stringMap(job.env)
    )
      return "Identity changes are blocked because job fields have an unsupported shape. Use JSON mode.";
    if (
      !only(job, [
        "name",
        "description",
        "env",
        "timeout",
        "steps",
        "dependsOn",
      ])
    )
      return "Identity changes are blocked because a job has source, retry, approval or other advanced fields. The JSON is preserved.";
    for (const step of job.steps) {
      if (
        !optionalStrings(step, ["action", "timeout"]) ||
        !stringMap(step.env) ||
        ["runOnAgent", "continueOnError"].some(
          (key) => step[key] != null && typeof step[key] !== "boolean",
        )
      )
        return "Identity changes are blocked because step fields have an unsupported shape. Use JSON mode.";
      if (
        !shellCommand(step) ||
        !only(step, [
          "name",
          "uses",
          "action",
          "args",
          "env",
          "timeout",
          "runOnAgent",
          "continueOnError",
        ]) ||
        !isObject(step.args) ||
        !only(step.args, ["run"])
      )
        return "Identity changes are blocked because plugin or advanced step fields may reference names. The JSON is preserved.";
    }
  }
  return "";
}
export function shellCommand(step: DraftStep): boolean {
  return (
    ["shell", "builtin:shell"].includes(step.uses) &&
    [undefined, "", "run"].includes(step.action as string | undefined) &&
    (step.args == null ||
      (isObject(step.args) &&
        (step.args.run === undefined || typeof step.args.run === "string")))
  );
}
export type DraftEdit =
  | { type: "add-job"; name: string }
  | { type: "rename-job" | "copy-job"; job: string; name: string }
  | { type: "delete-job"; job: string }
  | { type: "description"; job: string; value: string }
  | { type: "dependency"; job: string; dependency: string; enabled: boolean }
  | { type: "add-step"; job: string; name: string }
  | {
      type: "rename-step" | "copy-step";
      job: string;
      step: string;
      name: string;
    }
  | { type: "delete-step"; job: string; step: string }
  | { type: "move-step"; job: string; step: string; direction: -1 | 1 }
  | { type: "command"; job: string; step: string; value: string };
const newStep = (name: string): DraftStep => ({
  name,
  uses: "shell",
  action: "run",
  args: { run: "echo ready" },
  runOnAgent: true,
});
export function editDraft(text: string, edit: DraftEdit): string {
  const spec = parseGraph(text); // Fresh parse: failed operations never mutate the caller's draft.
  if (
    [
      "rename-job",
      "copy-job",
      "delete-job",
      "rename-step",
      "copy-step",
      "delete-step",
      "move-step",
    ].includes(edit.type)
  ) {
    const reason = identityBlockReason(spec);
    if (reason) fail(reason);
  }
  if ("name" in edit) name(edit.name);
  if (edit.type === "add-job") {
    const deps = isOffline(spec)
      ? [
          spec.jobs.find(
            (job) =>
              !spec.jobs.some((other) =>
                dependencies(other).includes(job.name),
              ),
          )!.name,
        ]
      : [];
    spec.jobs.push({
      name: edit.name,
      steps: [newStep("step-1")],
      dependsOn: deps,
    });
  } else {
    const index = spec.jobs.findIndex((job) => job.name === edit.job);
    if (index < 0)
      return fail("The selected job no longer exists. Select it again.");
    const job = spec.jobs[index];
    switch (edit.type) {
      case "description":
        job.description = edit.value;
        break;
      case "rename-job":
        job.name = edit.name;
        for (const other of spec.jobs)
          if (dependencies(other).includes(edit.job))
            other.dependsOn = dependencies(other).map((dep) =>
              dep === edit.job ? edit.name : dep,
            );
        break;
      case "copy-job": {
        const copy = JSON.parse(JSON.stringify(job)) as DraftJob;
        copy.name = edit.name;
        if (isOffline(spec))
          copy.dependsOn = [
            spec.jobs.find(
              (item) =>
                !spec.jobs.some((other) =>
                  dependencies(other).includes(item.name),
                ),
            )!.name,
          ];
        spec.jobs.push(copy);
        break;
      }
      case "delete-job":
        if (spec.jobs.some((other) => dependencies(other).includes(job.name)))
          fail(
            "Disconnect dependent jobs before deleting this job. Dependencies will never be silently removed.",
          );
        spec.jobs.splice(index, 1);
        break;
      case "dependency": {
        const deps = dependencies(job);
        job.dependsOn = edit.enabled
          ? [...deps, edit.dependency]
          : deps.filter((dep) => dep !== edit.dependency);
        break;
      }
      case "add-step":
        job.steps.push(newStep(edit.name));
        break;
      default: {
        const stepIndex = job.steps.findIndex(
          (step) => step.name === edit.step,
        );
        if (stepIndex < 0)
          return fail("The selected step no longer exists. Select it again.");
        const step = job.steps[stepIndex];
        if (edit.type === "command") {
          if (!shellCommand(step))
            fail(
              "This step's plugin/action is edited only in JSON mode. Its arguments are preserved.",
            );
          step.args = {
            ...(isObject(step.args) ? step.args : {}),
            run: edit.value,
          };
        } else if (edit.type === "rename-step") step.name = edit.name;
        else if (edit.type === "copy-step") {
          const copy = JSON.parse(JSON.stringify(step)) as DraftStep;
          copy.name = edit.name;
          job.steps.splice(stepIndex + 1, 0, copy);
        } else if (edit.type === "delete-step") job.steps.splice(stepIndex, 1);
        else if (edit.type === "move-step") {
          const target = stepIndex + edit.direction;
          if (target < 0 || target >= job.steps.length)
            fail("The step cannot move past the job boundary.");
          [job.steps[stepIndex], job.steps[target]] = [
            job.steps[target],
            job.steps[stepIndex],
          ];
        }
      }
    }
  }
  validateGraph(spec);
  return JSON.stringify(spec, null, 2);
}
export function sourceFormat(format: string): "json" | "yaml" {
  if (["json", "SPEC_FORMAT_JSON"].includes(format)) return "json";
  if (["yaml", "yml", "SPEC_FORMAT_YAML"].includes(format)) return "yaml";
  return fail(
    "The repository format is unknown. Reload the definition before saving.",
  );
}
