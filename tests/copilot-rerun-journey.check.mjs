import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIndependentRerunApproval,
  assertRerunBrowserReceipt,
  assertRerunBrowserReview,
  runRerunBrowserPreparation,
  validateRerunBrowserContract,
} from "./copilot-rerun-journey.mjs";
const valid = () => ({
  version: "copilot-terminal-rerun-browser-v1",
  actorId: "requester",
  projectId: "project",
  pipelineId: "pipeline",
  originalRunId: "old-run",
  originalJobRunId: "old-job",
  definitionRevision: "d".repeat(40),
  expectedSourceCommit: "e".repeat(40),
  resolvedSpecDigest: "a".repeat(64),
  snapshotDigest: "b".repeat(64),
});
const review = () => ({
  ...valid(),
  originalRunStatus: 4,
  originalJobStatus: 5,
  retryMode: "whole_job",
  definition: {
    revision: valid().definitionRevision,
    resolvedSpecDigest: valid().resolvedSpecDigest,
  },
  source: { expectedCommit: valid().expectedSourceCommit },
  policy: { candidates: ["candidate"] },
});
const prepared = () => ({
  ...valid(),
  intentId: "intent",
  requestId: "request",
  newRunId: "new-run",
  newJobRunId: "new-job",
  intentDigest: "c".repeat(64),
  reviewedRunContextDigest: "f".repeat(64),
  state: "prepared",
  version: 1,
  createdAt: "2026-10-19T00:00:00Z",
  expiresAt: "2026-10-19T00:10:00Z",
  serverTime: "2026-10-19T00:00:00Z",
  reviewStatus: "current",
  canConfirm: true,
  canCancelPrepared: true,
  cancelNewExecutionAvailable: false,
  review: review(),
});
const confirmed = () => ({
  ...prepared(),
  state: "confirmed",
  version: 2,
  confirmedAt: "2026-10-19T00:01:00Z",
  canConfirm: false,
  canCancelPrepared: false,
});
test("strict explicit fixture contract", () =>
  validateRerunBrowserContract(valid()));
for (const field of Object.keys(valid()))
  test(`reject missing ${field}`, () => {
    const v = valid();
    delete v[field];
    assert.throws(() => validateRerunBrowserContract(v));
  });
for (const [field, value] of [
  ["version", "simulated"],
  ["projectId", "../other"],
  ["expectedSourceCommit", "main"],
  ["definitionRevision", "abc123"],
  ["snapshotDigest", ""],
  ["url", "https://external.invalid"],
])
  test(`reject altered ${field}`, () =>
    assert.throws(() =>
      validateRerunBrowserContract({ ...valid(), [field]: value }),
    ));
test("full failed original and distinct immutable source/definition review", () =>
  assertRerunBrowserReview(review(), valid()));
for (const [field, value] of [
  ["originalRunStatus", 3],
  ["originalJobStatus", 3],
  ["originalRunId", "another"],
  ["retryMode", "failed_step"],
  ["source", { expectedCommit: "moved" }],
  [
    "definition",
    { revision: "main", resolvedSpecDigest: valid().resolvedSpecDigest },
  ],
  ["policy", { candidates: ["requester"] }],
])
  test(`reject unsupported review ${field}`, () =>
    assert.throws(() =>
      assertRerunBrowserReview({ ...review(), [field]: value }, valid()),
    ));
test("prepared and confirmed fixed identity/timestamps", () => {
  assertRerunBrowserReceipt(prepared(), valid());
  assertRerunBrowserReceipt(confirmed(), valid(), prepared());
  assertRerunBrowserReceipt(confirmed(), valid(), confirmed());
});
for (const [field, value] of [
  ["newRunId", "old-run"],
  ["newJobRunId", "old-job"],
  ["requestId", "new-request"],
  ["intentDigest", "d".repeat(64)],
  ["reviewedRunContextDigest", "d".repeat(64)],
  ["version", 3],
  ["confirmedAt", "2026-10-19T01:00:00Z"],
  ["decisionId", "old-vote"],
  ["state", "running"],
  ["cancelNewExecutionAvailable", true],
])
  test(`reject confirmation drift ${field}`, () =>
    assert.throws(() =>
      assertRerunBrowserReceipt(
        { ...confirmed(), [field]: value },
        valid(),
        prepared(),
      ),
    ));
