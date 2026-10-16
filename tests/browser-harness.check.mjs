import assert from "node:assert/strict";
import { test } from "node:test";
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
  firstBuildReadinessEvidence,
  preflightStepsFromSummary,
  artifactDownloadEvidence,
  expectedResourceError,
  isNativeOptionDisabled,
  loopbackURL,
  safeFailureEvidence,
  selectedRunStatus,
  writeCompletedBuildReceipt,
} from "./browser-harness.mjs";
import { fileURLToPath } from "node:url";
import {
  assertRetryEditorViewports,
  containerRetryFixtures,
} from "./retry-policy-fixture.mjs";
import {
  applyArtifactRunFilter,
  assertControlReachable,
} from "./artifact-controls.mjs";

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

test("actual acceptance phase defaults to the full build and rejects any unknown skip mode", () => {
  assert.equal(actualBackendConfig(buildEnv()).phase, "build");
  for (const phase of ["preflight", "build"])
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
