import assert from "node:assert/strict";
import test from "node:test";
import {
  validateExecutionBrowserContract,
  assertExecutionBrowserIdentity,
  assertDisabledTerminalRerunProbe,
} from "./copilot-execution-journey.mjs";
const valid = () => ({
  version: "copilot-execution-browser-v1",
  actorId: "actor",
  approvalId: "approval",
  intentDigest: "a".repeat(64),
  intentId: "intent",
  intentVersion: 1,
  jobRunId: "job",
  projectId: "project",
  retryMode: "whole_job",
  runId: "run",
});
test("actual browser contract binds one whole-job intent", () =>
  assert.equal(
    validateExecutionBrowserContract(valid()).retryMode,
    "whole_job",
  ));
for (const field of Object.keys(valid()))
  test(`actual browser rejects missing ${field}`, () => {
    const value = valid();
    delete value[field];
    assert.throws(() => validateExecutionBrowserContract(value));
  });
for (const [field, value] of [
  ["retryMode", "failed_step"],
  ["intentVersion", 0],
  ["intentDigest", "unbound"],
  ["intentId", "../other"],
  ["version", "simulated"],
])
  test(`actual browser rejects altered ${field}`, () =>
    assert.throws(() =>
      validateExecutionBrowserContract({ ...valid(), [field]: value }),
    ));
test("actual browser rejects injected transport", () =>
  assert.throws(() =>
    validateExecutionBrowserContract({
      ...valid(),
      url: "https://external.invalid",
    }),
  ));

const submitted = () => ({
  ...valid(),
  state: "submitted",
  version: 2,
  createdAt: "2026-10-19T00:00:00Z",
  submittedAt: "2026-10-19T00:00:01Z",
  expiresAt: "2026-10-19T00:01:00Z",
  decisionId: "decision",
});
test("browser observations require exact durable identity and submission", () =>
  assertExecutionBrowserIdentity(submitted(), valid(), "submitted"));
for (const field of [
  "intentId",
  "projectId",
  "runId",
  "jobRunId",
  "approvalId",
  "intentDigest",
  "version",
  "submittedAt",
  "decisionId",
])
  test(`browser rejects response drift in ${field}`, () => {
    const value = submitted();
    value[field] = field === "decisionId" ? "" : "foreign";
    assert.throws(() =>
      assertExecutionBrowserIdentity(value, valid(), "submitted"),
    );
  });
test("browser rejects confirmation at or after expiry", () => {
  const value = submitted();
  value.submittedAt = value.expiresAt;
  assert.throws(() =>
    assertExecutionBrowserIdentity(value, valid(), "submitted"),
  );
});

const disabledProbe = () => {
  const path = "/api/v1/projects/project/copilot/rerun-intents/availability";
  const value = {
    url: `http://127.0.0.1:5174${path}`,
    method: "GET",
    status: 503,
    cache: "private, no-store",
    body: {
      code: 503,
      errMsg: "Whole-job new execution is temporarily unavailable",
      path,
      timestamp: 1792474000,
    },
  };
  const response = {
    url: () => value.url,
    request: () => ({ method: () => value.method }),
    status: () => value.status,
    headerValue: async () => value.cache,
    json: async () => value.body,
  };
  return { value, response, path };
};
test("retry-vote browser requires the exact disabled terminal-rerun envelope", async () => {
  const { response, path } = disabledProbe();
  assert.equal(
    await assertDisabledTerminalRerunProbe(
      response,
      "http://127.0.0.1:5174",
      "project",
    ),
    path,
  );
});
for (const [name, mutate] of [
  [
    "enabled response",
    (v) => {
      v.status = 200;
      v.body = { code: 200, detail: { available: true } };
    },
  ],
  [
    "unrelated route",
    (v) =>
      (v.url = v.url.replace(
        "rerun-intents/availability",
        "execution-intents/intent/confirm",
      )),
  ],
  [
    "another project",
    (v) => (v.url = v.url.replace("projects/project/", "projects/other/")),
  ],
  ["query string", (v) => (v.url += "?unexpected=true")],
  ["foreign origin", (v) => (v.url = v.url.replace("127.0.0.1", "localhost"))],
  ["mutation method", (v) => (v.method = "POST")],
  ["unexpected status", (v) => (v.status = 500)],
  ["cacheable response", (v) => (v.cache = "public, max-age=60")],
  ["wrong body code", (v) => (v.body.code = 500)],
  ["generic service failure", (v) => (v.body.errMsg = "Internal server error")],
  ["body path mismatch", (v) => (v.body.path += "/other")],
  ["unexpected body detail", (v) => (v.body.detail = { available: true })],
  ["invalid timestamp", (v) => (v.body.timestamp = "unknown")],
])
  test(`disabled terminal-rerun probe rejects ${name}`, async () => {
    const { response, value } = disabledProbe();
    mutate(value);
    await assert.rejects(() =>
      assertDisabledTerminalRerunProbe(
        response,
        "http://127.0.0.1:5174",
        "project",
      ),
    );
  });
