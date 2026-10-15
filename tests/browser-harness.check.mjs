import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  actualBackendConfig,
  artifactDownloadEvidence,
  expectedResourceError,
  isNativeOptionDisabled,
  loopbackURL,
  safeFailureEvidence,
  selectedRunStatus,
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
    [
      "unknown approval",
      "exact durable retry approval",
      "continueOnError",
      "continue_on_error",
    ],
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
  const exactFailedStep = JSON.parse(fixtures.blocked[1].text).jobs[0];
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
