import assert from "node:assert/strict";
import test from "node:test";
import {
  validateExecutionBrowserContract,
  assertExecutionBrowserIdentity,
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
