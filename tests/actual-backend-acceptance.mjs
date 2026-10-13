/**
 * Real-browser / real-Control / real-Agent acceptance against disposable local
 * dependencies. No API response fixtures, session seeding, or remote services.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import {
  actualBackendConfig,
  runBrowserTest,
  selectedRunStatus,
} from "./browser-harness.mjs";
import {
  assertArtifactControlLayout,
  assertControlReachable,
} from "./artifact-controls.mjs";

// Validate all prerequisites before starting any server or browser. This mode
// cannot silently fall back to the simulated-transport regression suite.
const config = actualBackendConfig();
await runBrowserTest(
  "actual-backend",
  async ({ page, base, output, diagnostics, expectHttpError, setStage }) => {
    const receipt = { kind: "actual-backend", syntheticData: true, steps: [] };
    const record = async (step, details = {}) => {
      receipt.steps.push({ step, ...details });
      await writeFile(
        `${output}/journey.json`,
        `${JSON.stringify(receipt, null, 2)}\n`,
      );
    };
    const responseFor = (method, path, timeout = 30_000) =>
      page.waitForResponse(
        (response) =>
          response.request().method() === method &&
          new URL(response.url()).pathname === `/api/v1${path}`,
        { timeout },
      );
    const envelope = async (response) => {
      assert.equal(
        response.status(),
        200,
        `${response.request().method()} ${new URL(response.url()).pathname}`,
      );
      const body = await response.json();
      assert.equal(
        body.code,
        200,
        body.errMsg || "Backend envelope must be successful",
      );
      return body.detail;
    };
    const login = async () => {
      await page.goto(`${base}/login`);
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
      await page
        .getByRole("textbox", { name: "Email / Username" })
        .fill(config.username);
      await page.getByLabel("Password", { exact: true }).fill(config.password);
      const response = responseFor("POST", "/users/login");
      const profileResponse = responseFor("GET", "/users/fetch");
      profileResponse.catch(() => {});
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await envelope(await response);
      const userinfo = await envelope(await profileResponse);
      assert.equal(userinfo.username, config.username);
      await page.waitForURL((url) => url.pathname !== "/login");
      return userinfo.fullName || userinfo.username;
    };
    setStage("login");
    const userLabel = await login();
    await record("login-via-real-api");
    setStage("project-create");
    await page.goto(`${base}/projects`);
    await page
      .getByRole("heading", { name: "Projects", exact: true })
      .waitFor();
    await page.screenshot({
      path: `${output}/01-projects-before-create.png`,
      fullPage: true,
    });

    // Dismissal must not create a project. The real backend starts empty.
    await page
      .getByRole("button", { name: "New project", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path === "/api/v1/project/",
      ).length,
      0,
    );
    const projectName = `browser-acceptance-${Date.now()}`;
    await page
      .getByRole("button", { name: "New project", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Organization ID" })
      .fill(config.orgId);
    await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
    await page
      .getByRole("textbox", { name: "Repository URL" })
      .fill(config.repository);
    await page
      .getByRole("textbox", { name: "Default branch" })
      .fill(config.branch);
    const createProject = responseFor("POST", "/project/");
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    const project = await envelope(await createProject);
    assert.ok(
      project.projectId,
      "Real create response must identify the stored project",
    );
    const projectPath = `/projects/${encodeURIComponent(project.projectId)}`;
    await page.waitForURL((url) => url.pathname === `${projectPath}/pipelines`);
    await page
      .getByRole("heading", { name: projectName, exact: true })
      .waitFor();
    await record("create-project-via-ui", { projectId: project.projectId });

    setStage("pipeline-create");
    await page
      .getByRole("button", { name: "New pipeline", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path === "/api/v1/pipelines/",
      ).length,
      0,
    );
    await page
      .getByRole("button", { name: "New pipeline", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Pipeline name" })
      .fill("Real Agent artifact acceptance");
    await page
      .getByRole("textbox", { name: "Repository URL" })
      .fill(config.repository);
    await page
      .getByRole("textbox", { name: "Branch", exact: true })
      .fill(config.branch);
    await page
      .getByRole("textbox", { name: "Definition path" })
      .fill(config.definitionPath);
    const createPipeline = responseFor("POST", "/pipelines/");
    await page
      .getByRole("button", { name: "Create pipeline", exact: true })
      .click();
    const { pipelineID: pipelineId } = await envelope(await createPipeline);
    assert.ok(
      pipelineId,
      "Real create response must identify the stored pipeline",
    );
    await page.waitForURL(
      (url) => url.searchParams.get("pipeline") === pipelineId,
    );
    await record("create-pipeline-via-ui", { pipelineId });

    setStage("definition-review");
    await page
      .getByRole("button", { name: "Run pipeline", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path.endsWith("/trigger"),
      ).length,
      0,
    );
    const definitionResponse = responseFor(
      "GET",
      `/pipelines/${encodeURIComponent(pipelineId)}/spec`,
    );
    await page
      .getByRole("button", { name: "Run pipeline", exact: true })
      .click();
    const definition = await envelope(await definitionResponse);
    assert.match(definition.headCommitSha, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i);
    if (config.expectedCommit)
      assert.equal(definition.headCommitSha, config.expectedCommit);
    assert.equal(
      definition.deploymentPlan,
      null,
      "Acceptance definition must never deploy",
    );
    assert.equal(definition.deploymentReviewError || "", "");
    await page
      .getByText(`Definition revision: ${definition.headCommitSha}`, {
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: `${output}/02-reviewed-real-definition.png`,
      fullPage: true,
    });
    // Observe the browser's real polling response, never fabricate or advance a
    // status in the test. Failure states fail immediately instead of timing out.
    setStage("trigger-run");
    const terminalResponse = page.waitForResponse(
      async (response) => {
        if (
          new URL(response.url()).pathname.split("/").length !== 7 ||
          !new URL(response.url()).pathname.startsWith(
            `/api/v1/pipelines/${encodeURIComponent(pipelineId)}/runs/`,
          ) ||
          !response.ok()
        )
          return false;
        const body = await response.json();
        const status = String(body.detail?.status ?? "")
          .replace("PIPELINE_STATUS_", "")
          .toLowerCase();
        return ["3", "4", "5", "success", "failed", "cancelled"].includes(
          status,
        );
      },
      { timeout: 180_000 },
    );
    terminalResponse.catch(() => {});
    const trigger = responseFor(
      "POST",
      `/pipelines/${encodeURIComponent(pipelineId)}/trigger`,
    );
    await page.getByRole("button", { name: "Start run", exact: true }).click();
    const { runID: runId } = await envelope(await trigger);
    assert.ok(runId, "Trigger must return the persisted run ID");
    await page.waitForURL((url) => url.searchParams.get("run") === runId);
    await record("trigger-reviewed-definition-via-ui", {
      runId,
      definitionCommitSha: definition.headCommitSha,
    });

    setStage("terminal-response");
    const terminal = await terminalResponse;
    const run = await envelope(terminal);
    assert.equal(
      run.runId || run.run_id,
      runId,
      "Terminal response must belong to this run",
    );
    assert.ok(
      [3, "3", "success", "PIPELINE_STATUS_SUCCESS"].includes(run.status),
      `Real Agent execution ended with ${run.status}`,
    );
    setStage("visible-run-success");
    await selectedRunStatus(page, runId, "Success").waitFor();
    setStage("persisted-run-logs");
    await page
      .getByLabel("Execution logs", { exact: true })
      .filter({ hasText: "arcentra-real-stack-acceptance" })
      .waitFor({ timeout: 45_000 });
    setStage("initial-checkout");
    await page
      .getByText("Agent-reported initial checkout", { exact: true })
      .waitFor();
    await page
      .getByRole("region", { name: /initial checkout$/ })
      .getByText(definition.headCommitSha, { exact: true })
      .waitFor();
    await page.screenshot({
      path: `${output}/03-real-agent-run-success.png`,
      fullPage: true,
    });
    await record("real-agent-success-with-persisted-logs-and-checkout");
    const runURL = page.url();
    setStage("reload-run");
    await page.reload();
    await page.getByRole("heading", { name: "Execution details" }).waitFor();
    await selectedRunStatus(page, runId, "Success").waitFor();
    await record("run-survives-browser-reload");

    setStage("artifact-download");
    await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
    await page.getByRole("table", { name: "Project artifacts" }).waitFor();
    await page
      .getByRole("textbox", { name: "Run ID", exact: true })
      .fill(runId);
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await page.waitForURL((url) => url.searchParams.get("runId") === runId);
    await page.getByText(config.artifactName, { exact: true }).waitFor();
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `Download ${config.artifactName}`,
        exact: true,
      })
      .click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), config.artifactName);
    assert.equal(await download.failure(), null);
    const artifactBytes = await readFile(await download.path());
    assert.deepEqual(
      artifactBytes,
      Buffer.from(config.artifactContent),
      "Downloaded bytes must equal the real Agent-produced artifact exactly",
    );
    await record("download-real-agent-artifact-via-ui", {
      artifactName: config.artifactName,
      bytes: artifactBytes.length,
    });
    await page.screenshot({
      path: `${output}/04-real-artifact-download.png`,
      fullPage: true,
    });
    setStage("mobile-layout");
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 1440, height: 1050 },
    ]) {
      await page.setViewportSize(viewport);
      await assertArtifactControlLayout(page, runId);
      const refresh = page.getByRole("button", { name: "Refresh artifacts" });
      await assertControlReachable(refresh);
      const refreshed = responseFor(
        "GET",
        `/projects/${project.projectId}/artifacts`,
      );
      await refresh.click();
      await envelope(await refreshed);
      const downloadButton = page.getByRole("button", {
        name: `Download ${config.artifactName}`,
      });
      await assertControlReachable(downloadButton);
      const event = page.waitForEvent("download");
      await downloadButton.click();
      const file = await event;
      assert.equal(file.suggestedFilename(), config.artifactName);
      assert.equal(await file.failure(), null);
      assert.deepEqual(
        await readFile(await file.path()),
        Buffer.from(config.artifactContent),
      );
      await assertControlReachable(
        page.getByRole("button", { name: "Open Copilot" }),
      );
      await page.screenshot({
        path: `${output}/05-real-artifacts-${viewport.width === 390 ? "mobile" : viewport.width}.png`,
        fullPage: true,
      });
    }
    await record(
      "artifact-controls-reachable-at-mobile-small-mobile-and-desktop",
    );
    await page.setViewportSize({ width: 1440, height: 1050 });

    // Sign out and sign back in using visible controls and actual API requests.
    // An in-flight session probe after logout may legitimately receive 401.
    setStage("reauthenticate");
    expectHttpError("/api/v1/users/fetch", 401);
    expectHttpError("/api/v1/users/refresh", 401);
    await page.getByRole("button", { name: userLabel, exact: true }).click();
    const logout = responseFor("POST", "/users/logout");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await envelope(await logout);
    await page.waitForURL((url) => url.pathname === "/login");
    await login();
    await page.goto(runURL);
    await page.getByRole("heading", { name: "Execution details" }).waitFor();
    await selectedRunStatus(page, runId, "Success").waitFor();
    await record("sign-out-sign-in-and-deep-link-persisted-run");
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path === "/api/v1/project/",
      ).length,
      1,
    );
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path === "/api/v1/pipelines/",
      ).length,
      1,
    );
    assert.equal(
      diagnostics.requests.filter(
        (r) => r.method === "POST" && r.path.endsWith("/trigger"),
      ).length,
      1,
    );
    await record("journey-complete");
    setStage("journey-complete");
  },
  { backend: config.backend },
);
