import {
  organizationManagementEvidence,
  organizationManagementStages,
} from "./organization-journey.mjs";
/** Shared diagnostics for local-only official Playwright Chromium acceptance. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { artifactContractConfig } from "./stdlib-build-contract.mjs";

const acceptanceStages = new Set([
  ...organizationManagementStages,
  "setup",
  "login",
  "first-build-preflight-evidence",
  "first-build-status",
  "first-build-refresh",
  "preflight-complete",
  "storage-setup-evidence",
  "storage-create",
  "storage-edit",
  "storage-default",
  "storage-reload",
  "storage-permissions",
  "storage-setup-complete",
  "project-create",
  "pipeline-create",
  "definition-review",
  "trigger-run",
  "terminal-response",
  "compiler-failure",
  "failed-run-artifacts",
  "await-source-fix",
  "build-step-evidence",
  "manifest-download",
  "verify-build-downloads",
  "save-build-downloads",
  "visible-run-success",
  "persisted-run-logs",
  "initial-checkout",
  "reload-run",
  "artifact-filter",
  "artifact-download",
  "artifact-download-click",
  "artifact-download-save",
  "mobile-layout",
  "reauthenticate",
  "journey-complete",
  "fixture-regression",
  "exact-retry-approval-fixture",
  "container-failed-step-draft",
]);

export const firstBuildJourney = "three-phase-separate-browser-contexts";
export const firstBuildPreflightSteps = Object.freeze([
  "preflight-login-via-real-api",
  "preflight-missing-configuration-no-agent-no-scope-manual-scope-allowed",
  "preflight-explicit-status-refresh",
  "preflight-no-product-mutations",
]);
export const firstBuildStorageSteps = Object.freeze([
  "storage-login-via-real-api",
  "storage-create-via-ui-redacted-response",
  "storage-edit-metadata-preserves-blank-credentials",
  "storage-explicit-default-and-reload",
  "storage-no-secret-in-page-or-diagnostics",
]);
export const firstBuildConfiguredSteps = Object.freeze([
  "configured-persisted-storage-and-signing-recent-agent",
  "configured-explicit-status-refresh",
]);

/** Exact synthetic administrator state, without accepting leaked configuration values. */
export function assertFirstBuildSnapshot(value, configured) {
  assert.equal(typeof configured, "boolean");
  const expected = {
    scopeOptions: [],
    scopeOptionsTruncated: false,
    canEnterScope: true,
    configuration: {
      access: "visible",
      defaultStorageConfigured: configured,
      agentSigningConfigured: configured,
    },
    agent: { access: "visible", enabledRecentlySeen: configured },
  };
  const exact = (actual, wanted) => {
    if (wanted === null || typeof wanted !== "object") return actual === wanted;
    if (
      !actual ||
      typeof actual !== "object" ||
      Array.isArray(actual) !== Array.isArray(wanted)
    )
      return false;
    const keys = Object.keys(wanted);
    return (
      Object.keys(actual).length === keys.length &&
      keys.every(
        (key) => Object.hasOwn(actual, key) && exact(actual[key], wanted[key]),
      )
    );
  };
  assert.ok(
    exact(value, expected),
    "First-build response must match the exact synthetic administrator state",
  );
}

