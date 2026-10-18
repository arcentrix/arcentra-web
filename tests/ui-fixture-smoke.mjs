import {
  projectSecretsFixture,
  assertProjectSecretsFixtureUI,
  syntheticProjectSecretValues,
} from "./project-secrets-fixture.mjs";
import {
  honestyFixture,
  assertHonestyFixtureUI,
  agentFixtureConsumer,
} from "./ui-honesty-fixture.mjs";
import { storageFixture, assertStorageFixtureUI } from "./storage-fixture.mjs";
import { storageSensitiveValues } from "./storage-journey.mjs";
import { pollingFixture, assertPollingSetup } from "./polling-fixture.mjs";
import { retryFixture } from "./retry-approval-fixture.mjs";
import { assertContainerRetryDraft } from "./retry-policy-fixture.mjs";
/** Fixture-driven browser regression test. This does not replace real backend integration tests. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runBrowserTest, selectedRunStatus } from "./browser-harness.mjs";
import {
  applyArtifactRunFilter,
  assertArtifactControlLayout,
  assertControlReachable,
} from "./artifact-controls.mjs";
import { assertCommandBarActions } from "./command-bar-controls.mjs";

await runBrowserTest(
  "simulated-transport",
  async ({
    page,
    base,
    output,
    diagnostics,
    expectHttpError,
    setStage,
    setSensitiveFormOpen,
    protectSensitiveValue,
  }) => {
    setStage("fixture-regression");
    expectHttpError("/api/v1/pipelines/", 503);
    expectHttpError("/api/v1/projects/project-1/artifacts", 403);
    expectHttpError("/api/v1/projects/project-1/artifacts", 503);
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
    let retryApproval = null;
    let approvalVotes = 0;
    let artifactMode = "normal";
    let artifactLists = 0;
    let artifactDownloads = 0;
    const artifactBytes = '{"fixture":"artifact download bytes"}\n';
    const artifactRunId = "01J9K64C7CGS9ZND53Y0DZFT9X";
    const artifactRows = Array.from({ length: 21 }, (_, index) => ({
      artifactId: `artifact-${index + 1}`,
      projectId: project.projectId,
      pipelineId: pipeline.pipelineId,
      pipelineRunId: artifactRunId,
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
    const repositorySpec = {
      name: "Build API",
      jobs: [
        {
          name: "build",
          steps: [{ name: "Compile", run: "go build ./..." }],
        },
      ],
    };
    let firstBuild = {
      scopeOptions: [{ scopeId: "org-1", source: "role_grant" }],
      scopeOptionsTruncated: false,
      canEnterScope: true,
      configuration: {
        access: "visible",
        defaultStorageConfigured: false,
        agentSigningConfigured: false,
      },
      agent: { access: "visible", enabledRecentlySeen: false },
    };
    const polling = pollingFixture();
    const storage = storageFixture();
    const honesty = honestyFixture(project);
    const secrets = projectSecretsFixture(project.projectId);
    let firstBuildError = false;
    let mode = "normal";
    let starts = 0;
    let cancellations = 0;
    let saves = 0;
    await page.route("**/api/v1/**", async (route) => {
      if (await secrets.route(route)) return;
      if (await polling.route(route)) return;
      if (await storage.route(route)) return;
      if (await honesty.route(route)) return;
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/v1", "");
      const ok = (detail) => route.fulfill({ json: { code: 200, detail } });
      if (path === "/me/menus")
        return ok([
          {
            menuId: "dashboard",
            name: "Overview",
            path: "/",
            component: "Dashboard",
            isEnabled: true,
          },
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
          {
            menuId: "settings",
            name: "Settings",
            path: "/settings",
            component: "Settings",
            isEnabled: true,
          },
        ]);
      if (path === "/me/first-build" && request.method() === "GET") {
        if (firstBuildError)
          return route.fulfill({
            status: 503,
            json: { code: 500, errMsg: "Readiness temporarily unavailable" },
          });
        return ok(firstBuild);
      }
      if (path === "/me/routes")
        return ok(["/", "/build", "/projects", "/settings"]);
      if (path === "/me/effective-actions")
        return ok(
          artifactMode === "restricted" || storage.state.mode === "restricted"
            ? []
            : ["*:*"],
        );
      if (path === "/organization" && request.method() === "GET")
        return ok({
          list: [],
          total: 0,
          page: Number(url.searchParams.get("page")),
          pageSize: Number(url.searchParams.get("pageSize")),
          canCreate: false,
        });
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
        // A matching snapshot arrives later than the URL; readiness must wait
        // for this exact filtered response rather than a URL-only check.
        if (runId === artifactRunId)
          await new Promise((resolve) => setTimeout(resolve, 300));
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
      if (path === "/approvals/")
        return ok(retryApproval ? [retryApproval] : []);
      if (path === "/approvals/approval" && request.method() === "GET")
        return ok(retryApproval);
      if (
        path === "/approvals/approval/approve" &&
        request.method() === "POST"
      ) {
        assert.deepEqual(Object.keys(request.postDataJSON()), ["reason"]);
        assert.equal(
          request.postDataJSON().reason,
          "Reviewed pinned source and two attempts",
        );
        approvalVotes++;
        retryApproval = {
          ...retryApproval,
          status: 1,
          approvedCount: 1,
          canApprove: false,
          canReject: false,
          viewerDecision: "approved",
          retryReview: { ...retryApproval.retryReview, status: 1 },
        };
        return ok(retryApproval);
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
      if (path === "/agent") {
        assert.equal(agentFixtureConsumer(request), "build-readiness");
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
          pageNum: 1,
          pageSize: 100,
        });
      }
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
              status: run.status.includes("CANCELLED")
                ? 6
                : run.status.includes("SUCCESS")
                  ? 4
                  : 3,
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
                  status: run.status.includes("CANCELLED")
                    ? 6
                    : run.status.includes("SUCCESS")
                      ? 4
                      : 3,
                  duration: 234,
                  exitCode: run.status.includes("SUCCESS") ? 0 : null,
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
          spec: repositorySpec,
          format: "SPEC_FORMAT_JSON",
          headCommitSha: "a".repeat(40),
          deploymentPlan: null,
          branch: "main",
          pipelineFilePath: pipeline.pipelineFilePath,
        });
      if (path.endsWith("/spec/validate"))
        return ok({ jobsCount: 1, warnings: [] });
      if (path.endsWith("/spec/save")) {
        saves++;
        assert.deepEqual(
          request.postDataJSON().spec,
          repositorySpec,
          "Explicit save must use the restored definition, never a transient retry fixture",
        );
        assert.equal(
          request.postDataJSON().expectedHeadCommitSha,
          "a".repeat(40),
        );
        return ok({
          commitSha: "b".repeat(40),
          saveMode: "PIPELINE_SAVE_MODE_DIRECT",
          prUrl: "",
        });
      }
      diagnostics.unhandledRoutes.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 501,
        json: { code: 501, errMsg: "Unhandled simulated API route" },
      });
    });
    await page.goto(`${base}/build`);
    await page
      .getByText("Fixture: 12 tests passed", { exact: false })
      .waitFor();
    await page.screenshot({
      path: `${output}/build-desktop-fixture.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Run pipeline", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(starts, 0, "Dismissing the run form must not execute");
    await page
      .getByRole("button", { name: "Run pipeline", exact: true })
      .click();
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
    await page
      .getByRole("button", { name: "Keep running", exact: true })
      .click();
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
    await selectedRunStatus(page, "run-2", "Cancelled").waitFor();
    assert.equal(cancellations, 1);
    await page.getByRole("button", { name: "Definition", exact: true }).click();
    setStage("container-failed-step-draft");
    const definition = page.getByRole("textbox", {
      name: "Pipeline definition JSON",
    });
    await definition.waitFor();
    const beforeRetryEdits = { saves, starts, cancellations, approvalVotes };
    await assertContainerRetryDraft({
      page,
      definition,
      assertNoSave: () =>
        assert.deepEqual(
          { saves, starts, cancellations, approvalVotes },
          beforeRetryEdits,
          "Retry draft controls must not save, run, cancel or approve anything",
        ),
    });
    setStage("fixture-regression");
    await page.getByRole("button", { name: "Validate", exact: true }).click();
    await page.getByText("Valid definition · 1 jobs").waitFor();
    await page
      .getByRole("button", { name: "Save to repository", exact: true })
      .click();
    await page.getByText("Committed bbbbbbbbbbbb to main.").waitFor();
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
    // A separate stored successful run exercises the actual journey's locator
    // against the real UI, with an earlier hidden <option>Success</option>.
    run = {
      ...run,
      runId: "run-completed",
      status: "PIPELINE_STATUS_SUCCESS",
      completedJobs: 1,
      runningJobs: 0,
    };
    await page.goto(`${base}/build?pipeline=pipeline-1&run=run-completed`);
    await selectedRunStatus(page, "run-completed", "Success").waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "Filter runs by status" })
        .inputValue(),
      "",
      "The status filter must remain unselected while the run badge is visible",
    );
    assert.equal(
      await page
        .locator(
          'select[aria-label="Filter runs by status"] option[value="success"]',
        )
        .textContent(),
      "Success",
    );
    const unscopedSuccess = page.getByText("Success", { exact: true }).first();
    assert.equal(
      await unscopedSuccess.evaluate((element) => element.tagName),
      "OPTION",
    );
    assert.equal(await unscopedSuccess.isVisible(), false);
    mode = "empty";
    await page.goto(`${base}/build`);
    await page.getByText("No pipelines yet.", { exact: false }).waitFor();
    await page.screenshot({
      path: `${output}/build-empty-fixture.png`,
      fullPage: true,
    });
    mode = "error";
    await page.reload();
    await page
      .getByRole("heading", { name: "Pipelines unavailable" })
      .waitFor();
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
    await page
      .getByRole("list", { name: "Setup snapshot", exact: true })
      .waitFor();
    assert.match(
      await page
        .getByRole("list", { name: "Setup snapshot", exact: true })
        .innerText(),
      /Not configured/,
    );
    const readinessRefresh = page.getByRole("button", {
      name: "Refresh first-build status",
    });
    firstBuild = {
      ...firstBuild,
      configuration: {
        access: "visible",
        defaultStorageConfigured: true,
        agentSigningConfigured: true,
      },
      agent: { access: "visible", enabledRecentlySeen: true },
    };
    await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/me/first-build" &&
          response.status() === 200,
      ),
      readinessRefresh.click(),
    ]);
    await page
      .getByRole("listitem")
      .filter({
        hasText: "Default artifact storage: Configured (persisted record).",
      })
      .waitFor();
    assert.match(
      await page
        .getByRole("list", { name: "Setup snapshot", exact: true })
        .innerText(),
      /does not guarantee job capacity/,
    );
    expectHttpError("/api/v1/me/first-build", 503);
    firstBuildError = true;
    await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/me/first-build" &&
          response.status() === 503,
      ),
      readinessRefresh.click(),
    ]);
    await page
      .getByRole("list", { name: "Previous setup snapshot", exact: true })
      .waitFor();
    await page.getByText(/First-build status unavailable/).waitFor();
    firstBuildError = false;
    await readinessRefresh.click();
    await page
      .getByRole("list", { name: "Setup snapshot", exact: true })
      .waitFor();
    const setupToggle = page.getByRole("button", {
      name: "First build setup",
      exact: true,
    });
    await setupToggle.click();
    assert.equal(await setupToggle.getAttribute("aria-expanded"), "false");
    await setupToggle.click();
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 1440, height: 1050 },
    ]) {
      await page.setViewportSize(viewport);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .click();
      const scopeChoices = page.getByRole("combobox", {
        name: "Authorized organization scopes",
      });
      await scopeChoices
        .locator('option[value="org-1"]')
        .waitFor({ state: "attached" });
      assert.equal(
        await page
          .getByRole("textbox", { name: "Organization ID" })
          .inputValue(),
        "",
      );
      await scopeChoices.selectOption("org-1");
      assert.equal(
        await page
          .getByRole("textbox", { name: "Organization ID" })
          .inputValue(),
        "org-1",
      );
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });
      await cancel.scrollIntoViewIfNeeded();
      // Modal controls may overlap the launcher behind their overlay. Verify
      // actual hit targets rather than applying the artifact layout's no-overlap rule.
      const cancelReachable = await cancel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          [0.25, 0.5, 0.75].every((x) =>
            [0.25, 0.5, 0.75].every((y) =>
              element.contains(
                document.elementFromPoint(
                  rect.left + rect.width * x,
                  rect.top + rect.height * y,
                ),
              ),
            ),
          )
        );
      });
      assert.equal(
        cancelReachable,
        true,
        "New project Cancel must fit and receive pointer input",
      );
      await cancel.click({ trial: true });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      await cancel.click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    const projectURL = `${base}/projects/project-1`;
    const pipelinesURL = `${projectURL}/pipelines`;
    const assertProjectOverview = async () => {
      await page.waitForURL(projectURL);
      await page
        .getByRole("heading", { name: "API service", exact: true, level: 1 })
        .waitFor();
      await page
        .getByRole("heading", {
          name: "Pipeline definitions",
          exact: true,
          level: 2,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("tab", { name: "Overview", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Run pipeline", exact: true })
          .count(),
        0,
      );
    };
    const assertProjectPipelines = async () => {
      await page.waitForURL(pipelinesURL);
      await page
        .getByRole("heading", { name: "API service", exact: true, level: 1 })
        .waitFor();
      await page
        .getByRole("button", { name: "Run pipeline", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("tab", { name: "Pipelines", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Pipeline definitions", exact: true })
          .count(),
        0,
      );
    };
    await page.getByRole("link", { name: /API service/ }).click();
    await assertProjectOverview();
    await page
      .getByRole("button", { name: "View pipelines", exact: true })
      .click();
    await assertProjectPipelines();
    await assertPollingSetup({
      page,
      fixture: polling,
      output,
      expectHttpError,
    });
    await page.goBack();
    await assertProjectOverview();
    await page.goForward();
    await assertProjectPipelines();
    await page.goBack();
    await assertProjectOverview();
    // Match the long project heading / real-length run ID that exposed the
    // mobile overlap in the actual backend journey, rather than short labels.
    project.displayName = "browser-acceptance-1791887942625";
    project.description =
      "Manage repository pipelines and inspect build executions.";
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
    assert.equal(
      await readFile(await downloaded.path(), "utf8"),
      artifactBytes,
    );
    assert.equal(artifactDownloads, 1);
    const filteredArtifacts = await applyArtifactRunFilter(
      page,
      project.projectId,
      artifactRunId,
    );
    assert.equal(filteredArtifacts.length, 20);
    const filteredDownload = page.getByRole("button", {
      name: "Download report-01.json",
    });
    await assertControlReachable(filteredDownload);
    const [filteredResponse, filteredFile] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname ===
            "/api/v1/projects/project-1/artifacts/artifact-1/download",
      ),
      page.waitForEvent("download"),
      filteredDownload.click(),
    ]);
    assert.equal(filteredResponse.status(), 200);
    assert.equal(
      await readFile(await filteredFile.path(), "utf8"),
      artifactBytes,
    );
    assert.equal(artifactDownloads, 2);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByText("21 total artifacts", { exact: true }).waitFor();
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
    const artifactLayout = await page
      .getByRole("table", { name: "Project artifacts" })
      .evaluate((table) => {
        const scroller = table.parentElement;
        const originalScrollLeft = scroller.scrollLeft;
        scroller.scrollLeft = scroller.scrollWidth;
        const scrollLeft = scroller.scrollLeft;
        const lastCell = table.querySelector("tbody tr td:last-child");
        const lastCellRect = lastCell.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const layout = {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          pageScrollX: scrollX,
          tableViewportWidth: scroller.clientWidth,
          tableContentWidth: scroller.scrollWidth,
          tableScrollLeft: scrollLeft,
          tableOverflowX: getComputedStyle(scroller).overflowX,
          tableViewportRight: scrollerRect.right,
          downloadColumnVisible:
            lastCellRect.left >= scrollerRect.left &&
            lastCellRect.right <= scrollerRect.right,
        };
        scroller.scrollLeft = originalScrollLeft;
        return layout;
      });
    assert.ok(
      artifactLayout.documentWidth <= artifactLayout.viewportWidth,
      `The entire artifact page must fit the mobile viewport: ${JSON.stringify(artifactLayout)}`,
    );
    assert.equal(
      artifactLayout.pageScrollX,
      0,
      "The page itself must not scroll sideways",
    );
    assert.ok(
      ["auto", "scroll"].includes(artifactLayout.tableOverflowX),
      "The table must have its own horizontal scroll container",
    );
    assert.ok(
      artifactLayout.tableViewportRight <= artifactLayout.viewportWidth,
      "The table container must fit the viewport",
    );
    assert.ok(
      artifactLayout.tableContentWidth > artifactLayout.tableViewportWidth &&
        artifactLayout.tableScrollLeft > 0,
      "Wide artifact columns must remain reachable by scrolling inside the panel",
    );
    assert.equal(
      artifactLayout.downloadColumnVisible,
      true,
      "Scrolling the table must reveal its download column",
    );
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 1440, height: 1050 },
    ]) {
      await page.setViewportSize(viewport);
      await assertCommandBarActions(page);
      const artifactURL = page.url();
      await page
        .getByRole("banner")
        .getByRole("button", { name: "Organizations", exact: true })
        .click();
      await page.waitForURL(`${base}/organizations`);
      await page
        .getByRole("heading", { name: "Organizations", exact: true })
        .waitFor();
      await page
        .getByText("No accessible organization records.", { exact: false })
        .waitFor();
      await page.goBack();
      await page.waitForURL(artifactURL);
      await page.getByRole("table", { name: "Project artifacts" }).waitFor();
      await assertArtifactControlLayout(page, artifactRunId);
      const refresh = page.getByRole("button", { name: "Refresh artifacts" });
      await assertControlReachable(refresh);
      const refreshed = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          "/api/v1/projects/project-1/artifacts",
      );
      await refresh.click();
      assert.equal((await refreshed).status(), 200);

      const next = page.getByRole("button", { name: "Next", exact: true });
      await assertControlReachable(next);
      await page.screenshot({
        path: `${output}/artifact-bottom-controls-${viewport.width}.png`,
        fullPage: true,
      });
      await next.click();
      await page.getByText("Page 2 of 2").waitFor();
      const previous = page.getByRole("button", {
        name: "Previous",
        exact: true,
      });
      await assertControlReachable(previous);
      await previous.click();
      await page.getByText("Page 1 of 2").waitFor();

      const downloadButton = page.getByRole("button", {
        name: "Download report-01.json",
      });
      await assertControlReachable(downloadButton);
      const event = page.waitForEvent("download");
      await downloadButton.click();
      const file = await event;
      assert.equal(file.suggestedFilename(), "report-01.json");
      assert.equal(await readFile(await file.path(), "utf8"), artifactBytes);

      const url = page.url();
      const copilot = page.getByRole("button", { name: "Open Copilot" });
      await assertControlReachable(copilot);
      await copilot.click();
      const dialog = page.getByRole("dialog", { name: "Copilot", exact: true });
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await copilot.click();
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        page.url(),
        url,
        "Closing Copilot must preserve the artifact route",
      );
      await assertControlReachable(refresh);
      await assertArtifactControlLayout(page, artifactRunId);
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    artifactMode = "error";
    await page.getByRole("button", { name: "Refresh artifacts" }).click();
    await page
      .getByRole("heading", { name: "Artifacts unavailable" })
      .waitFor();
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
    setStage("exact-retry-approval-fixture");
    for (const failedStep of [false, true]) {
      const retryData = retryFixture();
      retryApproval = retryData.approval;
      retryApproval.pipelineRunId = run.runId;
      const evidence = retryApproval.retryReview.evidence;
      if (failedStep) {
        retryApproval.bindingKind = evidence.kind = "retry_failed_step_v1";
        evidence.retryPlan.version = 2;
        evidence.retryPlan.policy.mode = "failed_step";
      }
      const votesBefore = approvalVotes;
      evidence.context.projectId = project.projectId;
      evidence.context.pipelineId = pipeline.pipelineId;
      evidence.context.pipelineRunId = run.runId;
      evidence.identity.pipelineId = pipeline.pipelineId;
      evidence.identity.pipelineRunId = run.runId;
      evidence.source.PipelineID = pipeline.pipelineId;
      evidence.source.PipelineRunID = run.runId;
      run = {
        ...run,
        status: "PIPELINE_STATUS_RUNNING",
        definitionCommitSha: evidence.context.definitionCommitSha,
      };
      await page.goto(
        `${base}/build?pipeline=${pipeline.pipelineId}&run=${run.runId}`,
      );
      await page
        .getByRole("button", { name: "Review approval approval", exact: true })
        .click();
      const approvalDialog = page.getByRole("dialog");
      await approvalDialog
        .getByText(evidence.inputs.sourceCommit, { exact: true })
        .waitFor();
      await approvalDialog
        .getByText(
          failedStep
            ? "2 total attempts, including the first for each logical step"
            : "2 total attempts, including the first",
          { exact: true },
        )
        .waitFor();
      const approve = approvalDialog.getByRole("button", {
        name: "Approve retry plan",
        exact: true,
      });
      assert.equal(
        await approve.isDisabled(),
        true,
        "Unreviewed plan must not be approved",
      );
      if (failedStep) {
        await approvalDialog
          .getByText(/Earlier successful steps run once/)
          .waitFor();
        await approvalDialog.getByText(/producer \/ producer-step/).waitFor();
        await approvalDialog.getByRole("checkbox").check();
        evidence.inputs.sourceCommit = "f".repeat(40);
        await approve.click();
        await approvalDialog
          .getByText(/plan or your eligibility changed/)
          .waitFor();
        assert.equal(
          approvalVotes,
          votesBefore,
          "Substituted pinned source must refuse voting",
        );
        assert.equal(await approve.isDisabled(), true);
        await approvalDialog
          .getByText("f".repeat(40), { exact: true })
          .waitFor();
        await approvalDialog
          .getByRole("button", { name: "Refresh approval evidence" })
          .click();
        await approvalDialog.getByRole("checkbox").waitFor();
      }
      await approvalDialog.getByRole("checkbox").check();
      await approvalDialog
        .getByLabel("Decision reason (optional)")
        .fill("Reviewed pinned source and two attempts");
      await assertControlReachable(approve);
      await approve.click();
      await approvalDialog.getByText(/Decision recorded/).waitFor();
      assert.equal(approvalVotes, votesBefore + 1, "One explicit vote only");
      await page.setViewportSize({ width: 390, height: 844 });
      await approvalDialog
        .getByText(/recorded decision, not current execution authorization/)
        .waitFor();
      await page.screenshot({
        path: `${output}/retry-approval-${failedStep ? "failed-step" : "whole-job"}-mobile-fixture.png`,
        fullPage: true,
      });
      await approvalDialog
        .getByRole("button", { name: "Close review", exact: true })
        .click();
      await approvalDialog.waitFor({ state: "hidden" });
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
    await assertHonestyFixtureUI({
      page,
      base,
      output,
      diagnostics,
      expectHttpError,
      setStage,
      honesty,
    });
    await assertProjectSecretsFixtureUI({
      page,
      base,
      output,
      diagnostics,
      expectHttpError,
      setStage,
      setSensitiveFormOpen,
      protectSensitiveValue,
      secrets,
      project,
    });
    await assertStorageFixtureUI({
      page,
      base,
      output,
      diagnostics,
      expectHttpError,
      setStage,
      setSensitiveFormOpen,
      protectSensitiveValue,
      storage,
    });
    console.log(
      `UI fixture smoke passed: run/dismiss/cancel, container failed-step draft guards/no autosave, definition validate/save, mobile layout, empty/error/retry, project navigation/back, artifact list/filter/pagination/download/access/error/mobile, exact retry approval review/vote/mobile, honest Dashboard/Inbox/Members/Secrets/Settings scoped reads/denial/mobile. Screenshots: ${output}`,
    );
  },
  {
    sensitiveValues: [
      ...storageSensitiveValues("127.0.0.1:19000"),
      ...syntheticProjectSecretValues,
    ],
  },
);
