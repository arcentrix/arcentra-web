import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actualBackendConfig,
  expectedResourceError,
  loopbackURL,
  safeFailureEvidence,
  selectedRunStatus,
} from "./browser-harness.mjs";
import { fileURLToPath } from "node:url";

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
