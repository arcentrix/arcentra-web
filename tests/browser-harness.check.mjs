import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import {
  chmod,
  link,
  unlink,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildContract,
  fixedSourceCommit,
  saveBuildDownloads,
  verifyBuildDownloads,
  waitForFixedSource,
  writeBuildReceipt,
} from "./stdlib-build-contract.mjs";
import { JSDOM } from "jsdom";
import {
  actualBackendConfig,
  assertFirstBuildSnapshot,
  firstBuildConfiguredSteps,
  firstBuildJourney,
  firstBuildPreflightSteps,
  firstBuildStorageSteps,
  storageSetupStepsFromSummary,
  redactDiagnosticText,
  safeFailureScreenshot,
  createConsoleCollector,
  finalizeConsoleObservation,
  withBrowserDeadline,
  firstBuildReadinessEvidence,
  preflightStepsFromSummary,
  artifactDownloadEvidence,
  expectedResourceError,
  safeConsoleErrorEvidence,
  safeBrowserRuntimeEvidence,
  isNativeOptionDisabled,
  loopbackURL,
  safeFailureEvidence,
  selectedRunStatus,
  writeCompletedBuildReceipt,
} from "./browser-harness.mjs";
import { fileURLToPath } from "node:url";
import {
  assertPublicStorage,
  assertNoStorageSecrets,
  storageSensitiveValues,
  syntheticStorageConfig,
  storageInitialName,
  storageResponseAfterReload,
} from "./storage-journey.mjs";
import {
  assertRetryEditorViewports,
  containerRetryFixtures,
} from "./retry-policy-fixture.mjs";
import {
  applyArtifactRunFilter,
  assertControlReachable,
} from "./artifact-controls.mjs";
import { assertCommandBarActions } from "./command-bar-controls.mjs";

test("command bar checks all five exact actions and their pointer clickability", async () => {
  for (const theme of ["light", "dark"]) {
    const names = [
      "Organizations",
      "Open command palette",
      `Switch to ${theme} theme`,
      "Inbox",
      "Create new",
    ];
    const checked = [];
    const header = {
      getByRole(role, options) {
        assert.equal(role, "button");
        if (!options)
          return {
            evaluateAll: async (callback) =>
              callback(names.map((name) => ({ getAttribute: () => name }))),
          };
        assert.equal(options.exact, true);
        assert.ok(names.includes(options.name));
        return {
          scrollIntoViewIfNeeded: async () => {},
          evaluate: async () => ({
            label: options.name,
            insideViewport: true,
            overlapsLauncher: false,
            pointerHits: true,
          }),
          click: async (clickOptions) => {
            assert.deepEqual(clickOptions, { trial: true });
            checked.push(options.name);
          },
        };
      },
    };
    const page = {
      getByRole(role) {
        assert.equal(role, "banner");
        return header;
      },
    };
    await assertCommandBarActions(page);
    assert.deepEqual(checked, names);
    for (const invalidNames of [
      names.slice(1),
      [...names, "Organizations"],
      names.map((name) => (name === "Organizations" ? "Unknown" : name)),
      names.map((name) => (name === "Organizations" ? null : name)),
      names.map((name) =>
        name.startsWith("Switch to") ? "Switch theme" : name,
      ),
    ]) {
      const original = [...names];
      names.splice(0, names.length, ...invalidNames);
      await assert.rejects(
        assertCommandBarActions(page),
        /Every command-bar action must be present exactly once/,
      );
      names.splice(0, names.length, ...original);
    }
    assert.equal(
      checked.length,
      5,
      "Invalid inventories must fail before clicking",
    );
  }
});

test("native option disabled checks inspect a labeled option, not its enabled select", () => {
  const dom = new JSDOM(`<label>Scope<select>
    <option value="failed_step" disabled selected>Failed step only</option>
    <option value="whole_job">Whole job steps</option>
  </select></label>`);
  try {
    const select = dom.window.document.querySelector("select");
    const [blocked, allowed] = select.options;
    assert.equal(select.disabled, false);
    assert.equal(select.value, "failed_step");
    assert.equal(isNativeOptionDisabled(blocked), true);
    assert.equal(isNativeOptionDisabled(allowed), false);
    assert.equal(isNativeOptionDisabled(select), false);
    blocked.removeAttribute("disabled");
    assert.equal(isNativeOptionDisabled(blocked), false);
    select.disabled = true;
    assert.equal(isNativeOptionDisabled(allowed), false);
    assert.equal(isNativeOptionDisabled(select), false);
  } finally {
    dom.window.close();
  }
});

test("artifact filtering waits for the exact GET response and new matching snapshot", async () => {
  const calls = [];
  let respond;
  const pending = new Promise((resolve) => {
    respond = resolve;
  });
  const response = (path, method = "GET") => ({
    url: () => `http://127.0.0.1:5174${path}`,
    request: () => ({ method: () => method }),
  });
  const row = { artifactId: "artifact-1", pipelineRunId: "run-1" };
  const page = {
    getByRole(role, options) {
      if (role === "textbox")
        return {
          fill: async (value) => {
            assert.equal(value, "run-1");
            calls.push("fill");
          },
        };
      if (role === "button") return { click: async () => calls.push("click") };
      assert.equal(role, "table");
      assert.equal(options.name, "Project artifacts");
      return {
        getByRole: (childRole, childOptions) => {
          assert.equal(childRole, "link");
          assert.deepEqual(childOptions, { name: "run-1", exact: true });
          return {
            first: () => ({ waitFor: async () => calls.push("run-link") }),
          };
        },
      };
    },
    waitForResponse(match) {
      const path = "/api/v1/projects/project-1/artifacts";
      assert.equal(match(response(path)), false);
      assert.equal(match(response(`${path}?runId=other`)), false);
      assert.equal(match(response(`${path}?runId=run-1`, "POST")), false);
      assert.equal(
        match(response("/api/v1/projects/other/artifacts?runId=run-1")),
        false,
      );
      assert.equal(match(response(`${path}?runId=run-1`)), true);
      calls.push("wait-response");
      return pending;
    },
    waitForURL: async (match) => {
      assert.equal(match(new URL("http://127.0.0.1/?runId=run-1")), true);
      calls.push("url-ready");
    },
    getByText: (text, options) => {
      assert.equal(text, "1 matching artifacts");
      assert.deepEqual(options, { exact: true });
      return { waitFor: async () => calls.push("matching-snapshot") };
    },
  };
  const result = applyArtifactRunFilter(page, "project-1", "run-1");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["fill", "wait-response", "click", "url-ready"]);
  respond({
    status: () => 200,
    json: async () => ({ code: 200, detail: { total: 1, list: [row] } }),
  });
  assert.deepEqual(await result, [row]);
  assert.deepEqual(calls.slice(-2), ["matching-snapshot", "run-link"]);
});

test("download evidence exposes counts only and preserves failed HTTP/request categories", () => {
  const path =
    "/api/v1/projects/private-project/artifacts/private-artifact/download";
  const diagnostics = {
    artifactDownloadRequestCount: 4,
    requests: [
      { method: "GET", path, status: 200, body: "secret" },
      {
        method: "GET",
        path,
        status: 503,
        headers: { authorization: "secret" },
      },
      { method: "GET", path, status: 403 },
      { method: "POST", path, status: 200 },
      { method: "GET", path: "/api/v1/other", status: 500 },
    ],
    failedRequests: [
      { method: "GET", path, error: "secret" },
      { method: "GET", path: "/api/v1/other", error: "secret" },
    ],
  };
  assert.deepEqual(artifactDownloadEvidence(diagnostics), {
    artifactDownloadRequestCount: 4,
    artifactDownloadResponseCount: 3,
    artifactDownloadSuccessCount: 1,
    artifactDownloadHttpErrorCount: 2,
    artifactDownloadFailedRequestCount: 1,
  });
});

