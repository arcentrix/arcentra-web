/** Shared diagnostics for local-only official Playwright Chromium acceptance. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const acceptanceStages = new Set([
  "setup",
  "login",
  "project-create",
  "pipeline-create",
  "definition-review",
  "trigger-run",
  "terminal-response",
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
]);

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

/** Only static stage/file names and numeric code positions may leave the runner. */
export function safeFailureEvidence(stage, error) {
  const result = { stage: acceptanceStages.has(stage) ? stage : "unknown" };
  if (typeof error?.stack !== "string") return result;
  const files = [
    "actual-backend-acceptance.mjs",
    "ui-fixture-smoke.mjs",
    "browser-harness.mjs",
    "artifact-controls.mjs",
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
  const repository = loopbackURL(
    required("ARCENTRA_ACCEPTANCE_REPO_URL"),
    "ARCENTRA_ACCEPTANCE_REPO_URL",
    ["http:", "git:"],
  );
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
  return {
    expectedCommit: env.ARCENTRA_ACCEPTANCE_COMMIT,
    backend: backend.origin,
    repository: repository.href,
    orgId: required("ARCENTRA_ACCEPTANCE_ORG_ID"),
    artifactName,
    artifactContent: required("ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT"),
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

export async function runBrowserTest(kind, callback, { backend } = {}) {
  assert.ok(["simulated-transport", "actual-backend"].includes(kind));
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
    pageErrors: [],
    requests: [],
    artifactDownloadRequestCount: 0,
    failedRequests: [],
    blockedRequests: [],
    unhandledRoutes: [],
  };
  const expectedHttpErrors = new Set();
  let server;
  let serverError;
  let serverLog = "";
  let browser;
  let context;
  let page;
  let timeout;
  let failure;
  let stage = "setup";
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
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()))
        diagnostics.console.push({
          type: message.type(),
          text: message.text(),
          url: message.location().url,
        });
    });
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
      expectHttpError: (path, status) =>
        expectedHttpErrors.add(`${path}:${status}`),
    });
    await Promise.race([
      test,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(`${kind} browser test exceeded its total timeout`),
            ),
          kind === "actual-backend" ? 300_000 : 180_000,
        );
      }),
    ]);
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
    diagnostics.status = "passed";
  } catch (error) {
    failure = error;
    diagnostics.status = "failed";
    diagnostics.error = error.stack || String(error);
    if (page && !page.isClosed())
      await page
        .screenshot({
          path: `${output}/failure.png`,
          fullPage: true,
          mask: [
            page.locator(
              "input[type=password], input[autocomplete=current-password], input[name=password]",
            ),
          ],
        })
        .catch(() => {});
  } finally {
    clearTimeout(timeout);
    await browser?.close();
    server?.kill("SIGTERM");
    await writeFile(
      `${output}/diagnostics.json`,
      `${JSON.stringify(diagnostics, null, 2)}\n`,
    );
    await writeFile(`${output}/vite.log`, serverLog);
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
          unexpectedConsoleErrorCount: diagnostics.console.filter(
            (entry) =>
              entry.type === "error" &&
              !expectedResourceError(entry, expectedHttpErrors),
          ).length,
          blockedRequestCount: diagnostics.blockedRequests.length,
          unhandledRouteCount: diagnostics.unhandledRoutes.length,
          apiResponseCount: diagnostics.requests.length,
          ...artifactDownloadEvidence(diagnostics),
        },
        null,
        2,
      )}\n`,
    );
  }
  if (failure) throw failure;
  console.log(`${kind} browser acceptance passed. Evidence: ${output}`);
}
