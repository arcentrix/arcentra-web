/** Strict, credential-free wire checks only. Passing these checks is not runtime acceptance. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const contractVersion = "copilot-terminal-rerun-outcome-browser-v1";
const isId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const isDigest = (v) =>
  typeof v === "string" && /^(?:v1:)?[a-f0-9]{64}$/.test(v);
const isSha = (v) =>
  typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const millis = (v) => Number.isSafeInteger(v) && v > 0;
const boundedText = (v, n) =>
  typeof v === "string" &&
  v.length > 0 &&
  Buffer.byteLength(v) <= n &&
  !/[\x00-\x1f\x7f]/.test(v);
function keys(v, names) {
  assert.ok(v && typeof v === "object" && !Array.isArray(v), "Object required");
  assert.deepEqual(
    Object.keys(v).sort(),
    [...names].sort(),
    "Exact contract fields required",
  );
}
const ids = (v, names) =>
  names.forEach((key) => assert.ok(isId(v[key]), `Invalid ${key}`));
function uniqueIds(v) {
  assert.ok(
    Array.isArray(v) && v.length > 0 && v.length <= 32 && v.every(isId),
  );
  assert.equal(new Set(v).size, v.length, "IDs must be unique");
}
export function validatePreparationScope(scope) {
  keys(scope, [
    "version",
    "actorId",
    "projectId",
    "pipelineId",
    "originalRunId",
    "originalJobRunId",
    "definitionRevision",
    "expectedSourceCommit",
    "resolvedSpecDigest",
    "snapshotDigest",
  ]);
  assert.equal(scope.version, "copilot-terminal-rerun-browser-v1");
  ids(scope, [
    "actorId",
    "projectId",
    "pipelineId",
    "originalRunId",
    "originalJobRunId",
  ]);
  for (const key of ["definitionRevision", "expectedSourceCommit"])
    assert.ok(isSha(scope[key]), `Full ${key} required`);
  for (const key of ["resolvedSpecDigest", "snapshotDigest"])
    assert.ok(isDigest(scope[key]), `Exact ${key} required`);
  return scope;
}
export function validateOutcomeContract(f, now = Date.now()) {
  assert.ok(
    Buffer.byteLength(JSON.stringify(f)) <= 16384,
    "Bounded contract required",
  );
  keys(f, [
    "version",
    "scope",
    "actorId",
    "firstApproverId",
    "deadlineUnixMilli",
    "fixedTime",
    "original",
    "target",
    "expectedOutput",
  ]);
  assert.equal(f.version, contractVersion);
  validatePreparationScope(f.scope);
  ids(f, ["actorId", "firstApproverId"]);
  assert.equal(
    new Set([f.scope.actorId, f.actorId, f.firstApproverId]).size,
    3,
    "Requester and both candidates must differ",
  );
  assert.ok(
    millis(f.deadlineUnixMilli) && f.deadlineUnixMilli > now,
    "Original parent deadline must remain live",
  );
  keys(f.fixedTime, ["cutoffUnixMilli", "originalFinishedAtUnixMilli"]);
  assert.ok(
    millis(f.fixedTime.cutoffUnixMilli) &&
      millis(f.fixedTime.originalFinishedAtUnixMilli),
  );
  assert.ok(
    f.fixedTime.originalFinishedAtUnixMilli < f.fixedTime.cutoffUnixMilli,
    "Original must actually finish before cutoff",
  );
  assert.ok(
    f.fixedTime.cutoffUnixMilli <= now,
    "Wait for the fixed cutoff before creating the new approval",
  );
  keys(f.original, ["claimId", "approvalId", "stepRunIds"]);
  ids(f.original, ["claimId", "approvalId"]);
  uniqueIds(f.original.stepRunIds);
  keys(f.target, [
    "requestId",
    "intentId",
    "runId",
    "jobRunId",
    "agentId",
    "claimId",
    "approvalId",
    "evidenceHash",
    "approvalExpiresAtUnixMilli",
    "steps",
  ]);
  ids(f.target, [
    "requestId",
    "intentId",
    "runId",
    "jobRunId",
    "agentId",
    "claimId",
    "approvalId",
  ]);
  assert.ok(isDigest(f.target.evidenceHash));
  assert.ok(
    millis(f.target.approvalExpiresAtUnixMilli) &&
      f.target.approvalExpiresAtUnixMilli > now,
    "Actual approval deadline must remain live",
  );
  assert.notEqual(f.target.runId, f.scope.originalRunId);
  assert.notEqual(f.target.jobRunId, f.scope.originalJobRunId);
  assert.notEqual(f.target.claimId, f.original.claimId);
  assert.notEqual(f.target.approvalId, f.original.approvalId);
  assert.ok(
    Array.isArray(f.target.steps) && f.target.steps.length === 2,
    "Minimal fixture is one shell followed by one upload",
  );
  const allIds = [];
  for (const [i, step] of f.target.steps.entries()) {
    keys(step, ["name", "stepIndex", "uses", "action", "attemptRunIds"]);
    assert.ok(boundedText(step.name, 128));
    assert.ok(Number.isSafeInteger(step.stepIndex) && step.stepIndex >= 0);
    assert.equal(step.uses, i === 0 ? "shell" : "builtin:artifacts");
    if (i === 0) assert.ok(["", "run"].includes(step.action));
    else assert.equal(step.action, "upload");
    uniqueIds(step.attemptRunIds);
    assert.ok(step.attemptRunIds.length >= 2 && step.attemptRunIds.length <= 5);
    allIds.push(...step.attemptRunIds);
  }
  assert.ok(f.target.steps[0].stepIndex < f.target.steps[1].stepIndex);
  assert.notEqual(f.target.steps[0].name, f.target.steps[1].name);
  assert.equal(
    f.target.steps[0].attemptRunIds.length,
    f.target.steps[1].attemptRunIds.length,
  );
  uniqueIds(allIds);
  assert.ok(
    allIds.every((value) => !f.original.stepRunIds.includes(value)),
    "Every new Step identity must differ",
  );
  keys(f.expectedOutput, ["name", "size", "sha256", "logMarker"]);
  assert.ok(boundedText(f.expectedOutput.name, 256));
  assert.ok(
    !f.expectedOutput.name.startsWith("/") &&
      !f.expectedOutput.name.includes("\\") &&
      f.expectedOutput.name
        .split("/")
        .every((part) => part && part !== "." && part !== ".."),
  );
  assert.ok(
    Number.isSafeInteger(f.expectedOutput.size) &&
      f.expectedOutput.size > 0 &&
      f.expectedOutput.size <= 1024 * 1024,
  );
  assert.match(f.expectedOutput.sha256, /^[a-f0-9]{64}$/);
  assert.ok(boundedText(f.expectedOutput.logMarker, 128));
  return f;
}

export function assertApprovalEvidence(value, f, state) {
  assert.ok(["pending", "approved"].includes(state));
  assert.ok(value && typeof value === "object");
  const t = f.target,
    s = f.scope;
  assert.equal(value.approvalId, t.approvalId);
  assert.equal(value.pipelineRunId, t.runId);
  assert.equal(value.retryJobRunId, t.jobRunId);
  assert.equal(value.plugin, "builtin:retry-approval");
  assert.equal(value.bindingKind, "retry_whole_job_v1");
  assert.ok(!value.deploymentReleaseId);
  assert.equal(value.requestedBy, s.actorId);
  assert.equal(value.evidenceHash, t.evidenceHash);
  assert.equal(Date.parse(value.expiresAt), t.approvalExpiresAtUnixMilli);
  assert.ok(Number.isSafeInteger(value.version) && value.version > 0);
  assert.equal(value.mode, "all");
  assert.equal(value.requiredApproverCount, 2);
  assert.equal(value.rejectedCount, 0);
  assert.deepEqual(
    JSON.parse(value.candidateApprovers).sort(),
    [f.actorId, f.firstApproverId].sort(),
  );
  assert.equal(value.status, state === "pending" ? 0 : 1);
  assert.equal(value.approvedCount, state === "pending" ? 1 : 2);
  assert.equal(value.canApprove, state === "pending");
  assert.equal(
    value.viewerDecision,
    state === "pending" ? undefined : "approved",
  );
  const review = value.retryReview,
    evidence = review?.evidence;
  assert.ok(evidence);
  assert.equal(review.approvalId, t.approvalId);
  assert.equal(review.retryJobRunId, t.jobRunId);
  assert.equal(review.evidenceHash, t.evidenceHash);
  assert.equal(review.status, value.status);
  assert.equal(evidence.version, 1);
  assert.equal(evidence.kind, "retry_whole_job_v1");
  assert.equal(evidence.approvalId, t.approvalId);
  assert.equal(evidence.expiresAtUnixMilli, t.approvalExpiresAtUnixMilli);
  assert.ok(
    millis(evidence.createdAtUnixMilli) &&
      evidence.createdAtUnixMilli >= f.fixedTime.cutoffUnixMilli &&
      evidence.createdAtUnixMilli < evidence.expiresAtUnixMilli,
  );
  for (const [key, expected] of Object.entries({
    projectId: s.projectId,
    pipelineId: s.pipelineId,
    pipelineRunId: t.runId,
    actorId: s.actorId,
    definitionCommitSha: s.definitionRevision,
    resolvedDefinitionDigest: s.resolvedSpecDigest,
  }))
    assert.equal(evidence.context[key], expected, `Approval context ${key}`);
  for (const [key, expected] of Object.entries({
    pipelineId: s.pipelineId,
    pipelineRunId: t.runId,
    jobRunId: t.jobRunId,
    agentId: t.agentId,
    claimId: t.claimId,
  }))
    assert.equal(evidence.identity[key], expected, `Approval identity ${key}`);
  assert.equal(evidence.context.policy.mode, "all");
  assert.equal(evidence.context.policy.requiredApproverCount, 2);
  assert.deepEqual(
    [...evidence.context.policy.candidates].sort(),
    [f.actorId, f.firstApproverId].sort(),
  );
  assert.equal(evidence.inputs.sourceCommit, s.expectedSourceCommit);
  assert.deepEqual(evidence.inputs.artifacts, []);
  assert.deepEqual(evidence.artifacts, []);
  for (const [key, expected] of Object.entries({
    PipelineID: s.pipelineId,
    PipelineRunID: t.runId,
    JobRunID: t.jobRunId,
    Type: "git",
  }))
    assert.equal(evidence.source[key], expected);
  assert.equal(evidence.runtime.type, "containerd-offline-v1");
  assert.equal(evidence.retryPlan.version, 1);
  assert.equal(evidence.retryPlan.retryApprovalRequired, true);
  assert.equal(evidence.retryPlan.policy.mode, "whole_job");
  assert.equal(evidence.retryPlan.policy.idempotent, true);
  assert.equal(
    evidence.retryPlan.policy.max_attempts,
    t.steps[0].attemptRunIds.length,
  );
  assert.deepEqual(evidence.retryPlan.policy.allowed_exit_codes, [23]);
  assert.deepEqual(
    evidence.retryPlan.steps.map(
      ({ name, stepIndex, uses, action, attemptRunIds }) => ({
        name,
        stepIndex,
        uses,
        action,
        attemptRunIds,
      }),
    ),
    t.steps,
  );
  assert.ok(
    evidence.retryPlan.steps.every((step) => step.continueOnError === false),
  );
  return evidence;
}

function oneJob(jobs) {
  assert.ok(
    jobs &&
      Array.isArray(jobs.list) &&
      jobs.list.length === 1 &&
      jobs.total === 1,
    "One exact job required",
  );
  return jobs.list[0];
}
function assertRun(run, job, f, original) {
  const runId = original ? f.scope.originalRunId : f.target.runId;
  const jobId = original ? f.scope.originalJobRunId : f.target.jobRunId;
  assert.equal(run.runId, runId);
  assert.equal(run.pipelineId, f.scope.pipelineId);
  assert.equal(run.definitionCommitSha, f.scope.definitionRevision);
  assert.equal(job.pipelineId, f.scope.pipelineId);
  assert.equal(job.pipelineRunId, runId);
  assert.equal(job.jobRunId, jobId);
  assert.equal(job.sourceExpectationCaptured, true);
  assert.equal(job.sourceType, "git");
  assert.equal(job.sourceProvenanceState, "reported");
  assert.equal(job.sourceResolvedCommit, f.scope.expectedSourceCommit);
  assert.ok(boundedText(job.sourceRepository, 2048));
  assert.ok(isId(job.agentId));
  assert.ok(
    Number.isFinite(Date.parse(job.startTime)) &&
      Date.parse(job.endTime) >= Date.parse(job.startTime),
  );
}
export function assertOriginalFailed(run, jobs, f) {
  const job = oneJob(jobs);
  assertRun(run, job, f, true);
  assert.equal(run.status, 4);
  assert.equal(job.status, 5);
  assert.equal(
    Date.parse(job.endTime),
    f.fixedTime.originalFinishedAtUnixMilli,
  );
  assert.deepEqual(
    job.steps.map((step) => step.stepRunId).sort(),
    [...f.original.stepRunIds].sort(),
  );
  const shells = job.steps.filter((step) => step.uses === "shell");
  assert.equal(shells.length, f.target.steps[0].attemptRunIds.length);
  for (const step of job.steps) {
    assert.equal(step.jobRunId, job.jobRunId);
    if (step.uses === "shell") {
      assert.equal(step.status, 5);
      assert.equal(step.exitCode, 23);
      assert.ok(
        Number.isFinite(Date.parse(step.endTime)) &&
          Date.parse(step.endTime) < f.fixedTime.cutoffUnixMilli,
      );
    } else {
      assert.equal(step.uses, "builtin:artifacts");
      assert.equal(step.action, "upload");
      assert.equal(step.status, 8);
    }
  }
  return job;
}
export function assertNewSucceeded(run, jobs, logs, f) {
  const job = oneJob(jobs);
  assertRun(run, job, f, false);
  assert.equal(run.status, 3);
  assert.equal(job.status, 4);
  assert.equal(job.agentId, f.target.agentId);
  assert.ok(Date.parse(job.startTime) >= f.fixedTime.cutoffUnixMilli);
  const stepIds = f.target.steps.flatMap((step) => step.attemptRunIds);
  assert.deepEqual(
    job.steps.map((step) => step.stepRunId).sort(),
    [...stepIds].sort(),
  );
  for (const expected of f.target.steps)
    for (const [index, stepRunId] of expected.attemptRunIds.entries()) {
      const step = job.steps.find((value) => value.stepRunId === stepRunId);
      for (const [key, value] of Object.entries({
        jobRunId: job.jobRunId,
        name: expected.name,
        stepIndex: expected.stepIndex,
        uses: expected.uses,
        action: expected.action,
        attempt: index + 1,
        retryMode: "whole_job",
      }))
        assert.equal(step[key], value, `New step ${key}`);
      assert.equal(step.status, index === 0 ? 4 : 8);
      if (index === 0) {
        assert.ok(
          Date.parse(step.startTime) >= f.fixedTime.cutoffUnixMilli &&
            Date.parse(step.endTime) >= Date.parse(step.startTime),
        );
        if (expected.uses === "shell") assert.equal(step.exitCode, 0);
      } else {
        assert.equal(step.startTime, null, "Unused generation must not start");
        assert.equal(step.exitCode, null);
      }
    }
  assert.ok(
    logs &&
      logs.truncated === false &&
      Array.isArray(logs.entries) &&
      logs.entries.length <= 1000,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(logs)) <= 1024 * 1024);
  assert.ok(
    logs.entries.every(
      (entry) =>
        entry.jobId === f.target.jobRunId &&
        stepIds.includes(entry.stepId) &&
        typeof entry.message === "string",
    ),
    "Logs must belong to exact new job/steps",
  );
  const markerSeen = logs.entries.some(
    (entry) =>
      entry.stepId === f.target.steps[0].attemptRunIds[0] &&
      entry.message.split(/\r?\n/).includes(f.expectedOutput.logMarker),
  );
  assert.equal(
    markerSeen,
    true,
    "Exact new command marker must be in actual logs",
  );
  return job;
}
export function assertArtifact(list, f) {
  assert.ok(
    Array.isArray(list) && list.length === 1,
    "Exactly one output artifact required",
  );
  const item = list[0];
  assert.ok(isId(item.artifactId));
  for (const [key, value] of Object.entries({
    projectId: f.scope.projectId,
    pipelineId: f.scope.pipelineId,
    pipelineRunId: f.target.runId,
    jobRunId: f.target.jobRunId,
    stepRunId: f.target.steps[1].attemptRunIds[0],
    name: f.expectedOutput.name,
    size: f.expectedOutput.size,
    sizeKnown: true,
    storageType: "s3",
    status: "available",
    downloadAvailable: true,
  }))
    assert.equal(item[key], value, `Artifact ${key}`);
  return item;
}
export function assertDownloadedBytes(bytes, f) {
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.length, f.expectedOutput.size);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256, f.expectedOutput.sha256);
  return { size: bytes.length, sha256 };
}
export function assertMutationTrace(mutations, f) {
  assert.deepEqual(
    mutations,
    [
      {
        method: "POST",
        path: `/api/v1/approvals/${f.target.approvalId}/approve`,
        body: { reason: "" },
      },
    ],
    "Exactly one independent vote and no trigger, Prepare, Confirm, cancel or duplicate POST",
  );
}
