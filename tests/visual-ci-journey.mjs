/** Actual UI/API/Git/Agent journey. No route fulfillment or authentication injection. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";
export const visualCIStages = Object.freeze([
  "visual-ci-create",
  "visual-ci-edit",
  "visual-ci-validate",
  "visual-ci-save",
  "visual-ci-reload",
  "visual-ci-trigger",
  "visual-ci-execution",
]);
export const visualCISteps = Object.freeze([
  "pipeline-created",
  "graph-edited",
  "cycle-rejected",
  "draft-validated",
  "definition-saved",
  "definition-reloaded",
  "run-triggered",
  "jobs-succeeded",
  "logs-verified",
  "source-unknown",
]);
const boundedId = /^[A-Za-z0-9_-]{1,64}$/;
const sha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
export function visualCIEvidence(evidence) {
  if (!evidence) return {};
  assert.ok(Array.isArray(evidence.steps));
  assert.ok(evidence.steps.every((step) => visualCISteps.includes(step)));
  assert.equal(new Set(evidence.steps).size, evidence.steps.length);
  const result = {
    journey: "visual-ci-v1",
    completed: visualCISteps.every((step) => evidence.steps.includes(step)),
    steps: visualCISteps.filter((step) => evidence.steps.includes(step)),
  };
  for (const key of [
    "projectId",
    "pipelineId",
    "runId",
    "baseDefinitionCommit",
    "savedDefinitionCommit",
  ]) {
    if (evidence[key] !== undefined) {
      assert.match(evidence[key], key.endsWith("Commit") ? sha : boundedId);
      result[key] = evidence[key];
    }
    if (result.completed) assert.ok(result[key]);
  }
  if (result.completed)
    assert.notEqual(result.baseDefinitionCommit, result.savedDefinitionCommit);
  return { visualCI: result };
}
export function visualCIConfig(config) {
  assert.ok(config && typeof config === "object");
  const {
    projectId,
    repoUrl,
    branch,
    pipelineFilePath,
    expectedHeadCommitSha,
    expectedSpec,
    marker,
  } = config;
  assert.match(projectId, boundedId);
  assert.match(expectedHeadCommitSha, sha);
  assert.ok(
    ["git://127.0.0.1:19418/visual.git", "git://git:9418/visual.git"].includes(
      repoUrl,
    ),
    "Visual acceptance only accepts the two fixed disposable Git transports",
  );
  assert.equal(branch, "main");
  assert.equal(pipelineFilePath, "pipeline.json");
  assert.match(marker, /^[A-Z][A-Z0-9_]{1,79}$/);
  assert.ok(
    expectedSpec &&
      typeof expectedSpec === "object" &&
      !Array.isArray(expectedSpec),
  );
  assert.ok(Buffer.byteLength(JSON.stringify(expectedSpec)) <= 32768);
  assert.equal(expectedSpec.namespace, "visual-editor-acceptance");
  assert.equal(expectedSpec.jobs.length, 1);
  assert.equal(expectedSpec.jobs[0].name, "visual-build");
  assert.equal(expectedSpec.jobs[0].steps.length, 1);
  assert.equal(expectedSpec.jobs[0].steps[0].name, "original-step");
  assert.ok(
    !expectedSpec.jobs[0].source,
    "The visual definition fixture must not imply source checkout",
  );
  return {
    projectId,
    repoUrl,
    branch,
    pipelineFilePath,
    expectedHeadCommitSha,
    expectedSpec,
    marker,
  };
}
// Only protobuf schema defaults are normalized. Arbitrary Struct payloads remain exact.
const stepShape = {
  name: "scalar",
  uses: "scalar",
  action: "scalar",
  args: "struct",
  env: "map",
  continueOnError: "scalar",
  timeout: "scalar",
  when: "scalar",
  agentSelector: {
    matchLabels: "map",
    matchExpressions: [
      { key: "scalar", operator: "scalar", values: ["scalar"] },
    ],
  },
  runOnAgent: "scalar",
};
const triggerShape = { type: "scalar", options: "struct" };
const notifyShape = { plugin: "scalar", action: "scalar", params: "struct" };
const jobShape = {
  name: "scalar",
  description: "scalar",
  env: "map",
  concurrency: "scalar",
  timeout: "scalar",
  retry: {
    maxAttempts: "scalar",
    delay: "scalar",
    mode: "scalar",
    idempotent: "scalar",
    allowedExitCodes: ["scalar"],
  },
  when: "scalar",
  source: {
    type: "scalar",
    repo: "scalar",
    branch: "scalar",
    auth: { username: "scalar", password: "scalar", token: "scalar" },
  },
  approval: {
    required: "scalar",
    type: "scalar",
    plugin: "scalar",
    params: "struct",
  },
  steps: [stepShape],
  target: { type: "scalar", config: "struct" },
  notify: { onSuccess: notifyShape, onFailure: notifyShape },
  triggers: [triggerShape],
  dependsOn: ["scalar"],
};
const specShape = {
  namespace: "scalar",
  version: "scalar",
  variables: "map",
  runtime: {
    type: "scalar",
    image: "scalar",
    env: "map",
    resources: {
      cpuRequest: "scalar",
      cpuLimit: "scalar",
      memoryRequest: "scalar",
      memoryLimit: "scalar",
    },
    config: "struct",
  },
  meta: "struct",
  jobs: [jobShape],
  triggers: [triggerShape],
};
function normalize(value, shape) {
  if (value == null) return undefined;
  if (shape === "scalar")
    return value === "" || value === false || value === 0 ? undefined : value;
  if (shape === "struct") return value;
  if (shape === "map") return Object.keys(value).length ? value : undefined;
  if (Array.isArray(shape))
    return value.length
      ? value.map((entry) => normalize(entry, shape[0]))
      : undefined;
  const result = [];
  for (const [key, entry] of Object.entries(value)) {
    const child = Object.prototype.hasOwnProperty.call(shape, key)
      ? normalize(entry, shape[key])
      : entry;
    if (child !== undefined) result.push([key, child]);
  }
  return result.length ? Object.fromEntries(result) : undefined;
}
export const semanticDefinition = (value) => normalize(value, specShape);

export async function runVisualCIJourney({
  page,
  base,
  output,
  config: input,
  responseFor,
  envelope,
  diagnostics,
  setStage,
  evidence,
}) {
  const config = visualCIConfig(input.visualCI ?? input);
  evidence.projectId = config.projectId;
  evidence.baseDefinitionCommit = config.expectedHeadCommitSha;
  const mark = (step) => {
    assert.ok(visualCISteps.includes(step));
    assert.ok(!evidence.steps.includes(step));
    evidence.steps.push(step);
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const mode = async (name) => {
    const tab = page.getByRole("tab", { name, exact: true });
    await tab.focus();
    await tab.press("Enter");
    assert.equal(await tab.getAttribute("aria-selected"), "true");
  };
  const receive = async (method, path, action) => {
    const response = responseFor(method, path);
    const [result] = await Promise.all([response, action()]);
    return { response: result, detail: await envelope(result) };
  };
  const posts = () =>
    diagnostics.requests.filter(
      (request) =>
        request.method === "POST" &&
        request.path.startsWith("/api/v1/pipelines/"),
    );
  const startPosts = posts().length;
  setStage("visual-ci-create");
  await page.goto(
    `${base}/projects/${encodeURIComponent(config.projectId)}/pipelines`,
  );
  await button("New pipeline").click();
  await page
    .getByLabel("Pipeline name", { exact: true })
    .fill(`Visual CI ${config.marker}`);
  await page.getByLabel("Repository URL", { exact: true }).fill(config.repoUrl);
  await page.getByLabel("Branch", { exact: true }).fill(config.branch);
  await page
    .getByLabel("Definition path", { exact: true })
    .fill(config.pipelineFilePath);
  const created = await receive("POST", "/pipelines/", () =>
    button("Create pipeline").click(),
  );
  const pipelineId = created.detail.pipelineID;
  assert.match(pipelineId, boundedId);
  evidence.pipelineId = pipelineId;
  const path = `/pipelines/${encodeURIComponent(pipelineId)}`;
  await page.waitForURL(
    (url) => url.searchParams.get("pipeline") === pipelineId,
  );
  mark("pipeline-created");
  const loaded = await receive("GET", `${path}/spec`, () =>
    button("Definition").click(),
  );
  const initial = loaded.detail;
  assert.equal(initial.headCommitSha, config.expectedHeadCommitSha);
  assert.equal(initial.format, "SPEC_FORMAT_JSON");
  assert.deepEqual(
    semanticDefinition(initial.spec),
    semanticDefinition(config.expectedSpec),
  );
  assert.equal(initial.deploymentPlan, null);
  assert.equal(initial.deploymentReviewError || "", "");
  const expected = structuredClone(initial.spec);
  const command = (suffix) => `printf '${config.marker}_${suffix}\\n'`;
  setStage("visual-ci-edit");
  await mode("Graph");
  await page
    .getByLabel("Command for original-step", { exact: true })
    .fill(command("EDITED"));
  expected.jobs[0].steps[0].args.run = command("EDITED");
  await page.getByLabel("New step name", { exact: true }).fill("visual-verify");
  await button("Add step").click();
  await page
    .getByLabel("Command for visual-verify", { exact: true })
    .fill(command("VERIFY"));
  expected.jobs[0].steps.push({
    name: "visual-verify",
    uses: "shell",
    action: "run",
    args: { run: command("VERIFY") },
    runOnAgent: true,
  });
  await page.getByLabel("New job name", { exact: true }).fill("visual-package");
  await button("Add job").click();
  await page
    .getByRole("checkbox", { name: "visual-build", exact: true })
    .check();
  await page
    .getByLabel("Command for step-1", { exact: true })
    .fill(command("PACKAGE"));
  expected.jobs.push({
    name: "visual-package",
    dependsOn: ["visual-build"],
    steps: [
      {
        name: "step-1",
        uses: "shell",
        action: "run",
        args: { run: command("PACKAGE") },
        runOnAgent: true,
      },
    ],
  });
  await mode("JSON");
  assert.deepEqual(
    JSON.parse(await page.getByLabel("Pipeline definition JSON").inputValue()),
    expected,
  );
  mark("graph-edited");
  await mode("Graph");
  await button("Job visual-build").click();
  await page
    .getByRole("checkbox", { name: "visual-package", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "cycle" }).waitFor();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "visual-package", exact: true })
      .isChecked(),
    false,
  );
  await mode("JSON");
  assert.deepEqual(
    JSON.parse(await page.getByLabel("Pipeline definition JSON").inputValue()),
    expected,
  );
  mark("cycle-rejected");
  await mode("Graph");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 1050 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "The page must fit the viewport",
    );
    await assertControlReachable(button("Job visual-build"));
    await assertControlReachable(button("Job visual-package"));
    await assertControlReachable(button("Validate"));
    await page.screenshot({
      path: `${output}/visual-ci-graph-${viewport.width}.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(
    posts()
      .slice(startPosts)
      .map((request) => request.path),
    ["/api/v1/pipelines/"],
    "Graph edits must never save, trigger, cancel or approve",
  );
  setStage("visual-ci-validate");
  const validated = await receive("POST", `${path}/spec/validate`, () =>
    button("Validate").click(),
  );
  assert.deepEqual(validated.response.request().postDataJSON().spec, expected);
  assert.equal(validated.detail.jobsCount, 2);
  mark("draft-validated");
  setStage("visual-ci-save");
  const saved = await receive("POST", `${path}/spec/save`, () =>
    button("Save to repository").click(),
  );
  const saveBody = saved.response.request().postDataJSON();
  assert.deepEqual(saveBody.spec, expected);
  assert.equal(saveBody.expectedHeadCommitSha, config.expectedHeadCommitSha);
  assert.equal(saveBody.format, "json");
  assert.match(saveBody.requestId, /^[a-zA-Z0-9-]{1,64}$/);
  assert.match(saved.detail.commitSha, sha);
  assert.notEqual(saved.detail.commitSha, config.expectedHeadCommitSha);
  assert.equal(saved.detail.prUrl || "", "");
  evidence.savedDefinitionCommit = saved.detail.commitSha;
  mark("definition-saved");
  await page
    .getByText(`Committed ${saved.detail.commitSha.slice(0, 12)} to main.`, {
      exact: true,
    })
    .waitFor();
  setStage("visual-ci-reload");
  await button("Reload definition").click();
  const reloaded = await receive("GET", `${path}/spec`, () =>
    button("Reload and discard draft").click(),
  );
  assert.equal(reloaded.detail.headCommitSha, saved.detail.commitSha);
  assert.deepEqual(
    semanticDefinition(reloaded.detail.spec),
    semanticDefinition(expected),
  );
  await page
    .getByText(`Based on commit ${saved.detail.commitSha}`, { exact: true })
    .waitFor();
  await mode("JSON");
  assert.deepEqual(
    semanticDefinition(
      JSON.parse(
        await page.getByLabel("Pipeline definition JSON").inputValue(),
      ),
    ),
    semanticDefinition(expected),
  );
  mark("definition-reloaded");
  await button("Close").first().click();
  assert.deepEqual(
    posts()
      .slice(startPosts)
      .map((request) => request.path),
    [
      "/api/v1/pipelines/",
      `/api/v1${path}/spec/validate`,
      `/api/v1${path}/spec/validate`,
      `/api/v1${path}/spec/save`,
    ],
  );
  setStage("visual-ci-trigger");
  const reviewed = await receive("GET", `${path}/spec`, () =>
    button("Run pipeline").click(),
  );
  assert.equal(reviewed.detail.headCommitSha, saved.detail.commitSha);
  assert.equal(reviewed.detail.deploymentPlan, null);
  let runId;
  const terminal = page.waitForResponse(
    async (response) => {
      if (
        !runId ||
        response.request().method() !== "GET" ||
        new URL(response.url()).pathname !==
          `/api/v1${path}/runs/${encodeURIComponent(runId)}` ||
        !response.ok()
      )
        return false;
      const body = await response.json();
      return [
        3,
        4,
        5,
        "PIPELINE_STATUS_SUCCESS",
        "PIPELINE_STATUS_FAILED",
        "PIPELINE_STATUS_CANCELLED",
      ].includes(body.detail?.status);
    },
    { timeout: 180000 },
  );
  void terminal.catch(() => {});
  const triggered = await receive("POST", `${path}/trigger`, () =>
    button("Start run").click(),
  );
  assert.equal(
    triggered.response.request().postDataJSON().expectedDefinitionCommitSha,
    saved.detail.commitSha,
  );
  assert.equal(
    triggered.response.request().postDataJSON().allowDeployments,
    false,
  );
  runId = triggered.detail.runID;
  assert.match(runId, boundedId);
  evidence.runId = runId;
  mark("run-triggered");
  setStage("visual-ci-execution");
  const run = await envelope(await terminal);
  assert.equal(run.runId, runId);
  assert.ok([3, "PIPELINE_STATUS_SUCCESS"].includes(run.status));
  assert.equal(run.definitionCommitSha, saved.detail.commitSha);
  const jobs = await receive(
    "GET",
    `${path}/runs/${encodeURIComponent(runId)}/jobs`,
    () => button("Refresh execution").click(),
  );
  assert.equal(jobs.detail.total, 2);
  assert.equal(jobs.detail.list.length, 2);
  for (const wanted of expected.jobs) {
    const job = jobs.detail.list.find((item) => item.jobName === wanted.name);
    assert.ok(job);
    assert.equal(job.pipelineRunId, runId);
    assert.ok(job.agentId);
    assert.equal(job.status, 4);
    assert.deepEqual(
      job.steps.map((step) => step.name),
      wanted.steps.map((step) => step.name),
    );
    for (const step of job.steps) {
      assert.ok(step.stepRunId);
      assert.equal(step.status, 4);
      assert.equal(step.exitCode, 0);
    }
    assert.equal(job.sourceExpectationCaptured, true);
    assert.equal(job.sourceType || "", "");
    assert.equal(job.sourceRepository || "", "");
    assert.equal(job.sourceResolvedCommit || "", "");
    assert.notEqual(job.sourceProvenanceState, "reported");
    await page
      .getByRole("region", {
        name: `${wanted.name} initial checkout`,
        exact: true,
      })
      .getByText("No source checkout was configured for this job.", {
        exact: true,
      })
      .waitFor();
  }
  mark("jobs-succeeded");
  mark("source-unknown");
  for (const suffix of ["EDITED", "VERIFY", "PACKAGE"])
    await page
      .getByLabel("Execution logs", { exact: true })
      .filter({ hasText: `${config.marker}_${suffix}` })
      .waitFor({ timeout: 45000 });
  mark("logs-verified");
  assert.deepEqual(
    posts()
      .slice(startPosts)
      .map((request) => request.path),
    [
      "/api/v1/pipelines/",
      `/api/v1${path}/spec/validate`,
      `/api/v1${path}/spec/validate`,
      `/api/v1${path}/spec/save`,
      `/api/v1${path}/trigger`,
    ],
  );
  await page.screenshot({
    path: `${output}/visual-ci-real-run.png`,
    fullPage: true,
  });
  return visualCIEvidence(evidence);
}