/** A public allowlist: never copy arbitrary response values or diagnostic text. */
export function firstBuildReadinessEvidence(evidence) {
  if (!evidence) return {};
  assert.ok(
    ["preflight", "storage-setup", "build"].includes(evidence.phase),
    "Known first-build phase required",
  );
  assert.match(evidence.sourceCommit, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  const allowed = [
    ...firstBuildPreflightSteps,
    ...firstBuildStorageSteps,
    ...firstBuildConfiguredSteps,
  ];
  return {
    firstBuildReadiness: {
      journey: firstBuildJourney,
      phase: evidence.phase,
      sourceCommit: evidence.sourceCommit,
      steps: allowed.filter((step) => evidence.steps.includes(step)),
    },
  };
}

/** Retain only verified, same-source preflight facts in the final public summary. */
export function preflightStepsFromSummary(summary, sourceCommit) {
  assert.match(sourceCommit, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  const evidence = summary?.firstBuildReadiness;
  assert.ok(
    summary?.kind === "actual-backend" &&
      summary.status === "passed" &&
      summary.stage === "preflight-complete" &&
      evidence &&
      Object.keys(evidence).sort().join(",") ===
        "journey,phase,sourceCommit,steps" &&
      evidence.journey === firstBuildJourney &&
      evidence.phase === "preflight" &&
      evidence.sourceCommit === sourceCommit &&
      JSON.stringify(evidence.steps) ===
        JSON.stringify(firstBuildPreflightSteps),
    "Full build requires the successful same-source read-only first-use preflight",
  );
  return [...firstBuildPreflightSteps];
}

/** Full builds require completed, same-source UI configuration as well as preflight. */
export function storageSetupStepsFromSummary(summary, sourceCommit) {
  assert.match(sourceCommit, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  const evidence = summary?.firstBuildReadiness;
  const steps = [...firstBuildPreflightSteps, ...firstBuildStorageSteps];
  assert.ok(
    summary?.kind === "actual-backend" &&
      summary.status === "passed" &&
      summary.stage === "storage-setup-complete" &&
      evidence &&
      Object.keys(evidence).sort().join(",") ===
        "journey,phase,sourceCommit,steps" &&
      evidence.journey === firstBuildJourney &&
      evidence.phase === "storage-setup" &&
      evidence.sourceCommit === sourceCommit &&
      JSON.stringify(evidence.steps) === JSON.stringify(steps),
    "Full build requires successful same-source browser storage setup after read-only preflight",
  );
  return steps;
}

/** A preflight can never publish the final build receipt or bypass a missing build. */
export async function writeCompletedBuildReceipt(
  config,
  successfulBuild,
  writer,
) {
  assert.ok(
    ["preflight", "storage-setup", "build"].includes(config.phase),
    "Known acceptance phase required",
  );
  if (config.phase !== "build") {
    assert.equal(
      successfulBuild,
      undefined,
      "Setup phases cannot produce a successful build",
    );
    return;
  }
  if (config.artifactMode === "stdlib-build-v1") {
    assert.ok(
      successfulBuild,
      "Full browser journey must finish before its success receipt is written",
    );
    await writer(config, "successful-run.json", successfulBuild);
  }
}

function isArtifactDownload(method, path) {
  return (
    method === "GET" &&
    /^\/api\/v1\/projects\/[^/]+\/artifacts\/[^/]+\/download$/.test(path)
  );
}

/** Only counts leave the runner, never artifact IDs, paths, headers or bodies. */
export function artifactDownloadEvidence(diagnostics) {
  const responses = diagnostics.requests.filter((entry) =>
    isArtifactDownload(entry.method, entry.path),
  );
  return {
    artifactDownloadRequestCount: diagnostics.artifactDownloadRequestCount,
    artifactDownloadResponseCount: responses.length,
    artifactDownloadSuccessCount: responses.filter(
      (entry) => entry.status === 200,
    ).length,
    artifactDownloadHttpErrorCount: responses.filter(
      (entry) => entry.status >= 400,
    ).length,
    artifactDownloadFailedRequestCount: diagnostics.failedRequests.filter(
      (entry) => isArtifactDownload(entry.method, entry.path),
    ).length,
  };
}

/** Bind status to the exact selected run, never a hidden status-filter option. */
export function selectedRunStatus(page, runId, status) {
  return page
    .getByRole("button", { pressed: true })
    .filter({ has: page.getByText(runId, { exact: true }) })
    .getByText(status, { exact: true });
}

/** Inspect the option itself; Playwright isDisabled() can follow its label to the select. */
export function isNativeOptionDisabled(element) {
  return (
    element.tagName === "OPTION" &&
    element.disabled === true &&
    element.matches(":disabled")
  );
}

/** Only static stage/file names and numeric code positions may leave the runner. */
export function safeFailureEvidence(stage, error) {
  const result = { stage: acceptanceStages.has(stage) ? stage : "unknown" };
  if (typeof error?.stack !== "string") return result;
  const files = [
    "actual-backend-acceptance.mjs",
    "ui-fixture-smoke.mjs",
    "browser-harness.mjs",
    "artifact-controls.mjs",
    "command-bar-controls.mjs",
    "stdlib-build-contract.mjs",
    "retry-policy-fixture.mjs",
    "storage-journey.mjs",
    "storage-fixture.mjs",
    "organization-journey.mjs",
  ];
  for (const frame of error.stack.split("\n").slice(1)) {
    if (!/^\s+at /.test(frame)) continue;
    for (const file of files) {
      const path = fileURLToPath(new URL(file, import.meta.url));
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = frame.match(
        new RegExp(`(?: |\\()(?:file://)?${escaped}:(\\d+):(\\d+)\\)?$`),
      );
      if (!match) continue;
      const [line, column] = match.slice(1).map(Number);
      if (![line, column].every((n) => Number.isSafeInteger(n) && n > 0))
        continue;
      return { ...result, failureSite: { file, line, column } };
    }
  }
  return result;
}

export function loopbackURL(value, name, protocols = ["http:"]) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an explicit loopback URL`);
  }
  assert.ok(
    protocols.includes(url.protocol) &&
      ["127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    `${name} must use a numeric loopback host, an allowed protocol, and no credentials/query/fragment`,
  );
  return url;
}

export function actualBackendConfig(env = process.env) {
  const required = (key) => {
    assert.ok(env[key], `${key} is required; no simulated transport fallback`);
    return env[key];
  };
  const backend = loopbackURL(
    required("ARCENTRA_ACCEPTANCE_BACKEND_URL"),
    "ARCENTRA_ACCEPTANCE_BACKEND_URL",
  );
  assert.equal(backend.pathname, "/", "Backend URL must be an origin");
  const profile = env.ARCENTRA_ACCEPTANCE_PROFILE;
  assert.ok(
    profile === undefined || profile === "image-build-v1",
    "Unsupported acceptance profile",
  );
  const repositoryValue = required("ARCENTRA_ACCEPTANCE_REPO_URL");
  // The image fixture's Agent reaches this single Git service on its private
  // Docker bridge. Compare raw input so URL normalization cannot widen access.
  if (profile === "image-build-v1")
    assert.equal(
      repositoryValue,
      "git://git:9418/acceptance.git",
      "Image acceptance repository must be the exact private fixture URL",
    );
  const repository =
    profile === "image-build-v1"
      ? new URL(repositoryValue)
      : loopbackURL(repositoryValue, "ARCENTRA_ACCEPTANCE_REPO_URL", [
          "http:",
          "git:",
        ]);
  const artifactName = required("ARCENTRA_ACCEPTANCE_ARTIFACT_NAME");
  assert.ok(
    !/[\\/\u0000-\u001f]/.test(artifactName),
    "Artifact name must be a basename",
  );
  if (env.ARCENTRA_ACCEPTANCE_COMMIT)
    assert.match(
      env.ARCENTRA_ACCEPTANCE_COMMIT,
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i,
      "Fixture commit must be a full Git SHA",
    );
  const phase = env.ARCENTRA_ACCEPTANCE_PHASE ?? "build";
  assert.ok(
    ["preflight", "storage-setup", "build"].includes(phase),
    "Unsupported acceptance phase",
  );
  const contract = artifactContractConfig(env, required);
  assert.ok(
    phase === "build" || contract.artifactMode === "stdlib-build-v1",
    "Setup phases require the full build contract",
  );
  const organizationJourney = env.ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY;
  if (organizationJourney !== undefined)
    assert.equal(
      organizationJourney,
      "1",
      "Organization journey must be explicitly enabled",
    );
  let memberUserId;
  if (organizationJourney) {
    assert.equal(
      phase,
      "build",
      "Organization journey requires the build phase",
    );
    memberUserId = required("ARCENTRA_ACCEPTANCE_MEMBER_USER_ID");
    assert.match(
      memberUserId,
      /^[a-zA-Z0-9_-]{1,64}$/,
      "Synthetic existing member ID required",
    );
  } else
    assert.equal(
      env.ARCENTRA_ACCEPTANCE_MEMBER_USER_ID,
      undefined,
      "Member ID requires the organization journey",
    );
  return {
    ...(organizationJourney ? { organizationJourney: true, memberUserId } : {}),
    phase,
    expectedCommit: env.ARCENTRA_ACCEPTANCE_COMMIT,
    storageEndpoint:
      profile === "image-build-v1" ? "minio:9000" : "127.0.0.1:19000",
    backend: backend.origin,
    repository: repository.href,
    orgId: required("ARCENTRA_ACCEPTANCE_ORG_ID"),
    artifactName,
    ...contract,
    branch: env.ARCENTRA_ACCEPTANCE_BRANCH || "main",
    definitionPath:
      env.ARCENTRA_ACCEPTANCE_DEFINITION_PATH || ".arcentra/pipeline.yaml",
    // These credentials belong only to the disposable CI fixture. Never accept
    // arbitrary production credentials or load an existing browser profile.
    username: "ci-admin",
    password: "Ci-Only-Password-123!",
  };
}

export function expectedResourceError(message, expected) {
  if (
    !/^Failed to load resource: the server responded with a status of \d+/.test(
      message.text,
    )
  )
    return false;
  const status = Number(message.text.match(/status of (\d+)/)?.[1]);
  try {
    return expected.has(`${new URL(message.url).pathname}:${status}`);
  } catch {
    return false;
  }
}

export async function runBrowserTest(
  kind,
  callback,
  {
    backend,
    totalTimeoutMs,
    firstBuildEvidence,
    organizationEvidence,
    sensitiveValues = [],
  } = {},
) {
  assert.ok(["simulated-transport", "actual-backend"].includes(kind));
  const timeoutMs =
    totalTimeoutMs ?? (kind === "actual-backend" ? 300_000 : 180_000);
  assert.ok(
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 600_000,
  );
  const base = loopbackURL(
    process.env.UI_TEST_BASE_URL || "http://127.0.0.1:5174",
    "UI_TEST_BASE_URL",
  );
  assert.equal(base.pathname, "/", "UI URL must be an origin");
  if (kind === "actual-backend")
    assert.ok(backend, "Actual backend is required");
  const output =
    process.env.UI_TEST_OUTPUT_DIR ||
    process.env.ARCENTRA_ACCEPTANCE_EVIDENCE_DIR ||
    `test-results/${kind}`;
  await mkdir(output, { recursive: true });
  const diagnostics = {
    kind,
    status: "running",
    browser: "Playwright bundled Chromium",
    base: base.origin,
    console: [],
    secretExposureCount: 0,
    consoleInspectionFailureCount: 0,
    lateConsoleEventCount: 0,
    pageErrors: [],
    requests: [],
    artifactDownloadRequestCount: 0,
    failedRequests: [],
    blockedRequests: [],
    unhandledRoutes: [],
  };
  const expectedHttpErrors = new Set();
  const consoleCollector = createConsoleCollector(diagnostics, sensitiveValues);
  let server;
  let serverError;
  let serverLog = "";
  let browser;
  let context;
  let page;
  let failure;
  let stage = "setup";
  let sensitiveFormOpen = false;
  try {
    if (!process.env.UI_TEST_BASE_URL) {
      server = spawn(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "--host",
          base.hostname,
          "--port",
          base.port,
          "--strictPort",
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            VITE_API_CLIENT_URL: "/api/v1",
            VITE_API_URL: backend || "http://127.0.0.1:1",
          },
        },
      );
      server.on("error", (error) => (serverError = error));
      const log = (data) => (serverLog = `${serverLog}${data}`.slice(-100_000));
      server.stdout.on("data", log);
      server.stderr.on("data", log);
    }
    let ready = false;
    for (let i = 0; i < 150; i++) {
      if (serverError) throw serverError;
      if (server && server.exitCode !== null)
        throw new Error(`Vite exited (${server.exitCode}): ${serverLog}`);
      try {
        const response = await fetch(base, {
          redirect: "error",
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(200);
    }
    assert.ok(ready, "Local Vite server did not become ready");
    const { chromium } = await import("playwright");
    // No system-browser overrides or sandbox-disabling flags. The lockfile's
    // official Playwright install selects the matching browser revision.
    browser = await chromium.launch({ headless: true });
    diagnostics.browserVersion = browser.version();
    context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      serviceWorkers: "block",
      acceptDownloads: true,
    });
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(30_000);
    // Safety firewall only: allowed requests pass unchanged. Actual-backend
    // tests never fulfill application responses or inject a session/token.
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.origin === base.origin ||
        ["data:", "blob:"].includes(url.protocol)
      )
        return route.continue();
      diagnostics.blockedRequests.push(
        `${route.request().method()} ${url.origin}${url.pathname}`,
      );
      return route.abort("blockedbyclient");
    });
    page = await context.newPage();
    page.on("request", (request) => {
      if (isArtifactDownload(request.method(), new URL(request.url()).pathname))
        diagnostics.artifactDownloadRequestCount++;
    });
    const onConsole = (message) => consoleCollector.accept(message);
    page.on("console", onConsole);
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      diagnostics.failedRequests.push({
        method: request.method(),
        path: url.pathname,
        error: request.failure()?.errorText,
      });
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/"))
        diagnostics.requests.push({
          method: response.request().method(),
          path: url.pathname,
          status: response.status(),
        });
    });
    const test = callback({
      page,
      context,
      base: base.origin,
      output,
      diagnostics,
      setStage: (value) => {
        assert.ok(
          acceptanceStages.has(value),
          "Unknown browser acceptance stage",
        );
        stage = value;
      },
      protectSensitiveValue: (value) => {
        assert.equal(typeof value, "string");
        if (value) sensitiveValues.push(value);
      },
      setSensitiveFormOpen: (open) => {
        sensitiveFormOpen = open;
      },
      expectHttpError: (path, status) =>
        expectedHttpErrors.add(`${path}:${status}`),
    });
    await withBrowserDeadline(
      async () => {
        await test;
        // Keep observing through browser close. A callback return is not an event
        // cutoff: late console calls or failed handle inspection must fail closed.
        await finalizeConsoleObservation(consoleCollector, async () => {
          await browser.close();
          browser = undefined;
        });
        page.off("console", onConsole);
      },
      timeoutMs,
      `${kind} browser test exceeded its total timeout`,
    );
    assert.equal(
      diagnostics.pageErrors.length,
      0,
      "No uncaught browser errors",
    );
    assert.equal(
      diagnostics.blockedRequests.length,
      0,
      "No off-origin requests",
    );
    assert.equal(
      diagnostics.unhandledRoutes.length,
      0,
      "Every simulated API route must be explicit",
    );
    assert.equal(
      diagnostics.console.filter(
        (entry) =>
          entry.type === "error" &&
          !expectedResourceError(entry, expectedHttpErrors),
      ).length,
      0,
      "No unexpected browser console errors",
    );
    assert.equal(
      diagnostics.requests.filter(
        (entry) =>
          entry.status >= 400 &&
          !expectedHttpErrors.has(`${entry.path}:${entry.status}`),
      ).length,
      0,
      "No unexpected HTTP errors",
    );
    assert.equal(
      redactDiagnosticText(JSON.stringify(diagnostics), sensitiveValues) ===
        JSON.stringify(diagnostics),
      true,
      "No synthetic credential may appear in browser diagnostics",
    );
    diagnostics.status = "passed";
  } catch (error) {
    failure = error;
    diagnostics.status = "failed";
    diagnostics.error = error.stack || String(error);
    if (
      page &&
      !page.isClosed() &&
      !sensitiveFormOpen &&
      (await safeFailureScreenshot(page, sensitiveValues))
    )
      await page
        .screenshot({
          path: `${output}/${firstBuildEvidence?.phase && firstBuildEvidence.phase !== "build" ? `${firstBuildEvidence.phase}-` : ""}failure.png`,
          fullPage: true,
          mask: [
            page.locator(
              "input[type=password], input[autocomplete=current-password], input[name=password]",
            ),
          ],
        })
        .catch(() => {});
  } finally {
    if (browser) {
      try {
        await withBrowserDeadline(
          () => browser.close(),
          5000,
          "Browser cleanup exceeded its timeout",
        );
      } catch {
        failure ??= new Error("Browser cleanup did not complete");
        diagnostics.status = "failed";
      }
    }
    server?.kill("SIGTERM");
    await writeFile(
      `${output}/diagnostics.json`,
      `${redactDiagnosticText(JSON.stringify(diagnostics, null, 2), sensitiveValues)}\n`,
    );
    await writeFile(
      `${output}/vite.log`,
      redactDiagnosticText(serverLog, sensitiveValues),
    );
    // This is the only JSON file approved for artifact upload. Never include
    // console text, HTML, request/response bodies, headers, URLs, or credentials.
    await writeFile(
      `${output}/summary.json`,
      `${JSON.stringify(
        {
          kind,
          syntheticData: true,
          status: diagnostics.status,
          ...safeFailureEvidence(stage, failure),
          browser: diagnostics.browser,
          browserVersion: diagnostics.browserVersion,
          pageErrorCount: diagnostics.pageErrors.length,
          secretExposureCount: diagnostics.secretExposureCount,
          consoleInspectionFailureCount:
            diagnostics.consoleInspectionFailureCount,
          lateConsoleEventCount: diagnostics.lateConsoleEventCount,
          unexpectedConsoleErrorCount: diagnostics.console.filter(
            (entry) =>
              entry.type === "error" &&
              !expectedResourceError(entry, expectedHttpErrors),
          ).length,
          blockedRequestCount: diagnostics.blockedRequests.length,
          unhandledRouteCount: diagnostics.unhandledRoutes.length,
          apiResponseCount: diagnostics.requests.length,
          ...artifactDownloadEvidence(diagnostics),
          ...firstBuildReadinessEvidence(firstBuildEvidence),
          ...organizationManagementEvidence(organizationEvidence),
        },
        null,
        2,
      )}\n`,
    );
  }
  if (failure) {
    failure.message = redactDiagnosticText(failure.message, sensitiveValues);
    if (failure.stack)
      failure.stack = redactDiagnosticText(failure.stack, sensitiveValues);
    throw failure;
  }
  console.log(`${kind} browser acceptance passed. Evidence: ${output}`);
}

/** Diagnostics remain useful without copying known synthetic credential values. */
export function redactDiagnosticText(text, values) {
  let safe = String(text);
  const secrets = [...values]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  // A JSON credential body has no canonical property order. Decode bounded
  // base64 candidates instead of relying on one serialized fixture canary.
  safe = safe.replace(/[A-Za-z0-9+/]{32,}={0,2}/g, (candidate) => {
    if (candidate.length > 65536) return "[REDACTED-LARGE-ENCODED-VALUE]";
    const decoded = Buffer.from(candidate, "base64").toString("utf8");
    return secrets.some((secret) => decoded.includes(secret))
      ? "[REDACTED]"
      : candidate;
  });
  for (const value of secrets) safe = safe.split(value).join("[REDACTED]");
  return safe;
}

/** Never capture a failed page that still contains credentials or a populated password field. */
export async function safeFailureScreenshot(page, sensitiveValues) {
  try {
    const content = await page.content();
    return (
      redactDiagnosticText(content, sensitiveValues) === content &&
      (await page
        .locator(
          'input[type="password"], input[autocomplete="current-password"], input[name="password"]',
        )
        .evaluateAll((inputs) => inputs.every((input) => !input.value)))
    );
  } catch {
    return false;
  }
}

/** Inspect every observed argument without retaining raw object data or errors. */
export function createConsoleCollector(diagnostics, sensitiveValues) {
  const pending = new Set();
  let sealed = false;
  return {
    accept(message) {
      if (sealed) {
        diagnostics.lateConsoleEventCount++;
        diagnostics.consoleInspectionFailureCount++;
        return;
      }
      try {
        const entry = {
          type: message.type(),
          text: message.text(),
          url: message.location().url,
        };
        const serialized = JSON.stringify(entry);
        if (redactDiagnosticText(serialized, sensitiveValues) !== serialized)
          diagnostics.secretExposureCount++;
        diagnostics.console.push({
          ...entry,
          text: redactDiagnosticText(entry.text, sensitiveValues),
          url: redactDiagnosticText(entry.url, sensitiveValues),
        });
      } catch {
        diagnostics.consoleInspectionFailureCount++;
        return;
      }
      const inspection = (async () => {
        try {
          const args = await Promise.all(
            message.args().map((value) => value.jsonValue()),
          );
          const serialized = JSON.stringify(args);
          if (redactDiagnosticText(serialized, sensitiveValues) !== serialized)
            diagnostics.secretExposureCount++;
        } catch {
          diagnostics.consoleInspectionFailureCount++;
        }
      })();
      pending.add(inspection);
      void inspection.finally(() => pending.delete(inspection));
    },
    async drain() {
      // Events received during a drain are included, not dropped by an array snapshot.
      while (pending.size) await Promise.all([...pending]);
    },
    seal() {
      sealed = true;
    },
    assertClean() {
      assert.ok(
        sealed && pending.size === 0,
        "Console observation must be closed and completely inspected",
      );
      assert.equal(
        diagnostics.consoleInspectionFailureCount,
        0,
        "Every observed console argument must be inspectable",
      );
      assert.equal(
        diagnostics.lateConsoleEventCount,
        0,
        "No console events may arrive after the observation cutoff",
      );
      assert.equal(
        diagnostics.secretExposureCount,
        0,
        "No console argument may expose a synthetic credential",
      );
    },
  };
}

/** Closing the browser establishes the cutoff; this whole operation shares the journey deadline. */
export async function finalizeConsoleObservation(collector, closeBrowser) {
  await collector.drain();
  await closeBrowser();
  collector.seal();
  await collector.drain();
  collector.assertClean();
}

export async function withBrowserDeadline(
  operation,
  timeoutMs,
  message = "Browser observation exceeded its total timeout",
) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