test("control reachability rejects partial overlays even when bounds and center are visible", async () => {
  const previous = ["document", "innerWidth", "innerHeight"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  let obstruction = "none";
  let trialClicks = 0;
  let hitTests = 0;
  const rect = {
    left: 100,
    right: 196,
    top: 100,
    bottom: 132,
    width: 96,
    height: 32,
  };
  const element = {
    getBoundingClientRect: () => rect,
    getAttribute: () => "Refresh artifacts",
    contains: (target) => target === element,
  };
  const launcher = {
    getBoundingClientRect: () => ({
      left: obstruction === "copilot" ? 190 : 300,
      right: 348,
      top: 100,
      bottom: 148,
    }),
  };
  const control = {
    scrollIntoViewIfNeeded: async () => {},
    evaluate: async (callback) => callback(element),
    click: async (options) => {
      assert.deepEqual(options, { trial: true });
      trialClicks++;
    },
  };
  try {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    globalThis.document = {
      querySelector: () => launcher,
      elementFromPoint: (x) => {
        hitTests++;
        return obstruction === "edge" && x < 130 ? launcher : element;
      },
    };
    await assertControlReachable(control);
    assert.equal(
      hitTests,
      9,
      "Check the center and surrounding pointer targets",
    );
    assert.equal(trialClicks, 1);
    obstruction = "edge";
    await assert.rejects(assertControlReachable(control), /pointer input/);
    obstruction = "copilot";
    await assert.rejects(assertControlReachable(control), /overlap Copilot/);
    assert.equal(
      trialClicks,
      1,
      "An obstruction must fail before an automated click can scroll it away",
    );
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("status locator is scoped to the exact selected run before matching text", () => {
  const calls = [];
  const idMatch = {};
  const badge = {};
  const page = {
    getByText(text, options) {
      calls.push(["run-id", text, options]);
      return idMatch;
    },
    getByRole(role, options) {
      calls.push(["role", role, options]);
      return {
        filter(options) {
          assert.equal(options.has, idMatch);
          return {
            getByText(text, options) {
              calls.push(["status", text, options]);
              return badge;
            },
          };
        },
      };
    },
  };
  assert.equal(selectedRunStatus(page, "run-actual", "Success"), badge);
  assert.deepEqual(calls, [
    ["role", "button", { pressed: true }],
    ["run-id", "run-actual", { exact: true }],
    ["status", "Success", { exact: true }],
  ]);
});

test("failure evidence only includes allowlisted stage, source basename and numeric position", () => {
  const file = new URL("actual-backend-acceptance.mjs", import.meta.url);
  for (const location of [file.href, fileURLToPath(file)]) {
    const evidence = safeFailureEvidence("visible-run-success", {
      stack: `Error: token=private-secret https://private.example/?key=secret\n    at callback (${location}:235:72)`,
    });
    assert.deepEqual(evidence, {
      stage: "visible-run-success",
      failureSite: {
        file: "actual-backend-acceptance.mjs",
        line: 235,
        column: 72,
      },
    });
  }
  for (const stack of [
    "Error: token=secret actual-backend-acceptance.mjs:235:72",
    "Error: secret\n    at /untrusted/actual-backend-acceptance.mjs:235:72",
    `Error: secret\n    at ${file.href}:235:72?token=secret`,
    `Error: secret\n    at ${file.href}:999999999999999999:72`,
    undefined,
  ])
    assert.deepEqual(
      safeFailureEvidence("https://private.example", { stack }),
      {
        stage: "unknown",
      },
    );
});

test("missing persisted-log diagnostics allow only fixed marker categories, never log text", () => {
  for (const category of [
    "baseline",
    "toolchain",
    "test",
    "build",
    "behavior",
    "stdout",
    "compile-error",
  ]) {
    const stage = `persisted-run-log-${category}`;
    assert.deepEqual(
      safeFailureEvidence(stage, new Error("PRIVATE-LOG-CONTENT")),
      { stage },
    );
  }
  assert.deepEqual(
    safeFailureEvidence("persisted-run-log-PRIVATE-LOG-CONTENT", null),
    { stage: "unknown" },
  );
});

test("browser URLs fail closed outside numeric loopback", () => {
  assert.equal(loopbackURL("http://127.0.0.1:5174", "test").port, "5174");
  assert.equal(loopbackURL("http://[::1]:5174", "test").hostname, "[::1]");
  for (const url of [
    "https://production.example",
    "http://localhost:5174",
    "http://127.0.0.1.evil.test",
    "http://user:pass@127.0.0.1",
    "file:///tmp/index.html",
    "http://127.0.0.1/?token=secret",
    "http://127.0.0.1/#unsafe",
  ])
    assert.throws(() => loopbackURL(url, "test"));
});

test("actual backend mode requires explicit fixture inputs", () => {
  assert.throws(
    () => actualBackendConfig({}),
    /no simulated transport fallback/,
  );
  const env = {
    ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://127.0.0.1:18080",
    ARCENTRA_ACCEPTANCE_REPO_URL: "git://127.0.0.1:19418/acceptance.git",
    ARCENTRA_ACCEPTANCE_ORG_ID: "ci-org",
    ARCENTRA_ACCEPTANCE_ARTIFACT_NAME: "report.json",
    ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT: '{"source":"real-agent"}\n',
  };
  const config = actualBackendConfig(env);
  assert.equal(config.username, "ci-admin");
  assert.equal(config.backend, "http://127.0.0.1:18080");
  assert.equal(config.repository, env.ARCENTRA_ACCEPTANCE_REPO_URL);
  assert.throws(
    () =>
      actualBackendConfig({
        ...env,
        ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://127.0.0.1/api/v1",
      }),
    /must be an origin/,
  );
  assert.throws(
    () =>
      actualBackendConfig({
        ...env,
        ARCENTRA_ACCEPTANCE_ARTIFACT_NAME: "../report.json",
      }),
    /basename/,
  );
});

test("only expected native HTTP error messages are tolerated", () => {
  const allowed = new Set(["/api/v1/pipelines/:503"]);
  const message = {
    text: "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    url: "http://127.0.0.1:5174/api/v1/pipelines/",
  };
  assert.equal(expectedResourceError(message, allowed), true);
  assert.equal(
    expectedResourceError({ ...message, text: "Application crashed" }, allowed),
    false,
  );
  assert.equal(
    expectedResourceError(
      { ...message, url: "http://127.0.0.1/api/v1/other" },
      allowed,
    ),
    false,
  );
  assert.equal(
    expectedResourceError(
      { ...message, text: message.text.replace("503", "500") },
      allowed,
    ),
    false,
  );
});

test("all static browser journey stages are explicitly allowlisted", async () => {
  for (const file of [
    "ui-fixture-smoke.mjs",
    "actual-backend-acceptance.mjs",
    "storage-journey.mjs",
    "storage-fixture.mjs",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const stages = [...source.matchAll(/setStage\("([^"\n]+)"\)/g)].map(
      (match) => match[1],
    );
    assert.ok(stages.length > 0);
    for (const stage of stages) {
      assert.equal(
        safeFailureEvidence(stage, null).stage,
        stage,
        `${file}: ${stage}`,
      );
    }
  }
  assert.equal(safeFailureEvidence("untrusted-stage", null).stage, "unknown");
});

test("container retry fixtures preserve independent authored policies and blocked combinations", () => {
  const original = JSON.stringify({
    name: "Synthetic retry draft",
    jobs: [
      { name: "build", steps: [{ name: "compile", run: "exit 9" }] },
      { name: "untouched", steps: [{ name: "report", run: "echo done" }] },
    ],
  });
  const fixtures = containerRetryFixtures(original);
  const base = JSON.parse(fixtures.off);
  assert.deepEqual(base.runtime, { type: "containerd-offline-v1" });
  assert.equal(base.jobs[0].retry, undefined);
  assert.equal(base.jobs[0].approval, undefined);
  const expected = {
    mode: "failed_step",
    maxAttempts: 2,
    delay: "1s",
    allowedExitCodes: [9],
    idempotent: true,
  };
  assert.deepEqual(JSON.parse(fixtures.supported).jobs[0].retry, expected);
  assert.deepEqual(
    fixtures.blocked.map((fixture) => fixture.name),
    ["unknown approval", "continueOnError", "continue_on_error"],
  );
  for (const fixture of fixtures.blocked) {
    const spec = JSON.parse(fixture.text);
    assert.deepEqual(spec.jobs[0].retry, expected);
    assert.deepEqual(spec.jobs[1], JSON.parse(original).jobs[1]);
    assert.equal(
      fixture.text.includes("\n"),
      false,
      "Raw authored formatting is deliberate",
    );
    if (fixture.name.startsWith("continue")) {
      assert.equal(spec.jobs[0].steps[0][fixture.name], true);
      assert.equal(spec.jobs[0].approval, undefined);
    } else {
      assert.notEqual(spec.jobs[0].approval, null);
      assert.deepEqual(spec.jobs[0].steps, base.jobs[0].steps);
    }
  }
  const exactFailedStep = JSON.parse(fixtures.failedStepApproved).jobs[0];
  const exactWholeJob = JSON.parse(fixtures.wholeJobApproved).jobs[0];
  assert.deepEqual(exactFailedStep.approval, exactWholeJob.approval);
  assert.equal(exactWholeJob.retry.mode, "whole_job");
  assert.deepEqual(
    JSON.parse(fixtures.wholeJobUnknownApproval).jobs[0].approval,
    {},
  );
  assert.deepEqual(JSON.parse(fixtures.unsupported).jobs[0].retry, {
    mode: "future_scope",
    futureOption: "preserve-me",
  });
  assert.deepEqual(
    JSON.parse(fixtures.supported).jobs[0].steps,
    base.jobs[0].steps,
  );
  assert.equal(JSON.parse(original).runtime, undefined);
});

test("container draft failure evidence uses an allowlisted stage and helper basename only", () => {
  const helper = new URL("retry-policy-fixture.mjs", import.meta.url);
  assert.deepEqual(
    safeFailureEvidence("container-failed-step-draft", {
      stack: `Error: private authored JSON\n    at assertContainerRetryDraft (${helper.href}:99:12)`,
    }),
    {
      stage: "container-failed-step-draft",
      failureSite: { file: "retry-policy-fixture.mjs", line: 99, column: 12 },
    },
  );
});

for (const obstructed of [false, true]) {
  test(`retry viewport checks use trial clicks and restore the viewport${obstructed ? " after failure" : ""}`, async () => {
    const original = { width: 1280, height: 800 };
    const events = [];
    const options = {
      page: {
        viewportSize: () => original,
        setViewportSize: async (viewport) =>
          events.push(["viewport", viewport]),
        evaluate: async () => {
          events.push(["overflow-check"]);
          return true;
        },
      },
      warning: {
        scrollIntoViewIfNeeded: async () => events.push(["scroll-warning"]),
        innerText: async () => "Preserved warning",
      },
      apply: {
        scrollIntoViewIfNeeded: async () => events.push(["scroll-apply"]),
        click: async (clickOptions) => {
          assert.deepEqual(clickOptions, { trial: true });
          events.push(["trial-click"]);
          if (obstructed) throw new Error("Apply is obscured");
        },
      },
      expectedWarning: "Preserved warning",
      assertUnchanged: async () => events.push(["unchanged"]),
    };
    if (obstructed) {
      await assert.rejects(
        assertRetryEditorViewports(options),
        /Apply is obscured/,
      );
    } else {
      await assertRetryEditorViewports(options);
    }
    const expectedEvents = (viewport) => [
      ["viewport", viewport],
      ["scroll-warning"],
      ["overflow-check"],
      ["scroll-apply"],
      ["trial-click"],
    ];
    assert.deepEqual(events, [
      ...expectedEvents({ width: 320, height: 568 }),
      ...(obstructed
        ? []
        : [
            ["unchanged"],
            ...expectedEvents({ width: 1440, height: 1050 }),
            ["unchanged"],
          ]),
      ["viewport", original],
    ]);
  });
}

const buildEnv = () => ({
  ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://127.0.0.1:18080",
  ARCENTRA_ACCEPTANCE_REPO_URL: "git://127.0.0.1:19418/acceptance.git",
  ARCENTRA_ACCEPTANCE_ORG_ID: "ci-org",
  ARCENTRA_ACCEPTANCE_ARTIFACT_NAME: "stdlib-demo",
  ARCENTRA_ACCEPTANCE_CONTRACT: "stdlib-build-v1",
  ARCENTRA_ACCEPTANCE_COMMIT: "a".repeat(40),
  ARCENTRA_ACCEPTANCE_MANIFEST_NAME: "manifest.json",
  ARCENTRA_ACCEPTANCE_GO_VERSION: "go1.25.6",
  ARCENTRA_ACCEPTANCE_EXPECTED_OUTPUT:
    '{"message":"HELLO, ARCENTRA!","length":8}\n',
  ARCENTRA_ACCEPTANCE_COORDINATION_DIR: "/tmp/private-fixture/coordination",
});

test("image acceptance profile admits only the exact private Git fixture URL", () => {
  const env = {
    ...buildEnv(),
    ARCENTRA_ACCEPTANCE_PROFILE: "image-build-v1",
    ARCENTRA_ACCEPTANCE_REPO_URL: "git://git:9418/acceptance.git",
  };
  assert.equal(
    actualBackendConfig(env).repository,
    env.ARCENTRA_ACCEPTANCE_REPO_URL,
  );
  assert.equal(
    actualBackendConfig(buildEnv()).repository,
    buildEnv().ARCENTRA_ACCEPTANCE_REPO_URL,
  );
  assert.deepEqual(actualBackendConfig(env), {
    ...actualBackendConfig(buildEnv()),
    repository: env.ARCENTRA_ACCEPTANCE_REPO_URL,
    storageEndpoint: "minio:9000",
  });
  for (const repository of [
    "git://git:9419/acceptance.git",
    "git://git/acceptance.git",
    "git://git:9418/other.git",
    "git://git:9418/acceptance.git/",
    "git://user:pass@git:9418/acceptance.git",
    "git://git:9418/acceptance.git?query=value",
    "git://git:9418/acceptance.git#fragment",
    "git://git:9418/acceptance.git?",
    "git://git:9418/acceptance.git#",
    "git://git:9418/path/../acceptance.git",
    "git://git:09418/acceptance.git",
    "git://GIT:9418/acceptance.git",
    "http://git:9418/acceptance.git",
    "git://other:9418/acceptance.git",
    "git://127.0.0.1:19418/acceptance.git",
    " git://git:9418/acceptance.git",
    "git://git:9418/acceptance.git\n",
  ])
    assert.throws(
      () =>
        actualBackendConfig({
          ...env,
          ARCENTRA_ACCEPTANCE_REPO_URL: repository,
        }),
      /exact private fixture URL/,
      repository,
    );
  assert.throws(
    () =>
      actualBackendConfig({ ...env, ARCENTRA_ACCEPTANCE_PROFILE: undefined }),
    /numeric loopback host/,
  );
  for (const profile of [
    "",
    "host",
    "image-build-v2",
    "IMAGE-BUILD-V1",
    "arbitrary",
  ])
    assert.throws(
      () =>
        actualBackendConfig({
          ...buildEnv(),
          ARCENTRA_ACCEPTANCE_PROFILE: profile,
        }),
      /Unsupported acceptance profile/,
    );
  assert.throws(
    () =>
      actualBackendConfig({
        ...env,
        ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://control:8080",
      }),
    /numeric loopback host/,
  );
  // The shared UI/API URL validator never recognizes the private Git exception.
  assert.throws(
    () => loopbackURL("http://git:9418", "UI_TEST_BASE_URL"),
    /numeric loopback host/,
  );
});

test("actual acceptance phase defaults to the full build and rejects any unknown skip mode", () => {
  assert.equal(actualBackendConfig(buildEnv()).phase, "build");
  for (const phase of ["preflight", "storage-setup", "build"])
    assert.equal(
      actualBackendConfig({ ...buildEnv(), ARCENTRA_ACCEPTANCE_PHASE: phase })
        .phase,
      phase,
    );
  for (const phase of ["", "skip", "preflight-only", "false", "BUILD"])
    assert.throws(
      () =>
        actualBackendConfig({
          ...buildEnv(),
          ARCENTRA_ACCEPTANCE_PHASE: phase,
        }),
      /acceptance phase/,
    );
  const text = {
    ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://127.0.0.1:18080",
    ARCENTRA_ACCEPTANCE_REPO_URL: "git://127.0.0.1:19418/acceptance.git",
    ARCENTRA_ACCEPTANCE_ORG_ID: "ci-org",
    ARCENTRA_ACCEPTANCE_ARTIFACT_NAME: "report.json",
    ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT: "synthetic output",
    ARCENTRA_ACCEPTANCE_PHASE: "preflight",
  };
  assert.throws(() => actualBackendConfig(text), /full build contract/);
});

test("preflight never writes a success receipt and a full build requires completed journey evidence", async () => {
  const calls = [];
  const write = async (...args) => calls.push(args);
  const preflight = actualBackendConfig({
    ...buildEnv(),
    ARCENTRA_ACCEPTANCE_PHASE: "preflight",
  });
  const build = actualBackendConfig(buildEnv());
  const result = {
    projectId: "project",
    pipelineId: "pipeline",
    runId: "fixed-run",
    sourceCommit: "b".repeat(40),
  };
  await writeCompletedBuildReceipt(preflight, undefined, write);
  assert.deepEqual(calls, []);
  await assert.rejects(
    writeCompletedBuildReceipt(preflight, result, write),
    /cannot produce a successful build/,
  );
  await assert.rejects(
    writeCompletedBuildReceipt(build, undefined, write),
    /Full browser journey must finish/,
  );
  assert.deepEqual(calls, []);
  await writeCompletedBuildReceipt(build, result, write);
  assert.deepEqual(calls, [[build, "successful-run.json", result]]);
  await assert.rejects(
    writeCompletedBuildReceipt({ ...build, phase: "skip" }, result, write),
    /Known acceptance phase/,
  );
  await assert.rejects(
    writeCompletedBuildReceipt(build, result, async () => {
      throw new Error("receipt unavailable");
    }),
    /receipt unavailable/,
  );
});

const firstBuildState = (configured) => ({
  scopeOptions: [],
  scopeOptionsTruncated: false,
  canEnterScope: true,
  configuration: {
    access: "visible",
    defaultStorageConfigured: configured,
    agentSigningConfigured: configured,
  },
  agent: { access: "visible", enabledRecentlySeen: configured },
});

test("real first-use response assertions require exact missing/configured state and no fabricated scope", () => {
  for (const configured of [false, true]) {
    assertFirstBuildSnapshot(firstBuildState(configured), configured);
    assert.throws(() =>
      assertFirstBuildSnapshot(firstBuildState(!configured), configured),
    );
    for (const patch of [
      { scopeOptions: [{ scopeId: "fabricated-org", source: "role_grant" }] },
      { scopeOptionsTruncated: true },
      { canEnterScope: false },
      { canEnterScope: 1 },
      { configuration: { access: "restricted" } },
      {
        configuration: {
          ...firstBuildState(configured).configuration,
          endpoint: "private-host",
        },
      },
      {
        configuration: {
          access: "visible",
          defaultStorageConfigured: configured,
        },
      },
      { agent: { access: "restricted" } },
      { agent: { access: "visible", enabledRecentlySeen: Number(configured) } },
      {
        agent: {
          ...firstBuildState(configured).agent,
          agentId: "private-agent",
        },
      },
      { token: "private-secret" },
    ])
      assert.throws(() =>
        assertFirstBuildSnapshot(
          { ...firstBuildState(configured), ...patch },
          configured,
        ),
      );
    for (const absent of [null, [], undefined, {}])
      assert.throws(() => assertFirstBuildSnapshot(absent, configured));
  }
});

test("final first-use summary retains a complete same-source preflight with separate-context labeling", () => {
  const sourceCommit = "a".repeat(40);
  const preflight = {
    kind: "actual-backend",
    status: "passed",
    stage: "preflight-complete",
    ...firstBuildReadinessEvidence({
      phase: "preflight",
      sourceCommit,
      steps: [...firstBuildPreflightSteps],
    }),
  };
  const retained = preflightStepsFromSummary(preflight, sourceCommit);
  assert.deepEqual(retained, firstBuildPreflightSteps);
  const final = firstBuildReadinessEvidence({
    phase: "build",
    sourceCommit,
    steps: [...retained, ...firstBuildConfiguredSteps],
  });
  assert.deepEqual(final.firstBuildReadiness, {
    journey: firstBuildJourney,
    phase: "build",
    sourceCommit,
    steps: [...firstBuildPreflightSteps, ...firstBuildConfiguredSteps],
  });
  for (const patch of [
    { status: "failed" },
    { stage: "journey-complete" },
    { kind: "simulated-transport" },
  ])
    assert.throws(
      () => preflightStepsFromSummary({ ...preflight, ...patch }, sourceCommit),
      /successful same-source/,
    );
  for (const patch of [
    { phase: "build" },
    { journey: "continuous-session" },
    { sourceCommit: "b".repeat(40) },
    { steps: firstBuildPreflightSteps.slice(0, -1) },
    { steps: [...firstBuildPreflightSteps, "journey-complete"] },
    { token: "private-secret" },
  ])
    assert.throws(
      () =>
        preflightStepsFromSummary(
          {
            ...preflight,
            firstBuildReadiness: { ...preflight.firstBuildReadiness, ...patch },
          },
          sourceCommit,
        ),
      /successful same-source/,
    );
  for (const empty of [null, undefined, {}])
    assert.throws(() => preflightStepsFromSummary(empty, sourceCommit));
});

test("first-use public summary allows only static steps, phase and a full commit", () => {
  assert.deepEqual(firstBuildReadinessEvidence(undefined), {});
  const evidence = firstBuildReadinessEvidence({
    phase: "preflight",
    sourceCommit: "a".repeat(40),
    steps: [
      firstBuildPreflightSteps[0],
      "private-token-secret",
      { secret: "private-secret" },
    ],
    token: "private-secret",
    endpoint: "https://private.example",
  });
  assert.deepEqual(evidence.firstBuildReadiness.steps, [
    firstBuildPreflightSteps[0],
  ]);
  assert.equal(JSON.stringify(evidence).includes("private"), false);
  assert.throws(() =>
    firstBuildReadinessEvidence({
      phase: "skip",
      sourceCommit: "a".repeat(40),
      steps: [],
    }),
  );
  assert.throws(() =>
    firstBuildReadinessEvidence({
      phase: "build",
      sourceCommit: "token-secret",
      steps: [],
    }),
  );
});

function sampleBuild() {
  // Parser unit bytes only; never claimed as compilation/runtime acceptance.
  const binary = Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    Buffer.alloc(80, 5),
  ]);
  const manifest = {
    schemaVersion: 1,
    sourceCommit: "b".repeat(40),
    goVersion: "go1.25.6",
    binary: {
      name: "stdlib-demo",
      sizeBytes: binary.length,
      sha256: createHash("sha256").update(binary).digest("hex"),
    },
    behavior: {
      args: ["arcentra"],
      stdout: buildContract.stdout,
      stdoutSha256: createHash("sha256")
        .update(buildContract.stdout)
        .digest("hex"),
    },
  };
  return { binary, manifest, bytes: Buffer.from(JSON.stringify(manifest)) };
}

test("explicit stdlib build configuration is pinned and cannot fall back to text mode", () => {
  const config = actualBackendConfig(buildEnv());
  assert.equal(config.artifactMode, "stdlib-build-v1");
  assert.equal(config.artifactContent, undefined);
  assert.equal(config.manifestName, "manifest.json");
  assert.throws(
    () =>
      actualBackendConfig({
        ...buildEnv(),
        UI_TEST_OUTPUT_DIR: "/tmp/private-fixture",
      }),
    /outside browser evidence/,
  );
  for (const key of [
    "ARCENTRA_ACCEPTANCE_CONTRACT",
    "ARCENTRA_ACCEPTANCE_COMMIT",
    "ARCENTRA_ACCEPTANCE_MANIFEST_NAME",
    "ARCENTRA_ACCEPTANCE_GO_VERSION",
    "ARCENTRA_ACCEPTANCE_EXPECTED_OUTPUT",
    "ARCENTRA_ACCEPTANCE_COORDINATION_DIR",
  ]) {
    const env = buildEnv();
    delete env[key];
    assert.throws(() => actualBackendConfig(env), key);
  }
  for (const [key, value] of [
    ["ARCENTRA_ACCEPTANCE_CONTRACT", "stdlib-build-v2"],
    ["ARCENTRA_ACCEPTANCE_CONTRACT", ""],
    ["ARCENTRA_ACCEPTANCE_COMMIT", "a".repeat(7)],
    ["ARCENTRA_ACCEPTANCE_COMMIT", "A".repeat(40)],
    ["ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT", "pretend-binary"],
    ["ARCENTRA_ACCEPTANCE_ARTIFACT_NAME", "other"],
    ["ARCENTRA_ACCEPTANCE_MANIFEST_NAME", "../manifest.json"],
    ["ARCENTRA_ACCEPTANCE_GO_VERSION", "go1.26.0"],
    ["ARCENTRA_ACCEPTANCE_EXPECTED_OUTPUT", "invented behavior"],
    ["ARCENTRA_ACCEPTANCE_BRANCH", "production"],
    ["ARCENTRA_ACCEPTANCE_COORDINATION_DIR", "relative"],
    ["ARCENTRA_ACCEPTANCE_COORDINATION_DIR", "/"],
    ["ARCENTRA_ACCEPTANCE_COORDINATION_DIR", "/tmp/.."],
    ["ARCENTRA_ACCEPTANCE_COORDINATION_DIR", "/tmp/unsafe\npath"],
  ])
    assert.throws(
      () => actualBackendConfig({ ...buildEnv(), [key]: value }),
      `${key}: ${value}`,
    );
});

test("binary manifest independently binds full source, pinned toolchain, bytes and behavior", () => {
  const { binary, bytes, manifest } = sampleBuild();
  assert.deepEqual(
    verifyBuildDownloads(bytes, binary, manifest.sourceCommit),
    manifest,
  );
  assert.throws(
    () => verifyBuildDownloads(bytes, binary, "c".repeat(40)),
    /checkout commit/,
  );
  assert.throws(
    () => verifyBuildDownloads(bytes, binary, "b".repeat(7)),
    /full SHA/,
  );
  assert.throws(() =>
    verifyBuildDownloads(
      bytes,
      Buffer.from("text-only fake binary"),
      manifest.sourceCommit,
    ),
  );
  const corrupt = Buffer.from(binary);
  corrupt[20]++;
  assert.throws(
    () => verifyBuildDownloads(bytes, corrupt, manifest.sourceCommit),
    /SHA-256/,
  );
  assert.throws(
    () =>
      verifyBuildDownloads(
        bytes,
        binary.subarray(0, -1),
        manifest.sourceCommit,
      ),
    /byte length/,
  );
  for (const mutate of [
    (m) => {
      m.schemaVersion = 2;
    },
    (m) => {
      m.sourceCommit = "b".repeat(7);
    },
    (m) => {
      m.sourceCommit = "a".repeat(40);
    },
    (m) => {
      m.goVersion = "go1.26.0";
    },
    (m) => {
      m.binary.name = "../stdlib-demo";
    },
    (m) => {
      m.binary.sizeBytes = String(binary.length);
    },
    (m) => {
      m.binary.sizeBytes = 0;
    },
    (m) => {
      m.binary.sha256 = m.binary.sha256.toUpperCase();
    },
    (m) => {
      m.binary.sha256 = "0".repeat(64);
    },
    (m) => {
      m.behavior.args = ["other"];
    },
    (m) => {
      m.behavior.stdout = "different";
      m.behavior.stdoutSha256 = createHash("sha256")
        .update("different")
        .digest("hex");
    },
    (m) => {
      m.behavior.stdoutSha256 = "0".repeat(64);
    },
    (m) => {
      delete m.sourceCommit;
    },
    (m) => {
      m.unrecognized = true;
    },
    (m) => {
      m.binary.unrecognized = true;
    },
    (m) => {
      m.behavior.unrecognized = true;
    },
    (m) => {
      m.binary = [];
    },
  ]) {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() =>
      verifyBuildDownloads(
        Buffer.from(JSON.stringify(changed)),
        binary,
        manifest.sourceCommit,
      ),
    );
  }
  for (const bad of [
    Buffer.from("{"),
    Buffer.from("null"),
    Buffer.from("[]"),
    Buffer.alloc(16385),
    Buffer.from([0xff]),
    Buffer.from(
      bytes
        .toString()
        .replace('"schemaVersion":1', '"schemaVersion":2,"schemaVersion":1'),
    ),
  ])
    assert.throws(() =>
      verifyBuildDownloads(bad, binary, manifest.sourceCommit),
    );
});

test("fixed source receipt requires a new complete commit and exact versioned fields", () => {
  const initial = "a".repeat(40);
  assert.throws(
    () =>
      fixedSourceCommit(
        { schemaVersion: 1, sourceCommit: "b".repeat(40) },
        "short",
      ),
    /Initial source/,
  );
  assert.equal(
    fixedSourceCommit(
      { schemaVersion: 1, sourceCommit: "b".repeat(40) },
      initial,
    ),
    "b".repeat(40),
  );
  for (const bad of [
    null,
    [],
    {},
    { schemaVersion: 2, sourceCommit: "b".repeat(40) },
    { schemaVersion: 1, sourceCommit: initial },
    { schemaVersion: 1, sourceCommit: "b".repeat(7) },
    { schemaVersion: 1, sourceCommit: "b".repeat(40), extra: true },
  ])
    assert.throws(() => fixedSourceCommit(bad, initial));
});

test("private build coordination bounds receipts and preserves downloaded bytes without execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "arcentra-contract-"));
  const config = { coordinationDir: directory, expectedCommit: "a".repeat(40) };
  try {
    await chmod(directory, 0o700);
    const details = {
      projectId: "project-1",
      pipelineId: "pipeline-1",
      runId: "run-failed",
      sourceCommit: config.expectedCommit,
    };
    await writeBuildReceipt(config, "failed-run.json", details);
    for (const runId of ["../unsafe", "unsafe\n", "a".repeat(65)])
      await assert.rejects(
        writeBuildReceipt(config, "successful-run.json", { ...details, runId }),
        /safe fixture identifiers/,
      );
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, "failed-run.json"), "utf8")),
      { schemaVersion: 1, ...details },
    );
    assert.equal(
      (await stat(join(directory, "failed-run.json"))).mode & 0o777,
      0o600,
    );
    await assert.rejects(stat(join(directory, "failed-run.json.browser-tmp")), {
      code: "ENOENT",
    });
    await assert.rejects(
      waitForFixedSource(config, { timeoutMs: 1 }),
      /Timed out/,
    );
    await writeFile(
      join(directory, "fixed-source.json"),
      JSON.stringify({ schemaVersion: 1, sourceCommit: "b".repeat(40) }),
      { mode: 0o600 },
    );
    assert.equal(await waitForFixedSource(config), "b".repeat(40));
    await writeFile(join(directory, "fixed-source.json"), " ".repeat(4097));
    await assert.rejects(
      waitForFixedSource(config),
      /bounded single-link regular file/,
    );
    await writeFile(
      join(directory, "fixed-source.json"),
      '{"schemaVersion":2,"schemaVersion":1,"sourceCommit":"' +
        "b".repeat(40) +
        '"}',
    );
    await assert.rejects(waitForFixedSource(config), /duplicate keys/);
    const { bytes, binary, manifest } = sampleBuild();
    await saveBuildDownloads(config, bytes, binary, manifest.sourceCommit);
    assert.deepEqual(
      await readFile(join(directory, "downloads", "stdlib-demo")),
      binary,
    );
    assert.deepEqual(
      await readFile(join(directory, "downloads", "manifest.json")),
      bytes,
    );
    assert.equal(
      (await stat(join(directory, "downloads", "stdlib-demo"))).mode & 0o777,
      0o600,
    );
    await assert.rejects(
      saveBuildDownloads(config, bytes, binary, manifest.sourceCommit),
      { code: "EEXIST" },
    );
    await chmod(directory, 0o755);
    await assert.rejects(
      writeBuildReceipt(config, "successful-run.json", {
        ...details,
        runId: "run-success",
      }),
      /must be private/,
    );
    await chmod(directory, 0o700);
    await symlink(directory, join(directory, "link"));
    await assert.rejects(
      waitForFixedSource({
        ...config,
        coordinationDir: join(directory, "link"),
      }),
      /real directory/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fixed source receipt refuses symlink, hardlink, public/executable file and FIFO", async () => {
  const directory = await mkdtemp(join(tmpdir(), "arcentra-receipt-"));
  const config = { coordinationDir: directory, expectedCommit: "a".repeat(40) };
  const target = join(directory, "fixed-source.json");
  const original = join(directory, "source.json");
  try {
    await writeFile(
      original,
      JSON.stringify({ schemaVersion: 1, sourceCommit: "b".repeat(40) }),
      { mode: 0o600 },
    );
    await symlink(original, target);
    await assert.rejects(waitForFixedSource(config), { code: "ELOOP" });
    await unlink(target);
    await link(original, target);
    await assert.rejects(waitForFixedSource(config), /single-link/);
    await unlink(target);
    await writeFile(target, await readFile(original), { mode: 0o644 });
    await assert.rejects(
      waitForFixedSource(config),
      /private and non-executable/,
    );
    await chmod(target, 0o700);
    await assert.rejects(
      waitForFixedSource(config),
      /private and non-executable/,
    );
    await unlink(target);
    execFileSync("mkfifo", [target]);
    await assert.rejects(waitForFixedSource(config), /regular file/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const artifactCase of [
  { list: [], total: 0, valid: true },
  { list: [{ pipelineRunId: "run-failed" }], total: 1, valid: false },
  { list: [], total: 1, valid: false },
])
  test(`failed-run empty artifact check rejects hidden or returned artifacts: ${JSON.stringify(artifactCase)}`, async () => {
    const observations = [];
    const page = {
      getByRole: (role) =>
        role === "textbox"
          ? { fill: async () => {} }
          : { click: async () => {} },
      waitForResponse: () =>
        Promise.resolve({
          status: () => 200,
          json: async () => ({ code: 200, detail: artifactCase }),
        }),
      waitForURL: async () => {},
      getByText: (text) => ({ waitFor: async () => observations.push(text) }),
    };
    const result = applyArtifactRunFilter(page, "project-1", "run-failed", {
      expectEmpty: true,
    });
    if (artifactCase.valid) {
      assert.deepEqual(await result, []);
      assert.deepEqual(observations, [
        "0 matching artifacts",
        "No artifacts match your filters.",
      ]);
    } else await assert.rejects(result);
  });

test("storage setup cannot write successful build receipts and preserves separate-context evidence", async () => {
  const config = actualBackendConfig({
    ...buildEnv(),
    ARCENTRA_ACCEPTANCE_PHASE: "storage-setup",
  });
  const calls = [];
  await writeCompletedBuildReceipt(config, undefined, async (...args) =>
    calls.push(args),
  );
  assert.deepEqual(calls, []);
  await assert.rejects(
    writeCompletedBuildReceipt(config, { runId: "wrong" }, async () => {}),
    /cannot produce/,
  );
  const sourceCommit = "a".repeat(40);
  const summary = {
    kind: "actual-backend",
    status: "passed",
    stage: "storage-setup-complete",
    ...firstBuildReadinessEvidence({
      phase: "storage-setup",
      sourceCommit,
      steps: [...firstBuildPreflightSteps, ...firstBuildStorageSteps],
    }),
  };
  assert.deepEqual(storageSetupStepsFromSummary(summary, sourceCommit), [
    ...firstBuildPreflightSteps,
    ...firstBuildStorageSteps,
  ]);
  for (const patch of [
    { status: "failed" },
    { kind: "simulated-transport" },
    { stage: "preflight-complete" },
  ])
    assert.throws(
      () =>
        storageSetupStepsFromSummary({ ...summary, ...patch }, sourceCommit),
      /same-source/,
    );
  for (const patch of [
    { phase: "build" },
    { sourceCommit: "b".repeat(40) },
    { steps: [...firstBuildPreflightSteps] },
    {
      steps: [
        ...firstBuildPreflightSteps,
        ...firstBuildStorageSteps,
        "extra-secret",
      ],
    },
    { token: "private-token" },
  ])
    assert.throws(
      () =>
        storageSetupStepsFromSummary(
          {
            ...summary,
            firstBuildReadiness: { ...summary.firstBuildReadiness, ...patch },
          },
          sourceCommit,
        ),
      /same-source/,
    );
  assert.throws(
    () => preflightStepsFromSummary(summary, sourceCommit),
    /same-source/,
  );
});

test("storage fixture profiles are exact and public data cannot expose credential values", () => {
  for (const endpoint of ["127.0.0.1:19000", "minio:9000"]) {
    const config = syntheticStorageConfig(endpoint);
    const { accessKey, secretKey, ...publicConfig } = config;
    const value = {
      storageId: "acceptance",
      storageType: "minio",
      name: storageInitialName,
      isDefault: 0,
      isEnabled: 1,
      config: publicConfig,
      configuredFields: ["accessKey", "secretKey"],
    };
    assertPublicStorage(value, endpoint);
    assertNoStorageSecrets(value, endpoint);
    for (const patch of [
      { config },
      { configuredFields: ["secretKey"] },
      { isEnabled: 0 },
      { storageType: "s3" },
      { config: { ...publicConfig, token: "unknown-value" } },
      { description: secretKey },
    ]) {
      assert.throws(() =>
        assertPublicStorage({ ...value, ...patch }, endpoint),
      );
    }
    for (const secret of storageSensitiveValues(endpoint)) {
      let error;
      try {
        assertNoStorageSecrets({ secret }, endpoint);
      } catch (caught) {
        error = caught;
      }
      assert.ok(error);
      assert.equal(
        error.message.includes(secret),
        false,
        "Credential values must not enter assertion errors",
      );
      assert.equal(
        redactDiagnosticText(
          `before ${secret} after`,
          storageSensitiveValues(endpoint),
        ),
        "before [REDACTED] after",
      );
    }
  }
  for (const endpoint of [
    "localhost:19000",
    "http://127.0.0.1:19000",
    "minio:9001",
    "https://external.example",
    "127.0.0.1:19000/",
  ])
    assert.throws(() => syntheticStorageConfig(endpoint), /exact synthetic/);
});

test("diagnostics detect and redact actual UI wire config and arbitrary JSON field order", () => {
  const endpoint = "127.0.0.1:19000";
  const config = syntheticStorageConfig(endpoint);
  const wire = Object.fromEntries(
    [
      "endpoint",
      "bucket",
      "region",
      "basePath",
      "useTLS",
      "accessKey",
      "secretKey",
    ].map((key) => [key, config[key]]),
  );
  for (const value of [
    wire,
    Object.fromEntries(Object.entries(config).reverse()),
  ]) {
    for (const spacing of [undefined, 2]) {
      const encoded = Buffer.from(
        JSON.stringify(value, null, spacing),
      ).toString("base64");
      const body = JSON.stringify({ config: encoded });
      assert.throws(
        () => assertNoStorageSecrets(body, endpoint),
        /credentials must not appear/,
      );
      assert.equal(
        redactDiagnosticText(body, [config.accessKey, config.secretKey]),
        '{"config":"[REDACTED]"}',
      );
    }
  }
});

test("failure screenshots fail closed on exposed credentials or populated inputs", async () => {
  const secret = "synthetic-sensitive-credential";
  let content = "safe page";
  let inputs = [{ value: "" }];
  const page = {
    content: async () => content,
    locator: () => ({ evaluateAll: async (fn) => fn(inputs) }),
  };
  assert.equal(await safeFailureScreenshot(page, [secret]), true);
  inputs = [{ value: secret }];
  assert.equal(await safeFailureScreenshot(page, [secret]), false);
  inputs = [];
  content = `<div>${secret}</div>`;
  assert.equal(await safeFailureScreenshot(page, [secret]), false);
  content = Buffer.from(JSON.stringify({ secretKey: secret })).toString(
    "base64",
  );
  assert.equal(await safeFailureScreenshot(page, [secret]), false);
  assert.equal(
    await safeFailureScreenshot(
      {
        content: async () => {
          throw new Error("page closed");
        },
      },
      [secret],
    ),
    false,
  );
});

function consoleDiagnosticFixture() {
  const diagnostics = {
    console: [],
    secretExposureCount: 0,
    consoleInspectionFailureCount: 0,
    lateConsoleEventCount: 0,
  };
  const secret = "synthetic-console-private-value";
  const collector = createConsoleCollector(diagnostics, [secret]);
  const message = ({
    text = "Object",
    level = "log",
    value,
    inspect,
  } = {}) => ({
    type: () => level,
    text: () => text,
    location: () => ({ url: "http://127.0.0.1/source.js" }),
    args: () =>
      inspect
        ? [{ jsonValue: inspect }]
        : value === undefined
          ? []
          : [{ jsonValue: async () => value }],
  });
  return { diagnostics, secret, collector, message };
}

test("console collector detects text canaries at every level without retaining values", async () => {
  for (const level of ["log", "info", "debug", "warning", "error"]) {
    const { diagnostics, secret, collector, message } =
      consoleDiagnosticFixture();
    collector.accept(message({ text: secret, level }));
    await assert.rejects(
      finalizeConsoleObservation(collector, async () => {}),
      /synthetic credential/,
    );
    assert.equal(diagnostics.secretExposureCount, 1);
    assert.equal(JSON.stringify(diagnostics).includes(secret), false);
  }
});

test("console Object arguments expose nested raw and reordered encoded Axios-like data", async () => {
  for (const encoded of [false, true]) {
    const { diagnostics, secret, collector, message } =
      consoleDiagnosticFixture();
    const config = {
      region: "fixture",
      secretKey: secret,
      endpoint: "127.0.0.1:19000",
    };
    const data = encoded
      ? Buffer.from(JSON.stringify(config, null, 2)).toString("base64")
      : JSON.stringify(config);
    collector.accept(message({ value: { config: { data } } }));
    await assert.rejects(
      finalizeConsoleObservation(collector, async () => {}),
      /synthetic credential/,
    );
    assert.equal(diagnostics.secretExposureCount, 1);
    assert.equal(JSON.stringify(diagnostics).includes(secret), false);
    assert.equal(JSON.stringify(diagnostics).includes(data), false);
  }
});

test("console inspection rejection, synchronous throw and cyclic values fail without copying private errors", async () => {
  for (const mode of ["reject", "throw", "cyclic"]) {
    const { diagnostics, secret, collector, message } =
      consoleDiagnosticFixture();
    const cyclic = {};
    cyclic.self = cyclic;
    const inspect = () => {
      if (mode === "throw") throw new Error(secret);
      if (mode === "reject") return Promise.reject(new Error(secret));
      return Promise.resolve(cyclic);
    };
    collector.accept(message({ inspect }));
    await assert.rejects(
      finalizeConsoleObservation(collector, async () => {}),
      (error) => {
        assert.match(error.message, /must be inspectable/);
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
    assert.equal(diagnostics.consoleInspectionFailureCount, 1);
    assert.equal(JSON.stringify(diagnostics).includes(secret), false);
  }
});

test("never-resolving console inspection remains inside the journey deadline", async () => {
  const { collector, message } = consoleDiagnosticFixture();
  collector.accept(message({ inspect: () => new Promise(() => {}) }));
  let closed = false;
  let passed = false;
  await assert.rejects(
    withBrowserDeadline(async () => {
      await finalizeConsoleObservation(collector, async () => {
        closed = true;
      });
      passed = true;
    }, 25),
    /total timeout/,
  );
  assert.equal(passed, false);
  assert.equal(closed, false);
});

test("events added during a pending drain are inspected before closure and verdict", async () => {
  const { diagnostics, secret, collector, message } =
    consoleDiagnosticFixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  collector.accept(message({ inspect: () => gate }));
  let closed = false;
  const finalized = withBrowserDeadline(
    () =>
      finalizeConsoleObservation(collector, async () => {
        closed = true;
      }),
    1000,
  );
  collector.accept(message({ value: { config: { data: secret } } }));
  release({ safe: true });
  await assert.rejects(finalized, /synthetic credential/);
  assert.equal(closed, true);
  assert.equal(diagnostics.secretExposureCount, 1);
});

test("console events delivered during browser close cannot pass unnoticed", async () => {
  const { diagnostics, secret, collector, message } =
    consoleDiagnosticFixture();
  let passed = false;
  let closed = false;
  await assert.rejects(
    withBrowserDeadline(async () => {
      await finalizeConsoleObservation(collector, async () => {
        collector.accept(message({ value: { secret } }));
        closed = true;
      });
      passed = true;
    }, 1000),
    /synthetic credential/,
  );
  assert.equal(closed, true);
  assert.equal(passed, false);
  assert.equal(diagnostics.secretExposureCount, 1);
});

test("clean observation passes only after close and final drain; sealed late delivery fails closed", async () => {
  const { diagnostics, collector, message } = consoleDiagnosticFixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let closing = false;
  let passed = false;
  const final = withBrowserDeadline(async () => {
    await finalizeConsoleObservation(collector, async () => {
      closing = true;
      collector.accept(message({ inspect: () => gate }));
    });
    passed = true;
  }, 1000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closing, true);
  assert.equal(passed, false);
  release({ safe: true });
  await final;
  assert.equal(passed, true);
  collector.accept(message());
  assert.equal(diagnostics.lateConsoleEventCount, 1);
  assert.equal(diagnostics.consoleInspectionFailureCount, 1);
  assert.throws(() => collector.assertClean(), /must be inspectable/);
});

test("storage reload ignores old-document refresh and binds the new main-frame request", async () => {
  const page = new EventEmitter();
  const mainFrame = {};
  const childFrame = {};
  const request = (
    frame = mainFrame,
    method = "GET",
    path = "/api/v1/storage/configs",
  ) => ({
    frame: () => frame,
    method: () => method,
    url: () => `http://127.0.0.1:5174${path}`,
  });
  const oldRequest = request();
  const earlyRequest = request();
  const childRequest = request(childFrame);
  const wrongMethod = request(mainFrame, "POST");
  const newRequest = request();
  const ignored = [];
  let bodyReads = 0;
  const staleResponse = (req) => ({
    request: () => req,
    json: async () => {
      throw new Error("Destroyed old document body must never be read");
    },
  });
  const freshResponse = {
    request: () => newRequest,
    json: async () => {
      bodyReads++;
      return { code: 200, detail: [{ isDefault: 1 }] };
    },
  };
  page.mainFrame = () => mainFrame;
  page.waitForResponse = (predicate, options) => {
    assert.equal(options.timeout, 30_000);
    return new Promise((resolve) => {
      const listener = (response) => {
        if (predicate(response)) {
          page.off("response", listener);
          resolve(response);
        } else ignored.push(response);
      };
      page.on("response", listener);
    });
  };
  page.reload = async () => {
    // A pre-reload request can respond after navigation; so can a request
    // launched before the new main-frame document commits.
    page.emit("request", oldRequest);
    page.emit("framenavigated", childFrame);
    page.emit("request", earlyRequest);
    page.emit("framenavigated", mainFrame);
    page.emit("response", staleResponse(oldRequest));
    page.emit("response", staleResponse(earlyRequest));
    page.emit("request", childRequest);
    page.emit("response", staleResponse(childRequest));
    page.emit("request", wrongMethod);
    page.emit("response", staleResponse(wrongMethod));
    page.emit("request", newRequest);
    page.emit("response", freshResponse);
  };
  const response = await storageResponseAfterReload(page);
  assert.equal(response, freshResponse);
  assert.deepEqual(await response.json(), {
    code: 200,
    detail: [{ isDefault: 1 }],
  });
  assert.equal(bodyReads, 1);
  assert.equal(ignored.length, 4);
  assert.equal(page.listenerCount("framenavigated"), 0);
  assert.equal(page.listenerCount("request"), 0);
});

test("storage reload does not hide navigation failure or leave request observers attached", async () => {
  const page = new EventEmitter();
  page.mainFrame = () => ({});
  page.waitForResponse = () => new Promise(() => {});
  page.reload = async () => {
    throw new Error("Synthetic reload rejected");
  };
  await assert.rejects(
    storageResponseAfterReload(page),
    /Synthetic reload rejected/,
  );
  assert.equal(page.listenerCount("framenavigated"), 0);
  assert.equal(page.listenerCount("request"), 0);
});

// Pure checks for the read-only honesty journey; no browser or socket is opened.
test("honesty membership comparison rejects foreign, duplicated, absent and invented rows", async () => {
  const { memberRows } = await import("./ui-honesty-journey.mjs");
  assert.deepEqual(memberRows({ list: null, total: 0 }, "project-a"), []);
  assert.deepEqual(
    memberRows(
      {
        list: [
          {
            projectId: "project-a",
            userId: "stored-user",
            name: "ignored enrichment",
          },
        ],
        total: 1,
      },
      "project-a",
    ),
    [["stored-user", "project-a"]],
  );
  for (const snapshot of [
    { list: [{ projectId: "project-b", userId: "stored-user" }], total: 1 },
    {
      list: [
        { projectId: "project-a", userId: "stored-user" },
        { projectId: "project-a", userId: "stored-user" },
      ],
      total: 2,
    },
    { list: [], total: 1 },
    { list: [{ projectId: "project-a", userId: " " }], total: 1 },
    { list: undefined, total: 0 },
  ])
    assert.throws(() => memberRows(snapshot, "project-a"));
});

test("honesty agent totals describe only the returned page and separate registered count", async () => {
  const { agentPageSummary } = await import("./ui-honesty-journey.mjs");
  const snapshot = {
    count: 37,
    agents: [
      { isEnabled: 1, status: 3 },
      { isEnabled: 0, status: 2 },
    ],
  };
  assert.deepEqual(agentPageSummary(snapshot), [
    "37 registered agents · 2 loaded on this page",
    "0 available · 1 busy · 1 offline · 1 disabled on this page",
  ]);
  assert.throws(() => agentPageSummary({ ...snapshot, count: 1 }));
  assert.throws(() => agentPageSummary({ count: 0, agents: null }));
});

test("honesty settings comparison binds the project ID and does not substitute fake metadata", async () => {
  const { projectDetailRows } = await import("./ui-honesty-journey.mjs");
  const project = {
    projectId: "project-a",
    orgId: "scope-a",
    name: "real-project",
    displayName: "",
    description: "",
    repoUrl: "http://127.0.0.1:3000/team/repo.git",
    defaultBranch: "release",
  };
  assert.deepEqual(projectDetailRows(project, "project-a"), [
    ["Project ID", "project-a"],
    ["Scope ID", "scope-a"],
    ["Project name", "real-project"],
    ["Display name", "Not provided"],
    ["Description", "Not provided"],
    ["Linked repository", project.repoUrl],
    ["Default branch", "release"],
  ]);
  assert.throws(() => projectDetailRows(project, "project-b"));
  assert.throws(() =>
    projectDetailRows(
      {
        ...project,
        repoUrl: "https://fixture-user:fixture-password@example.test/repo",
      },
      "project-a",
    ),
  );
});

test("honesty content assertions reject old fake inventory, recovery claims and actions", async () => {
  const { assertHonestContent } = await import("./ui-honesty-journey.mjs");
  const scope = (text, buttons = 0) => ({
    innerText: async () => text,
    getByRole: () => ({ count: async () => buttons }),
  });
  for (const text of [
    "John Doe",
    "API_KEY",
    "All caught up",
    "undone within 7 days",
    "94.2%",
    "cluster · running",
  ])
    await assert.rejects(assertHonestContent(scope(text)));
  await assert.rejects(assertHonestContent(scope("Read only", 1)));
  await assertHonestContent(
    scope(
      "No member associations are recorded. Access may still be granted through role grants.",
    ),
  );
});

test("honesty GET helper consumes the exact response body before returning and propagates body failure", async () => {
  const { readAfter } = await import("./ui-honesty-journey.mjs");
  let predicate;
  let deliver;
  let finishBody;
  const page = {
    waitForResponse: (test) => {
      predicate = test;
      return new Promise((resolve) => {
        deliver = resolve;
      });
    },
  };
  const response = (path, method = "GET") => ({
    url: () => `http://fixture.test/api/v1${path}`,
    request: () => ({ method: () => method }),
  });
  let finished = false;
  const result = readAfter(
    page,
    "/agent",
    async () => {
      assert.equal(predicate(response("/agent?pageNum=2&pageSize=20")), false);
      assert.equal(
        predicate(response("/agent?pageNum=1&pageSize=20", "POST")),
        false,
      );
      assert.equal(
        predicate(response("/project/a?pageNum=1&pageSize=20")),
        false,
      );
      assert.equal(
        predicate(response("/agent?pageNum=1&pageSize=100")),
        false,
        "An in-flight Build readiness response must not satisfy Dashboard health",
      );
      const matching = response("/agent?pageNum=1&pageSize=20");
      assert.equal(predicate(matching), true);
      deliver(matching);
    },
    () =>
      new Promise((resolve) => {
        finishBody = resolve;
      }),
    { pageNum: "1", pageSize: "20" },
  ).then((value) => {
    finished = true;
    return value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    finished,
    false,
    "Response headers alone must not finish the read",
  );
  finishBody({ agents: [], count: 0 });
  assert.deepEqual(await result, { agents: [], count: 0 });
  await assert.rejects(
    readAfter(
      { waitForResponse: async () => response("/agent") },
      "/agent",
      async () => {},
      async () => {
        throw new Error("Unreadable response body");
      },
    ),
    /Unreadable response body/,
  );
});

test("honesty fixture keeps member permissions project-scoped and rejects mutation requests", async () => {
  const { honestyFixture } = await import("./ui-honesty-fixture.mjs");
  const fixture = honestyFixture({ projectId: "project-1" });
  fixture.state.active = true;
  const invoke = async (path, method = "GET") => {
    let result;
    const handled = await fixture.route({
      request: () => ({
        url: () => `http://fixture.test/api/v1${path}`,
        method: () => method,
      }),
      fulfill: async (value) => {
        result = value;
      },
    });
    return { handled, result };
  };
  assert.equal(
    (await invoke("/me/effective-actions?scopeType=project&scopeId=project-1"))
      .handled,
    false,
    "Normal project permissions must retain the existing admin response",
  );
  assert.equal(
    (await invoke("/me/effective-actions?scopeType=platform")).handled,
    false,
  );
  assert.equal((await invoke("/me/effective-actions")).handled, false);
  assert.equal(
    (await invoke("/me/effective-actions?scopeType=project")).handled,
    false,
    "Global Build has no project ID and retains its existing permission response",
  );
  assert.deepEqual(
    (await invoke("/project/project-1/members")).result.json.detail,
    {
      list: [
        {
          projectId: "project-1",
          userId: "association-user-1",
          username: "",
          displayName: "",
          roleId: "",
          version: 1,
          hasOtherAccess: true,
          isProtectedOwner: false,
        },
      ],
      total: 1,
      canManageMembers: false,
      canAssignOwner: false,
      assignableRoleIds: [],
    },
  );
  await assert.rejects(
    invoke("/me/effective-actions?scopeType=project&scopeId=foreign"),
  );
  await assert.rejects(invoke("/project/project-1/members", "POST"));
  fixture.state.memberMode = "denied";
  assert.equal((await invoke("/project/project-1/members")).result.status, 403);
  fixture.state.memberPermission = false;
  assert.deepEqual(
    (await invoke("/me/effective-actions?scopeType=project&scopeId=project-1"))
      .result.json.detail,
    ["project:read"],
  );
  assert.equal(
    (await invoke("/secrets")).handled,
    false,
    "No fabricated secret API is provided",
  );
  assert.equal(
    (await invoke("/notifications")).handled,
    false,
    "No fabricated notification API is provided",
  );
  assert.equal(
    (await invoke("/users/")).handled,
    false,
    "No global user enrichment is provided",
  );
});

test("Agent fixture request identities distinguish only exact health and Build pagination", async () => {
  const { agentFixtureConsumer } = await import("./ui-honesty-fixture.mjs");
  const request = (path, method = "GET") => ({
    url: () => `http://fixture.test/api/v1${path}`,
    method: () => method,
  });
  assert.equal(
    agentFixtureConsumer(request("/agent?pageNum=1&pageSize=20")),
    "dashboard-health",
  );
  assert.equal(
    agentFixtureConsumer(request("/agent?pageSize=100&pageNum=1")),
    "build-readiness",
  );
  for (const path of [
    "/agent",
    "/agent?pageNum=2&pageSize=20",
    "/agent?pageNum=1&pageSize=50",
    "/agent?pageNum=1&pageSize=100&pageSize=20",
    "/agent?pageNum=1&pageSize=20&filter=extra",
    "/agent?pageNum=1&pageNum=2&pageSize=100",
    "/agent/statistics?pageNum=1&pageSize=20",
  ])
    assert.throws(() => agentFixtureConsumer(request(path)));
  assert.throws(() =>
    agentFixtureConsumer(request("/agent?pageNum=1&pageSize=20", "POST")),
  );
});

test("active honesty fixture leaves in-flight Build reads and normal permissions to the original transport", async () => {
  const { honestyFixture } = await import("./ui-honesty-fixture.mjs");
  const fixture = honestyFixture({ projectId: "project-1" });
  fixture.state.active = true;
  const invoke = async (path) => {
    let result;
    const handled = await fixture.route({
      request: () => ({
        url: () => `http://fixture.test/api/v1${path}`,
        method: () => "GET",
      }),
      fulfill: async (value) => {
        result = value;
      },
    });
    return { handled, result };
  };
  const readiness = "/agent?pageNum=1&pageSize=100";
  const health = "/agent?pageNum=1&pageSize=20";
  assert.deepEqual(await invoke(readiness), {
    handled: false,
    result: undefined,
  });
  assert.equal(fixture.state.agentReads, 0);
  assert.deepEqual((await invoke(health)).result.json.detail, fixture.agents);
  assert.equal(fixture.state.agentReads, 1);
  // A delayed old-page poll remains the same consumer even after health denial.
  fixture.state.agentDenied = true;
  assert.deepEqual(await invoke(readiness), {
    handled: false,
    result: undefined,
  });
  assert.equal(fixture.state.agentReads, 1);
  assert.equal((await invoke(health)).result.status, 403);
  assert.equal(fixture.state.agentReads, 2);
  assert.deepEqual(
    await invoke("/me/effective-actions?scopeType=project&scopeId=project-1"),
    { handled: false, result: undefined },
  );
  assert.deepEqual(await invoke("/me/effective-actions?scopeType=platform"), {
    handled: false,
    result: undefined,
  });
  fixture.state.agentPermission = false;
  assert.deepEqual(
    (await invoke("/me/effective-actions?scopeType=platform")).result.json
      .detail,
    ["pipeline:read"],
  );
  assert.deepEqual(
    await invoke("/me/effective-actions?scopeType=project&scopeId=project-1"),
    { handled: false, result: undefined },
  );
  assert.deepEqual(await invoke("/me/effective-actions"), {
    handled: false,
    result: undefined,
  });
});

test("organization journey summary includes only bounded IDs and verified exact steps", async () => {
  const { organizationManagementEvidence, organizationManagementSteps } =
    await import("./organization-journey.mjs");
  assert.deepEqual(organizationManagementEvidence(undefined), {});
  const evidence = {
    orgId: "org-one",
    projectId: "project-one",
    steps: [...organizationManagementSteps],
    token: "PRIVATE-CANARY",
  };
  const summary =
    organizationManagementEvidence(evidence).organizationManagement;
  assert.deepEqual(Object.keys(summary).sort(), [
    "completed",
    "journey",
    "orgId",
    "projectId",
    "steps",
  ]);
  assert.equal(summary.completed, true);
  assert.equal(summary.steps.length, 15);
  assert.equal(JSON.stringify(summary).includes("CANARY"), false);
  assert.equal(
    organizationManagementEvidence({ steps: [] }).organizationManagement
      .completed,
    false,
  );
  assert.throws(() =>
    organizationManagementEvidence({ ...evidence, steps: ["fake-success"] }),
  );
  assert.throws(() =>
    organizationManagementEvidence({
      ...evidence,
      steps: [...organizationManagementSteps, organizationManagementSteps[0]],
    }),
  );
  assert.throws(() =>
    organizationManagementEvidence({
      ...evidence,
      orgId: "https://private.example/secret",
    }),
  );
});

test("actual organization journey requires explicit build opt-in and an existing bounded synthetic user ID", () => {
  const env = {
    ...buildEnv(),
    ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY: "1",
    ARCENTRA_ACCEPTANCE_MEMBER_USER_ID: "observer-user",
  };
  const config = actualBackendConfig(env);
  assert.equal(config.organizationJourney, true);
  assert.equal(config.memberUserId, "observer-user");
  for (const change of [
    { ARCENTRA_ACCEPTANCE_MEMBER_USER_ID: undefined },
    { ARCENTRA_ACCEPTANCE_MEMBER_USER_ID: "https://untrusted.example" },
    { ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY: undefined },
    { ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY: "true" },
    { ARCENTRA_ACCEPTANCE_PHASE: "preflight" },
  ])
    assert.throws(() => actualBackendConfig({ ...env, ...change }));
});

test("every organization browser stage and failure location is explicitly allowlisted", async () => {
  const { organizationManagementStages } =
    await import("./organization-journey.mjs");
  const source = await readFile(
    new URL("./organization-journey.mjs", import.meta.url),
    "utf8",
  );
  const emitted = [...source.matchAll(/setStage\("([^"]+)"\)/g)].map(
    (match) => match[1],
  );
  assert.ok(emitted.length >= 10);
  assert.deepEqual(emitted, [...organizationManagementStages]);
  for (const stage of emitted)
    assert.equal(
      safeFailureEvidence(stage, new Error("PRIVATE-CANARY")).stage,
      stage,
    );
  const error = {
    stack: `Error: PRIVATE-CANARY\n    at test (${fileURLToPath(new URL("./organization-journey.mjs", import.meta.url))}:9:3)`,
  };
  assert.deepEqual(safeFailureEvidence(emitted[0], error), {
    stage: emitted[0],
    failureSite: { file: "organization-journey.mjs", line: 9, column: 3 },
  });
  assert.throws(() =>
    actualBackendConfig({
      ...buildEnv(),
      ARCENTRA_ACCEPTANCE_ORGANIZATION_JOURNEY: "0",
    }),
  );
  assert.equal(actualBackendConfig(buildEnv()).organizationJourney, undefined);
});

test("public console evidence keeps only bounded classifications and never raw values", () => {
  const secret = "PRIVATE_CANARY";
  const path = `/api/v1/organization/${secret}`;
  const entries = [
    {
      type: "error",
      text: `Failed to load resource: the server responded with a status of 409 (${secret})`,
      url: `http://${secret}.invalid${path}?token=${secret}`,
      stage: "organization-archive-conflict",
    },
    {
      type: "error",
      text: `In HTML, <button> cannot be a descendant of <button>. ${secret}`,
      url: `http://fixture.invalid/src/${secret}.tsx`,
      stage: secret,
    },
  ];
  const value = safeConsoleErrorEvidence(
    entries,
    [{ path, status: 409 }],
    new Set(),
  );
  assert.equal(JSON.stringify(value).includes(secret), false);
  assert.deepEqual(value.consoleErrorEvidence[0], {
    category: "http-resource",
    observationPhase: "journey",
    stage: "organization-archive-conflict",
    source: "organization",
    status: 409,
    responseStatuses: [409],
    networkError: "unclassified",
  });
  assert.equal(value.consoleErrorEvidence[1].category, "react-dom-nesting");
  assert.equal(value.consoleErrorEvidence[1].stage, "unknown");
  assert.equal(
    safeConsoleErrorEvidence(entries, [], new Set([`${path}:409`]))
      .consoleErrorEvidence.length,
    1,
  );
  const bounded = safeConsoleErrorEvidence(
    Array(40).fill(entries[1]),
    [],
    new Set(),
  );
  assert.equal(bounded.consoleErrorEvidence.length, 16);
  assert.equal(bounded.consoleErrorEvidenceTruncated, true);
  assert.equal(expectedResourceError(entries[1], new Set()), false);
});

test("resource failure detail is a fixed network enum and static asset category", () => {
  for (const [path, source] of [
    ["/node_modules/.vite/deps/PRIVATE.js?token=PRIVATE", "vite-dependency"],
    ["/src/PRIVATE.tsx", "application-module"],
    ["/@vite/PRIVATE", "vite-client"],
  ]) {
    const [entry] = safeConsoleErrorEvidence(
      [
        {
          type: "error",
          text: "Failed to load resource: net::ERR_CONNECTION_RESET PRIVATE",
          url: `http://PRIVATE.invalid${path}`,
          stage: "login",
        },
      ],
      [],
      new Set(),
    ).consoleErrorEvidence;
    assert.equal(entry.source, source);
    assert.equal(entry.networkError, "ERR_CONNECTION_RESET");
    assert.equal(JSON.stringify(entry).includes("PRIVATE"), false);
  }
  const value = safeConsoleErrorEvidence(
    [{ type: "error", text: "net::PRIVATE", url: "invalid", stage: "login" }],
    [],
    new Set(),
  );
  assert.equal(value.consoleErrorEvidence[0].networkError, "unclassified");
  assert.equal(JSON.stringify(value).includes("PRIVATE"), false);
});

test("unlisted network error suffixes never match a shorter known enum", () => {
  for (const token of [
    "ERR_FAILED_PRIVATE",
    "ERR_CONNECTION_RESET_EXTRA",
    "ERR_NOT_LISTED",
  ]) {
    const entry = safeConsoleErrorEvidence(
      [{ type: "error", text: `net::${token}`, url: "invalid" }],
      [],
      new Set(),
    ).consoleErrorEvidence[0];
    assert.equal(entry.networkError, "unclassified");
    assert.equal(JSON.stringify(entry).includes(token), false);
  }
});

test("static frontend evidence bounds resource and server diagnostics without raw data", () => {
  const event = {
    url: "http://PRIVATE.invalid/node_modules/.vite/deps/chunk-ABC12345.js?token=PRIVATE",
    error: "net::ERR_ABORTED PRIVATE",
    mime: "text/javascript; PRIVATE",
    status: 504,
    stage: "login",
    atMs: 123.9,
  };
  const value = safeBrowserRuntimeEvidence(
    [event],
    {
      managed: true,
      ready: true,
      readyAfterMs: 42,
      observedForMs: 123,
      exitCode: 1,
      signal: "PRIVATE",
    },
    "PRIVATE Pre-transform error",
  );
  assert.equal(JSON.stringify(value).includes("PRIVATE"), false);
  assert.deepEqual(value.staticResourceEvidence[0], {
    source: "vite-dependency",
    observationPhase: "journey",
    asset: "hashed-chunk.js",
    mime: "text/javascript",
    status: 504,
    networkError: "ERR_ABORTED",
    stage: "login",
    atMs: 123,
  });
  assert.equal(value.frontendServer.exitCodeBeforeCleanup, 1);
  assert.deepEqual(value.frontendServer.logFlags, ["Pre-transform error"]);
  assert.equal(value.frontendServer.signalBeforeCleanup, null);
  const bounded = safeBrowserRuntimeEvidence(
    Array(40).fill({
      ...event,
      url: "http://PRIVATE.invalid/src/PRIVATE.tsx",
      atMs: Infinity,
      status: 999,
      mime: "PRIVATE",
    }),
    {},
    "",
  );
  assert.equal(bounded.staticResourceEvidence.length, 16);
  assert.equal(bounded.staticResourceEvidenceTruncated, true);
  assert.equal(bounded.staticResourceEvidence[0].asset, "other");
  assert.equal(bounded.staticResourceEvidence[0].status, null);
  assert.equal(bounded.staticResourceEvidence[0].atMs, null);
  assert.equal(JSON.stringify(bounded).includes("PRIVATE"), false);
});

test("diagnostics distinguish browser cleanup without forgiving its errors", () => {
  const entry = {
    type: "error",
    text: "Failed to load resource: net::ERR_ABORTED",
    url: "http://127.0.0.1/src/main.tsx",
    stage: "journey-complete",
    observationPhase: "browser-closing",
  };
  assert.equal(
    safeConsoleErrorEvidence([entry], [], new Set()).consoleErrorEvidence[0]
      .observationPhase,
    "browser-closing",
  );
  assert.equal(expectedResourceError(entry, new Set()), false);
  const value = safeBrowserRuntimeEvidence(
    [{ ...entry, error: entry.text }],
    { managed: false },
    "",
  );
  assert.equal(value.frontendServer.mode, "external-unknown");
  assert.equal(
    value.staticResourceEvidence[0].observationPhase,
    "browser-closing",
  );
});

test("project secret config accepts only distinct synthetic build-phase values", async () => {
  const { projectSecretConfig } = await import("./project-secrets-journey.mjs");
  const env = {
    ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE:
      "synthetic-ci-secret-InitialFixture001",
    ARCENTRA_ACCEPTANCE_SECRET_ROTATED_VALUE:
      "synthetic-ci-secret-RotatedFixture002",
  };
  assert.equal(projectSecretConfig(env, "build").projectSecretsJourney, true);
  assert.deepEqual(projectSecretConfig({}, "build"), {});
  for (const phase of ["preflight", "storage-setup"])
    assert.throws(() => projectSecretConfig(env, phase));
  for (const change of [
    { ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE: undefined },
    { ARCENTRA_ACCEPTANCE_SECRET_ROTATED_VALUE: undefined },
    {
      ARCENTRA_ACCEPTANCE_SECRET_ROTATED_VALUE:
        env.ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE,
    },
    {
      ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE:
        "actual-looking-unbounded-credential",
    },
  ])
    assert.throws(() => projectSecretConfig({ ...env, ...change }, "build"));
});

test("secret evidence and safe failure sites retain only bounded metadata", async () => {
  const {
    projectSecretSteps,
    projectSecretStages,
    projectSecretsEvidence,
    assertNoProjectSecretValues,
  } = await import("./project-secrets-journey.mjs");
  const evidence = {
    projectId: "project-1",
    activeSecretId: "secret-1",
    disabledSecretId: "secret-2",
    steps: [...projectSecretSteps],
    value: "synthetic-private-ignored",
  };
  const result = projectSecretsEvidence(evidence).projectSecrets;
  assert.equal(result.completed, true);
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      "journey",
      "completed",
      "projectId",
      "activeSecretId",
      "disabledSecretId",
      "steps",
    ].sort(),
  );
  assert.equal(
    JSON.stringify(result).includes("synthetic-private-ignored"),
    false,
  );
  assert.throws(() =>
    projectSecretsEvidence({
      ...evidence,
      activeSecretId: "private?key=value",
    }),
  );
  assert.throws(() =>
    projectSecretsEvidence({
      ...evidence,
      steps: [...projectSecretSteps, projectSecretSteps[0]],
    }),
  );
  assert.throws(() =>
    projectSecretsEvidence({ ...evidence, steps: ["unknown"] }),
  );
  assert.throws(() =>
    assertNoProjectSecretValues({ nested: "synthetic-sensitive-canary" }, [
      "synthetic-sensitive-canary",
    ]),
  );
  for (const stage of projectSecretStages)
    assert.equal(safeFailureEvidence(stage, new Error("private")).stage, stage);
  const error = {
    stack: `Error: PRIVATE-CANARY\n    at test (${fileURLToPath(new URL("./project-secrets-journey.mjs", import.meta.url))}:9:3)`,
  };
  assert.deepEqual(safeFailureEvidence(projectSecretStages[0], error), {
    stage: projectSecretStages[0],
    failureSite: { file: "project-secrets-journey.mjs", line: 9, column: 3 },
  });
});

test("strict secret fixture preserves metadata-only writes and rejects stale versions", async () => {
  const { projectSecretsFixture, syntheticProjectSecretValues } =
    await import("./project-secrets-fixture.mjs");
  const fixture = projectSecretsFixture();
  fixture.state.active = true;
  async function invoke(path, method = "GET", body) {
    let result;
    const handled = await fixture.route({
      request: () => ({
        url: () => `http://127.0.0.1/api/v1${path}`,
        method: () => method,
        postDataJSON: () => body,
      }),
      fulfill: async (value) => {
        result = value;
      },
    });
    assert.equal(handled, true);
    return result;
  }
  const path = "/project/project-1/secrets";
  assert.equal((await invoke(path)).json.detail.total, 0);
  const row = (
    await invoke(path, "POST", {
      name: "CI_BUILD_TOKEN",
      secretType: "token",
      description: "",
      value: syntheticProjectSecretValues[0],
    })
  ).json.detail;
  assert.equal(row.version, "opaque-v1");
  const edited = (
    await invoke(`${path}/${row.secretId}`, "PATCH", {
      version: row.version,
      description: "Reviewed",
    })
  ).json.detail;
  assert.equal(edited.version, "opaque-v2");
  assert.ok(
    fixture.state.stored.get(row.secretId) === syntheticProjectSecretValues[0],
  );
  await assert.rejects(
    invoke(`${path}/${row.secretId}`, "PATCH", {
      version: row.version,
      description: "Stale",
    }),
  );
  await assert.rejects(invoke(`${path}/${row.secretId}`, "GET"));
  const rotated = (
    await invoke(`${path}/${row.secretId}/rotate`, "POST", {
      version: edited.version,
      value: syntheticProjectSecretValues[1],
    })
  ).json.detail;
  assert.equal(rotated.version, "opaque-v3");
  const disabled = (
    await invoke(`${path}/${row.secretId}/disable`, "POST", {
      version: rotated.version,
    })
  ).json.detail;
  assert.equal(disabled.isEnabled, 0);
  assert.equal(disabled.canRotate, false);
  fixture.state.mode = "denied-read";
  assert.equal((await invoke(path)).status, 403);
});
