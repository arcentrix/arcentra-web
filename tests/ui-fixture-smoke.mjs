/** Fixture-driven browser regression test. This does not replace real backend integration tests. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = process.env.UI_TEST_BASE_URL || "http://127.0.0.1:5174";
const output = process.env.UI_TEST_OUTPUT_DIR || "/tmp/arcentra-web-ui";
const server = process.env.UI_TEST_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5174",
        "--strictPort",
      ],
      { stdio: "ignore" },
    );
let browser;
try {
  await mkdir(output, { recursive: true });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (i === 99) throw new Error("Vite did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "ARCADE_TOKENS",
      JSON.stringify({
        value: {
          accessToken: "local-ui-fixture",
          refreshToken: "local-ui-fixture",
        },
        expire: null,
      }),
    ),
  );
  const pipeline = {
    pipelineId: "pipeline-1",
    projectId: "project-1",
    name: "Build API",
    description: "Compile, test and package the API service",
    repoUrl: "https://example.com/api.git",
    defaultBranch: "main",
    pipelineFilePath: ".arcentra/pipeline.yaml",
    isEnabled: 1,
    totalRuns: 1,
    status: "PIPELINE_STATUS_RUNNING",
  };
  const project = {
    projectId: "project-1",
    orgId: "org-1",
    name: "api-service",
    displayName: "API service",
    description: "Core API build pipeline",
    repoUrl: pipeline.repoUrl,
    defaultBranch: "main",
    isEnabled: 1,
  };
  let run = {
    runId: "run-1",
    pipelineId: pipeline.pipelineId,
    pipelineName: pipeline.name,
    branch: "main",
    commitSha: "abc123456789",
    status: "PIPELINE_STATUS_RUNNING",
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    startTime: Math.floor(Date.now() / 1000),
    duration: 1234,
  };
  let artifactMode = "normal";
  let artifactLists = 0;
  let artifactDownloads = 0;
  const artifactBytes = '{"fixture":"artifact download bytes"}\n';
  const artifactRows = Array.from({ length: 21 }, (_, index) => ({
    artifactId: `artifact-${index + 1}`,
    projectId: project.projectId,
    pipelineId: pipeline.pipelineId,
    pipelineRunId: "run-1",
    jobRunId: "job-1",
    stepRunId: "step-1",
    name: `report-${String(index + 1).padStart(2, "0")}.json`,
    size: artifactBytes.length,
    sizeKnown: true,
    mediaType: "application/json",
    storageType: "local",
    createdAt: "2026-10-12T00:00:00Z",
    status: index === 20 ? "expired" : "available",
    downloadAvailable: index !== 20,
    ...(index === 20 ? { unavailableReason: "Retention period ended" } : {}),
  }));
  let mode = "normal";
  let starts = 0;
  let cancellations = 0;
  let saves = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const ok = (detail) => route.fulfill({ json: { code: 200, detail } });
    if (path === "/me/menus")
      return ok([
        {
          menuId: "build",
          name: "Build",
          path: "/build",
          component: "Build",
          isEnabled: true,
        },
        {
          menuId: "projects",
          name: "Projects",
          path: "/projects",
          component: "Projects",
          isEnabled: true,
        },
      ]);
    if (path === "/me/routes") return ok(["/build", "/projects"]);
    if (path === "/me/effective-actions")
      return ok(artifactMode === "restricted" ? [] : ["*:*"]);
    if (path === "/projects/project-1/artifacts") {
      artifactLists++;
      if (artifactMode === "restricted")
        return route.fulfill({
          status: 403,
          json: { code: 403, errMsg: "Artifact access denied" },
        });
      if (artifactMode === "error")
        return route.fulfill({
          status: 503,
          json: { code: 500, errMsg: "Artifact storage unavailable" },
        });
      const pageNum = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 20);
      const name = url.searchParams.get("name") || "";
      const runId = url.searchParams.get("runId");
      const status = url.searchParams.get("status");
      const rows =
        artifactMode === "empty"
          ? []
          : artifactRows.filter(
              (row) =>
                row.name.includes(name) &&
                (!runId || row.pipelineRunId === runId) &&
                (!status || row.status === status),
            );
      return ok({
        list: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
        total: rows.length,
        page: pageNum,
        pageSize,
      });
    }
    if (path === "/projects/project-1/artifacts/artifact-1/download") {
      artifactDownloads++;
      return route.fulfill({
        status: 200,
        body: artifactBytes,
        headers: {
          "content-type": "application/json",
          "content-disposition": 'attachment; filename="report-01.json"',
        },
      });
    }
    if (path === "/users/fetch")
      return ok({
        userId: "ui-test",
        username: "UI fixture",
        email: "test@example.com",
      });
    if (path === "/pipelines/" && request.method() === "GET") {
      if (mode === "error")
        return route.fulfill({
          status: 503,
          json: {
            code: 500,
            errMsg: "Control service temporarily unavailable",
          },
        });
      return ok({
        list: mode === "empty" ? [] : [pipeline],
        total: mode === "empty" ? 0 : 1,
        page: 1,
        pageSize: 20,
      });
    }
    if (path === "/project/")
      return ok({ list: [project], total: 1, pageNum: 1, pageSize: 20 });
    if (path === "/project/project-1") return ok(project);
    if (path === "/agent")
      return ok({
        agents: [
          {
            agentId: "agent-1",
            agentName: "Linux builder",
            os: "linux",
            arch: "amd64",
            status: 4,
            isEnabled: 1,
          },
        ],
        count: 1,
      });
    if (path === "/pipelines/pipeline-1") return ok(pipeline);
    if (path === "/pipelines/pipeline-1/runs") {
      const filter = url.searchParams.get("status");
      const status = run.status.replace("PIPELINE_STATUS_", "").toLowerCase();
      return ok({
        list: !filter || filter === status ? [run] : [],
        total: !filter || filter === status ? 1 : 0,
        page: 1,
        pageSize: 20,
      });
    }
    if (path === "/pipelines/pipeline-1/trigger") {
      starts++;
      assert.ok(request.postDataJSON().requestId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      run = {
        ...run,
        runId: `run-${starts + 1}`,
        status: "PIPELINE_STATUS_PENDING",
      };
      return ok({ runID: run.runId });
    }
    if (/\/runs\/[^/]+\/stop$/.test(path)) {
      cancellations++;
      run = { ...run, status: "PIPELINE_STATUS_CANCELLED" };
      return ok({});
    }
    if (/\/runs\/[^/]+\/jobs$/.test(path))
      return ok({
        list: [
          {
            jobRunId: "job-1",
            jobName: "Build and test",
            agentId: "agent-1",
            status: run.status.includes("CANCELLED") ? 6 : 3,
            duration: 1234,
            steps: [
              {
                stepRunId: "step-1",
                name: "Compile API",
                status: 4,
                duration: 1000,
                exitCode: 0,
              },
              {
                stepRunId: "step-2",
                name: "Run tests",
                status: run.status.includes("CANCELLED") ? 6 : 3,
                duration: 234,
                exitCode: null,
              },
            ],
          },
        ],
        total: 1,
      });
    if (/\/runs\/[^/]+\/logs$/.test(path))
      return ok({
        entries: [
          {
            timestamp: "2026-10-11T09:00:00Z",
            level: "info",
            message: "Fixture: compiling API…",
          },
          {
            timestamp: "2026-10-11T09:00:01Z",
            level: "info",
            message: "Fixture: 12 tests passed",
          },
        ],
        truncated: false,
      });
    if (/\/runs\/[^/]+$/.test(path)) return ok(run);
    if (path === "/pipelines/pipeline-1/spec")
      return ok({
        spec: {
          name: "Build API",
          jobs: [
            {
              name: "build",
              steps: [{ name: "Compile", run: "go build ./..." }],
            },
          ],
        },
        format: "SPEC_FORMAT_JSON",
        headCommitSha: "definition-abc123",
        branch: "main",
        pipelineFilePath: pipeline.pipelineFilePath,
      });
    if (path.endsWith("/spec/validate"))
      return ok({ jobsCount: 1, warnings: [] });
    if (path.endsWith("/spec/save")) {
      saves++;
      assert.equal(
        request.postDataJSON().expectedHeadCommitSha,
        "definition-abc123",
      );
      return ok({ commitSha: "saved-def456", prUrl: "" });
    }
    return ok({});
  });
  await page.goto(`${base}/build`);
  await page.getByText("Fixture: 12 tests passed", { exact: false }).waitFor();
  await page.screenshot({
    path: `${output}/build-desktop-fixture.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Run pipeline", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(starts, 0, "Dismissing the run form must not execute");
  await page.getByRole("button", { name: "Run pipeline", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Variables (JSON)" })
    .fill('{"ENV": "test"}');
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Starting…", exact: true })
      .isDisabled(),
    true,
  );
  await page.waitForURL(/run=run-2/);
  assert.equal(starts, 1);
  await page.getByRole("button", { name: "Cancel run", exact: true }).click();
  await page.getByRole("button", { name: "Keep running", exact: true }).click();
  assert.equal(cancellations, 0);
  await page.getByRole("button", { name: "Cancel run", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.body.textContent.includes("Cancelled") &&
      !document.querySelector('[role="dialog"]'),
  );
  assert.equal(cancellations, 1);
  await page.getByRole("button", { name: "Definition", exact: true }).click();
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await page.getByText("Valid definition · 1 jobs").waitFor();
  await page
    .getByRole("button", { name: "Save to repository", exact: true })
    .click();
  await page.getByText("Committed saved-def456 to main.").waitFor();
  assert.equal(saves, 1);
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/build-mobile-fixture.png`,
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile viewport must not overflow horizontally",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  mode = "empty";
  await page.goto(`${base}/build`);
  await page.getByText("No pipelines yet.", { exact: false }).waitFor();
  await page.screenshot({
    path: `${output}/build-empty-fixture.png`,
    fullPage: true,
  });
  mode = "error";
  await page.reload();
  await page.getByRole("heading", { name: "Pipelines unavailable" }).waitFor();
  await page.screenshot({
    path: `${output}/build-error-fixture.png`,
    fullPage: true,
  });
  mode = "normal";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .getByRole("button", { name: "Run pipeline", exact: true })
    .waitFor();
  await page.goto(`${base}/projects`);
  await page
    .getByRole("heading", { name: "API service", exact: true })
    .waitFor();
  await page.getByRole("link", { name: /API service/ }).click();
  await page
    .getByRole("button", { name: "View pipelines", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run pipeline", exact: true })
    .waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Pipeline definitions" }).waitFor();
  await page.goto(`${base}/projects/project-1/artifacts`);
  await page.getByRole("table", { name: "Project artifacts" }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Download report-21.json" })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("combobox", { name: "Artifact status" })
    .selectOption("available");
  await page.waitForURL(/status=available/);
  await page.getByText("report-01.json", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.has("page"), false);
  await page.goBack();
  await page.getByText("Page 2 of 2").waitFor();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report-01.json" }).click();
  const downloaded = await downloadEvent;
  assert.equal(downloaded.suggestedFilename(), "report-01.json");
  assert.equal(await readFile(await downloaded.path(), "utf8"), artifactBytes);
  assert.equal(artifactDownloads, 1);
  await page
    .getByRole("textbox", { name: "Run ID", exact: true })
    .fill("missing-run");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByText("No artifacts match your filters.").waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByText("report-01.json", { exact: true }).waitFor();
  const previousLists = artifactLists;
  const refreshResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      "/api/v1/projects/project-1/artifacts",
  );
  await page.getByRole("button", { name: "Refresh artifacts" }).click();
  await refreshResponse;
  await page
    .getByRole("button", { name: "Download report-01.json" })
    .waitFor({ state: "visible" });
  assert.ok(artifactLists > previousLists);
  await page.screenshot({
    path: `${output}/artifacts-desktop-fixture.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/artifacts-mobile-fixture.png`,
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Artifact table must scroll within its panel on mobile",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  artifactMode = "error";
  await page.getByRole("button", { name: "Refresh artifacts" }).click();
  await page.getByRole("heading", { name: "Artifacts unavailable" }).waitFor();
  artifactMode = "empty";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("No artifacts yet.", { exact: false }).waitFor();
  artifactMode = "restricted";
  await page.reload();
  await page
    .getByRole("heading", { name: "Artifact access restricted" })
    .waitFor();
  artifactMode = "normal";
  await page.getByRole("button", { name: "Check access again" }).click();
  await page.getByText("report-01.json", { exact: true }).waitFor();
  assert.deepEqual(
    errors,
    [],
    "Browser must not report uncaught application errors",
  );
  console.log(
    `UI fixture smoke passed: run/dismiss/cancel, definition validate/save, mobile layout, empty/error/retry, project navigation/back, artifact list/filter/pagination/download/access/error/mobile. Screenshots: ${output}`,
  );
} finally {
  await browser?.close();
  server?.kill();
}
