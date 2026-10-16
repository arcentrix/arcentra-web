/**
 * Real-browser / real-Control / real-Agent acceptance against disposable local
 * dependencies. No API response fixtures, session seeding, or remote services.
 */
import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import {
  actualBackendConfig,
  assertFirstBuildSnapshot,
  firstBuildConfiguredSteps,
  firstBuildPreflightSteps,
  preflightStepsFromSummary,
  runBrowserTest,
  selectedRunStatus,
  writeCompletedBuildReceipt,
} from "./browser-harness.mjs";
import {
  applyArtifactRunFilter,
  assertArtifactControlLayout,
  assertControlReachable,
} from "./artifact-controls.mjs";
import {
  buildContract,
  saveBuildDownloads,
  verifyBuildDownloads,
  waitForFixedSource,
  writeBuildReceipt,
} from "./stdlib-build-contract.mjs";

// Validate all prerequisites before starting any server or browser. This mode
// cannot silently fall back to the simulated-transport regression suite.
const config = actualBackendConfig();
const projectBuild = config.artifactMode === buildContract.version;
const preflight = config.phase === "preflight";
const firstBuildEvidence = projectBuild
  ? { phase: config.phase, sourceCommit: config.expectedCommit, steps: [] }
  : undefined;
let successfulBuild;
await runBrowserTest(
  "actual-backend",
  async ({ page, base, output, diagnostics, expectHttpError, setStage }) => {
    const receipt = {
      kind: "actual-backend",
      phase: config.phase,
      syntheticData: true,
      steps: [],
    };
    const productMutations = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (
        path.startsWith("/api/") &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        path !== "/api/v1/users/login"
      )
        productMutations.push({ method: request.method(), path });
    });
    if (projectBuild && !preflight) {
      setStage("first-build-preflight-evidence");
      // The first invocation wrote this allowlisted summary only after its
      // browser/network safeguards passed. The final summary retains those
      // fixed same-source facts; these are explicitly separate contexts.
      const prior = await readFile(`${output}/summary.json`, "utf8");
      assert.ok(
        Buffer.byteLength(prior) <= 4096,
        "Preflight summary must be bounded",
      );
      firstBuildEvidence.steps.push(
        ...preflightStepsFromSummary(JSON.parse(prior), config.expectedCommit),
      );
    }
    const record = async (step, details = {}) => {
      receipt.steps.push({ step, ...details });
      await writeFile(
        `${output}/${preflight ? "preflight-" : ""}journey.json`,
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
    if (preflight) firstBuildEvidence.steps.push(firstBuildPreflightSteps[0]);
    setStage("first-build-status");
    const setupResponse = responseFor("GET", "/me/first-build");
    const initialProjects = responseFor("GET", "/project/");
    setupResponse.catch(() => {});
    initialProjects.catch(() => {});
    await page.goto(`${base}/projects`);
    await page
      .getByRole("heading", { name: "Projects", exact: true })
      .waitFor();
    const initialProjectList = await envelope(await initialProjects);
    assert.equal(
      initialProjectList.total,
      0,
      "Both first-use phases start before project creation",
    );
    assert.equal((initialProjectList.list || []).length, 0);
    assertFirstBuildSnapshot(await envelope(await setupResponse), !preflight);
    const assertVisibleSetup = async () => {
      await page
        .getByRole("button", {
          name: "First build setup",
          exact: true,
          expanded: true,
        })
        .waitFor();
      const snapshot = page.getByRole("list", {
        name: "Setup snapshot",
        exact: true,
      });
      await snapshot.waitFor();
      for (const text of [
        "No authorized organization scopes were returned.",
        "Your platform permission allows you to enter an existing administrator-approved scope ID.",
        preflight
          ? "Not configured. An administrator must configure enabled default storage through the setup API/CLI."
          : "Configured (persisted record).",
        preflight
          ? "Not configured. An administrator must configure Agent signing through the setup API/CLI."
          : "Configured (persisted values).",
        preflight
          ? "No enabled Agent was seen recently."
          : "An enabled Agent was seen recently.",
      ])
        await snapshot.getByText(text, { exact: false }).waitFor();
      await page
        .getByText("Configured means saved, not connectivity tested.", {
          exact: false,
        })
        .waitFor();
    };
    await assertVisibleSetup();
    firstBuildEvidence?.steps.push(
      preflight ? firstBuildPreflightSteps[1] : firstBuildConfiguredSteps[0],
    );
    await record(
      preflight ? firstBuildPreflightSteps[1] : firstBuildConfiguredSteps[0],
    );
    await page.screenshot({
      path: `${output}/${preflight ? "preflight-01-first-build-missing" : "00-first-build-configured"}.png`,
      fullPage: true,
    });
    setStage("first-build-refresh");
    const refreshedSetup = responseFor("GET", "/me/first-build");
    await page
      .getByRole("button", { name: "Refresh first-build status", exact: true })
      .click();
    assertFirstBuildSnapshot(await envelope(await refreshedSetup), !preflight);
    await assertVisibleSetup();
    firstBuildEvidence?.steps.push(
      preflight ? firstBuildPreflightSteps[2] : firstBuildConfiguredSteps[1],
    );
    await record(
      preflight ? firstBuildPreflightSteps[2] : firstBuildConfiguredSteps[1],
    );
    await page.screenshot({
      path: `${output}/${preflight ? "preflight-02-first-build-refreshed" : "01-projects-before-create"}.png`,
      fullPage: true,
    });
    if (preflight) {
      assert.equal(
        productMutations.length,
        0,
        "First-use preflight must not mutate product state",
      );
      firstBuildEvidence.steps.push(firstBuildPreflightSteps[3]);
      await record(firstBuildPreflightSteps[3]);
      setStage("preflight-complete");
      return;
    }
    setStage("project-create");

    // Dismissal must not create a project. The real backend starts empty.
    await page
      .getByRole("button", { name: "New project", exact: true })
      .click();
    await page
      .getByText(
        "Enter a stable organization scope ID approved by your administrator. Creating a project does not create an organization. Organization and member management are not available yet.",
        { exact: true },
      )
      .waitFor();
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
    const executeReviewedRun = async (expectedCommit, success) => {
      setStage("definition-review");
      const definitionResponse = responseFor(
        "GET",
        `/pipelines/${encodeURIComponent(pipelineId)}/spec`,
      );
      await page
        .getByRole("button", { name: "Run pipeline", exact: true })
        .click();
      const definition = await envelope(await definitionResponse);
      assert.match(
        definition.headCommitSha,
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i,
      );
      if (expectedCommit)
        assert.equal(definition.headCommitSha, expectedCommit);
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
        path: `${output}/02-reviewed-${success ? "real" : "broken"}-definition.png`,
        fullPage: true,
      });
      // Only observe this selected run's real terminal polling response.
      setStage("trigger-run");
      let runId;
      const terminalResponse = page.waitForResponse(
        async (response) => {
          if (
            !runId ||
            response.request().method() !== "GET" ||
            new URL(response.url()).pathname !==
              `/api/v1/pipelines/${encodeURIComponent(pipelineId)}/runs/${encodeURIComponent(runId)}` ||
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
      await page
        .getByRole("button", { name: "Start run", exact: true })
        .click();
      ({ runID: runId } = await envelope(await trigger));
      assert.ok(runId, "Trigger must return the persisted run ID");
      await page.waitForURL((url) => url.searchParams.get("run") === runId);
      await record("trigger-reviewed-definition-via-ui", {
        runId,
        definitionCommitSha: definition.headCommitSha,
      });
      setStage("terminal-response");
      const run = await envelope(await terminalResponse);
      assert.equal(
        run.runId || run.run_id,
        runId,
        "Terminal response must belong to this run",
      );
      assert.ok(
        (success
          ? [3, "3", "success", "PIPELINE_STATUS_SUCCESS"]
          : [4, "4", "failed", "PIPELINE_STATUS_FAILED"]
        ).includes(run.status),
        `Real Agent execution ended with ${run.status}`,
      );
      if (projectBuild)
        assert.equal(
          run.definitionCommitSha,
          expectedCommit,
          "Stored run must bind the reviewed definition",
        );
      setStage(success ? "visible-run-success" : "compiler-failure");
      await selectedRunStatus(
        page,
        runId,
        success ? "Success" : "Failed",
      ).waitFor();
      setStage("persisted-run-logs");
      const logs = page.getByLabel("Execution logs", { exact: true });
      const requiredLogs = !projectBuild
        ? ["arcentra-real-stack-acceptance"]
        : success
          ? [
              "ACTUAL_PROJECT_TOOLCHAIN go1.25.6",
              "ACTUAL_PROJECT_TEST",
              "ACTUAL_PROJECT_BUILD",
              "ACTUAL_PROJECT_BEHAVIOR",
              buildContract.stdout.trim(),
            ]
          : [
              "ACTUAL_PROJECT_TOOLCHAIN go1.25.6",
              "ACTUAL_PROJECT_TEST",
              "undefined: acceptanceCompileError",
            ];
      for (const marker of requiredLogs)
        await logs.filter({ hasText: marker }).waitFor({ timeout: 45_000 });
      setStage("initial-checkout");
      await page
        .getByText("Agent-reported initial checkout", { exact: true })
        .waitFor();
      await page
        .getByRole("region", { name: /initial checkout$/ })
        .getByText(definition.headCommitSha, { exact: true })
        .waitFor();
      if (projectBuild) {
        setStage("build-step-evidence");
        const jobsResponse = responseFor(
          "GET",
          `/pipelines/${encodeURIComponent(pipelineId)}/runs/${encodeURIComponent(runId)}/jobs`,
        );
        await page
          .getByRole("button", { name: "Refresh execution", exact: true })
          .click();
        const jobs = await envelope(await jobsResponse);
        assert.equal(jobs.total, 1);
        assert.equal(jobs.list.length, 1);
        const [job] = jobs.list;
        assert.equal(job.pipelineId, pipelineId);
        assert.equal(job.pipelineRunId, runId);
        assert.ok(job.agentId, "A real assigned Agent must report the job");
        assert.equal(job.sourceExpectationCaptured, true);
        assert.equal(job.sourceType, "git");
        assert.equal(job.sourceRepository, config.repository);
        assert.equal(job.sourceProvenanceState, "reported");
        assert.equal(job.sourceResolvedCommit, expectedCommit);
        assert.equal(job.status, success ? 4 : 5);
        assert.deepEqual(
          job.steps.map((step) => step.name),
          ["toolchain", "test", "build", "verify", "publish"],
        );
        for (const step of job.steps) {
          assert.equal(step.jobRunId, job.jobRunId);
          assert.ok(step.stepRunId);
          assert.equal(
            step.retryMode,
            "",
            "This is a new run, never retry recovery",
          );
          const stepRow = page
            .getByRole("listitem")
            .filter({ has: page.getByText(step.name, { exact: true }) });
          if (success || step.name === "toolchain") {
            assert.equal(step.status, 4);
            await stepRow.getByText("Success", { exact: true }).waitFor();
          } else if (step.name === "test") {
            assert.equal(step.status, 5);
            assert.ok(
              Number.isInteger(step.exitCode) && step.exitCode > 0,
              "Compiler error must persist a nonzero exit code",
            );
            await stepRow.getByText("Failed", { exact: true }).waitFor();
            await stepRow
              .getByText(`Exit code ${step.exitCode}`, { exact: true })
              .waitFor();
          } else {
            assert.equal(
              step.status,
              8,
              "Build, verify, and publish must be skipped after compilation fails",
            );
            await stepRow.getByText("Skipped", { exact: true }).waitFor();
          }
        }
      }
      await page.screenshot({
        path: `${output}/03-real-agent-run-${success ? "success" : "compiler-failure"}.png`,
        fullPage: true,
      });
      await record(
        success
          ? "real-agent-success-with-persisted-logs-and-checkout"
          : "real-agent-compiler-failure-with-persisted-step-and-checkout",
        { runId, sourceCommit: definition.headCommitSha },
      );
      return { runId, definition, runURL: page.url() };
    };
    let expectedCommit = config.expectedCommit;
    let failedRun;
    if (projectBuild) {
      failedRun = await executeReviewedRun(expectedCommit, false);
      setStage("failed-run-artifacts");
      await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
      await applyArtifactRunFilter(page, project.projectId, failedRun.runId, {
        expectEmpty: true,
      });
      await page.screenshot({
        path: `${output}/03-compiler-failure-no-artifacts.png`,
        fullPage: true,
      });
      await record("compiler-failure-published-zero-artifacts", {
        runId: failedRun.runId,
      });
      await writeBuildReceipt(config, "failed-run.json", {
        projectId: project.projectId,
        pipelineId,
        runId: failedRun.runId,
        sourceCommit: expectedCommit,
      });
      setStage("await-source-fix");
      expectedCommit = await waitForFixedSource(config);
      await page.goto(failedRun.runURL);
      await selectedRunStatus(page, failedRun.runId, "Failed").waitFor();
    }
    const { runId, definition, runURL } = await executeReviewedRun(
      expectedCommit,
      true,
    );
    if (failedRun)
      assert.notEqual(
        runId,
        failedRun.runId,
        "The source fix must run as a distinct persisted run",
      );
    setStage("reload-run");
    await page.reload();
    await page.getByRole("heading", { name: "Execution details" }).waitFor();
    await selectedRunStatus(page, runId, "Success").waitFor();
    await record("run-survives-browser-reload");

    setStage("artifact-filter");
    await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
    await page.getByRole("table", { name: "Project artifacts" }).waitFor();
    const filteredArtifacts = await applyArtifactRunFilter(
      page,
      project.projectId,
      runId,
    );
    const artifact = filteredArtifacts.find(
      (value) => value.name === config.artifactName,
    );
    assert.ok(
      artifact,
      "The expected Agent artifact must appear in the filtered response",
    );
    const downloadArtifact = async (item) => {
      const downloadPath = `/projects/${encodeURIComponent(project.projectId)}/artifacts/${encodeURIComponent(item.artifactId)}/download`;
      const downloadButton = page.getByRole("button", {
        name: `Download ${item.name}`,
        exact: true,
      });
      await assertControlReachable(downloadButton);
      setStage("artifact-download-click");
      const response = responseFor("GET", downloadPath);
      const [downloadResponse, download] = await Promise.all([
        response,
        page.waitForEvent("download"),
        downloadButton.click(),
      ]);
      assert.equal(
        downloadResponse.status(),
        200,
        "Artifact download HTTP response must succeed",
      );
      assert.equal(download.suggestedFilename(), item.name);
      assert.equal(await download.failure(), null);
      setStage("artifact-download-save");
      const path = await download.path();
      const info = await stat(path);
      assert.ok(info.isFile());
      if (projectBuild)
        assert.ok(
          info.size > 0 &&
            info.size <=
              (item.name === config.manifestName ? 16_384 : 64 * 1024 * 1024),
          "Downloaded fixture bytes must be bounded before reading",
        );
      return readFile(path);
    };
    setStage("artifact-download");
    const artifactBytes = await downloadArtifact(artifact);
    let manifestBytes;
    let manifest;
    if (projectBuild) {
      assert.deepEqual(
        filteredArtifacts.map((item) => item.name).sort(),
        [config.artifactName, config.manifestName].sort(),
        "Only the declared binary and manifest may be published",
      );
      setStage("manifest-download");
      manifestBytes = await downloadArtifact(
        filteredArtifacts.find((item) => item.name === config.manifestName),
      );
      setStage("verify-build-downloads");
      manifest = verifyBuildDownloads(
        manifestBytes,
        artifactBytes,
        expectedCommit,
      );
    } else {
      assert.deepEqual(
        artifactBytes,
        Buffer.from(config.artifactContent),
        "Downloaded bytes must equal the real Agent-produced artifact exactly",
      );
    }
    await record("download-real-agent-artifact-via-ui", {
      artifactName: config.artifactName,
      bytes: artifactBytes.length,
      ...(manifest
        ? {
            sourceCommit: manifest.sourceCommit,
            goVersion: manifest.goVersion,
            sha256: manifest.binary.sha256,
          }
        : {}),
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
      const refreshResponse = await refreshed;
      assert.equal(
        new URL(refreshResponse.url()).searchParams.get("runId"),
        runId,
      );
      const refreshedArtifacts = await envelope(refreshResponse);
      assert.ok(
        refreshedArtifacts.list.every((item) => item.pipelineRunId === runId),
      );
      assert.deepEqual(
        refreshedArtifacts.list.map((item) => item.artifactId).sort(),
        filteredArtifacts.map((item) => item.artifactId).sort(),
        "Refresh must preserve this run's exact artifacts",
      );
      const downloaded = await downloadArtifact(artifact);
      assert.deepEqual(
        downloaded,
        artifactBytes,
        "Repeated viewport downloads must preserve exact binary/text bytes",
      );
      if (projectBuild)
        verifyBuildDownloads(manifestBytes, downloaded, expectedCommit);
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
    if (projectBuild) {
      await page.goto(failedRun.runURL);
      await selectedRunStatus(page, failedRun.runId, "Failed").waitFor();
      await page
        .getByRole("region", { name: /initial checkout$/ })
        .getByText(config.expectedCommit, { exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
      await applyArtifactRunFilter(page, project.projectId, failedRun.runId, {
        expectEmpty: true,
      });
      await page.goto(runURL);
      await selectedRunStatus(page, runId, "Success").waitFor();
      await page
        .getByRole("region", { name: /initial checkout$/ })
        .getByText(expectedCommit, { exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
      const persisted = await applyArtifactRunFilter(
        page,
        project.projectId,
        runId,
      );
      assert.deepEqual(
        persisted.map((item) => item.name).sort(),
        [config.artifactName, config.manifestName].sort(),
      );
      const persistedBinary = await downloadArtifact(
        persisted.find((item) => item.name === config.artifactName),
      );
      const persistedManifest = await downloadArtifact(
        persisted.find((item) => item.name === config.manifestName),
      );
      assert.deepEqual(persistedBinary, artifactBytes);
      assert.deepEqual(persistedManifest, manifestBytes);
      verifyBuildDownloads(persistedManifest, persistedBinary, expectedCommit);
      await record(
        "failed-run-remains-failed-and-fixed-downloads-survive-reauthentication",
      );
    }
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
      projectBuild ? 2 : 1,
    );
    await record("journey-complete");
    if (projectBuild) {
      setStage("save-build-downloads");
      await saveBuildDownloads(
        config,
        manifestBytes,
        artifactBytes,
        expectedCommit,
      );
      successfulBuild = {
        projectId: project.projectId,
        pipelineId,
        runId,
        sourceCommit: definition.headCommitSha,
      };
    }
    setStage("journey-complete");
  },
  {
    backend: config.backend,
    totalTimeoutMs: preflight ? 90_000 : projectBuild ? 600_000 : 300_000,
    firstBuildEvidence,
  },
);
// The backend may verify/execute its trusted fixture only after the browser
// journey AND the harness console/network/error safeguards have all passed.
await writeCompletedBuildReceipt(config, successfulBuild, writeBuildReceipt);
