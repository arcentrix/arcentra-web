import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actualBackendConfig,
  expectedResourceError,
  loopbackURL,
} from "./browser-harness.mjs";

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