const approval = () => ({
  approvalId: "new-approval",
  pipelineRunId: "new-run",
  retryJobRunId: "new-job",
  plugin: "builtin:retry-approval",
  bindingKind: "retry_whole_job_v1",
  requestedBy: "requester",
  retryReview: {
    evidence: {
      approvalId: "new-approval",
      context: {
        actorId: "requester",
        pipelineRunId: "new-run",
        definitionCommitSha: valid().definitionRevision,
        resolvedDefinitionDigest: valid().resolvedSpecDigest,
        policy: { candidates: ["candidate"] },
      },
      identity: {
        pipelineRunId: "new-run",
        jobRunId: "new-job",
        claimId: "new-claim",
      },
      inputs: { sourceCommit: valid().expectedSourceCommit },
    },
  },
});
test("independent NEW approval evidence", () =>
  assertIndependentRerunApproval(
    approval(),
    valid(),
    confirmed(),
    "candidate",
  ));
test("requester may not self-approve", () =>
  assert.throws(() =>
    assertIndependentRerunApproval(
      approval(),
      valid(),
      confirmed(),
      "requester",
    ),
  ));
test("old evidence cannot approve new run", () => {
  const v = approval();
  v.retryReview.evidence.identity.jobRunId = "old-job";
  assert.throws(() =>
    assertIndependentRerunApproval(v, valid(), confirmed(), "candidate"),
  );
});
test("moved source cannot approve new run", () => {
  const v = approval();
  v.retryReview.evidence.inputs.sourceCommit = "f".repeat(40);
  assert.throws(() =>
    assertIndependentRerunApproval(v, valid(), confirmed(), "candidate"),
  );
});

test("prepared receipt rejects contradictory lifecycle timestamps", () => {
  for (const field of ["confirmedAt", "cancelledAt"])
    assert.throws(() =>
      assertRerunBrowserReceipt(
        { ...prepared(), [field]: "2026-10-19T00:01:00Z" },
        valid(),
      ),
    );
});
test("confirmed receipt rejects cancellation timestamp", () =>
  assert.throws(() =>
    assertRerunBrowserReceipt(
      { ...confirmed(), cancelledAt: "2026-10-19T00:01:00Z" },
      valid(),
      prepared(),
    ),
  ));

for (const status of [401, 403, 409, 500, 503])
  test(`scope loading rejects the exact Copilot status HTTP ${status} before waiting for availability`, async () => {
    const stages = [];
    const observedPaths = [];
    let availabilityRead = false;
    let listenerRemoved = false;
    const root = "http://127.0.0.1:4173";
    const response = (path, code, detail) => ({
      request: () => ({ method: () => "GET" }),
      url: () => `${root}${path}`,
      status: () => code,
      headerValue: async () => "private, no-store",
      json: async () => ({ code, detail }),
    });
    const page = {
      on(event) {
        assert.equal(event, "request");
      },
      off(event) {
        assert.equal(event, "request");
        listenerRemoved = true;
      },
      goto: async () => {},
      waitForResponse(predicate) {
        const profile = response("/api/v1/users/fetch", 200, {
          userId: valid().actorId,
        });
        const configuration = response(
          "/api/v1/projects/project/copilot/status",
          status,
          {},
        );
        for (const candidate of [profile, configuration])
          if (predicate(candidate)) {
            observedPaths.push(new URL(candidate.url()).pathname);
            return Promise.resolve(candidate);
          }
        return new Promise(() => {}); // Unreachable UI never requests availability.
      },
      getByLabel: () => ({ fill: async () => {} }),
      getByRole(role) {
        if (role === "region")
          return {
            waitFor() {
              availabilityRead = true;
              throw new Error("unreachable control");
            },
          };
        assert.equal(role, "button");
        return { click: async () => {} };
      },
    };
    await assert.rejects(
      runRerunBrowserPreparation({
        page,
        base: root,
        contract: valid(),
        deadline: Date.now() + 10_000,
        setStage: (stage) => stages.push(stage),
      }),
      (error) =>
        error.code === "ERR_ASSERTION" &&
        error.actual === status &&
        error.expected === 200,
    );
    assert.deepEqual(stages, [
      "copilot-rerun-open",
      "copilot-rerun-load-scope",
    ]);
    assert.deepEqual(observedPaths, [
      "/api/v1/users/fetch",
      "/api/v1/projects/project/copilot/status",
    ]);
    assert.equal(availabilityRead, false);
    assert.equal(listenerRemoved, true);
  });
