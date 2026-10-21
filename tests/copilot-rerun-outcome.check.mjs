/** Offline contract/orchestration tests. Synthetic data below is never runtime evidence. */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateOutcomeContract,
  validateOwnerOutcomeContract,
  assertApprovalEvidence,
  assertOriginalFailed,
  assertNewSucceeded,
  assertArtifact,
  assertDownloadedBytes,
  assertMutationTrace,
} from "./copilot-rerun-outcome-contract.mjs";
import {
  driveOutcome,
  driveOwnerOutcome,
  remaining,
} from "./copilot-rerun-outcome-journey.mjs";
import {
  assertFrontendCheckout,
  assertManagedFrontendSummary,
  parseManagedFrontendSummary,
  readEntryContract,
} from "./copilot-rerun-entry-contract.mjs";

const now = 1_800_000_000_000;
const bytes = Buffer.from("synthetic frozen source proof\n");
const hash = createHash("sha256").update(bytes).digest("hex");
function fixture() {
  return {
    version: "copilot-terminal-rerun-outcome-browser-v1",
    scope: {
      version: "copilot-terminal-rerun-browser-v1",
      actorId: "requester",
      projectId: "project",
      pipelineId: "pipeline",
      originalRunId: "original-run",
      originalJobRunId: "original-job",
      definitionRevision: "d".repeat(40),
      expectedSourceCommit: "e".repeat(40),
      resolvedSpecDigest: "a".repeat(64),
      snapshotDigest: "b".repeat(64),
    },
    actorId: "second-candidate",
    firstApproverId: "first-candidate",
    deadlineUnixMilli: now + 30_000,
    fixedTime: {
      cutoffUnixMilli: now - 1000,
      originalFinishedAtUnixMilli: now - 5000,
    },
    original: {
      claimId: "old-claim",
      approvalId: "old-approval",
      stepRunIds: [
        "old-shell-1",
        "old-shell-2",
        "old-upload-1",
        "old-upload-2",
      ],
    },
    target: {
      requestId: "fixed-request",
      intentId: "fixed-intent",
      runId: "new-run",
      jobRunId: "new-job",
      agentId: "real-agent",
      claimId: "new-claim",
      approvalId: "new-approval",
      evidenceHash: "c".repeat(64),
      approvalExpiresAtUnixMilli: now + 20_000,
      steps: [
        {
          name: "proof",
          stepIndex: 0,
          uses: "shell",
          action: "",
          attemptRunIds: ["new-shell-1", "new-shell-2"],
        },
        {
          name: "publish",
          stepIndex: 1,
          uses: "builtin:artifacts",
          action: "upload",
          attemptRunIds: ["new-upload-1", "new-upload-2"],
        },
      ],
    },
    expectedOutput: {
      name: "proof/result.txt",
      size: bytes.length,
      sha256: hash,
      logMarker: "RERUN_SYNTHETIC_COMMAND_OK",
    },
  };
}
function approval(state = "pending") {
  const f = fixture(),
    t = f.target,
    s = f.scope;
  const value = {
    approvalId: t.approvalId,
    pipelineRunId: t.runId,
    retryJobRunId: t.jobRunId,
    plugin: "builtin:retry-approval",
    bindingKind: "retry_whole_job_v1",
    requestedBy: s.actorId,
    evidenceHash: t.evidenceHash,
    expiresAt: new Date(t.approvalExpiresAtUnixMilli).toISOString(),
    version: state === "pending" ? 2 : 3,
    mode: "all",
    requiredApproverCount: 2,
    rejectedCount: 0,
    candidateApprovers: JSON.stringify([f.firstApproverId, f.actorId]),
    status: state === "pending" ? 0 : 1,
    approvedCount: state === "pending" ? 1 : 2,
    canApprove: state === "pending",
    retryReview: {
      approvalId: t.approvalId,
      retryJobRunId: t.jobRunId,
      evidenceHash: t.evidenceHash,
      status: state === "pending" ? 0 : 1,
      evidence: {
        version: 1,
        kind: "retry_whole_job_v1",
        approvalId: t.approvalId,
        createdAtUnixMilli: now - 500,
        expiresAtUnixMilli: t.approvalExpiresAtUnixMilli,
        context: {
          projectId: s.projectId,
          pipelineId: s.pipelineId,
          pipelineRunId: t.runId,
          actorId: s.actorId,
          definitionCommitSha: s.definitionRevision,
          resolvedDefinitionDigest: s.resolvedSpecDigest,
          policy: {
            mode: "all",
            requiredApproverCount: 2,
            candidates: [f.firstApproverId, f.actorId],
          },
        },
        identity: {
          pipelineId: s.pipelineId,
          pipelineRunId: t.runId,
          jobRunId: t.jobRunId,
          agentId: t.agentId,
          claimId: t.claimId,
        },
        inputs: { sourceCommit: s.expectedSourceCommit, artifacts: [] },
        artifacts: [],
        source: {
          PipelineID: s.pipelineId,
          PipelineRunID: t.runId,
          JobRunID: t.jobRunId,
          Type: "git",
          Repository: "git://127.0.0.1:1234/synthetic",
          Ref: "main",
        },
        runtime: { type: "containerd-offline-v1" },
        retryPlan: {
          version: 1,
          retryApprovalRequired: true,
          policy: {
            mode: "whole_job",
            idempotent: true,
            max_attempts: 2,
            allowed_exit_codes: [23],
          },
          steps: t.steps.map((step) => ({ ...step, continueOnError: false })),
        },
      },
    },
  };
  if (state === "approved") value.viewerDecision = "approved";
  return value;
}
function execution(original = false) {
  const f = fixture(),
    s = f.scope,
    t = f.target;
  const runId = original ? s.originalRunId : t.runId;
  const jobId = original ? s.originalJobRunId : t.jobRunId;
  const job = {
    jobRunId: jobId,
    pipelineRunId: runId,
    pipelineId: s.pipelineId,
    jobName: "terminal-proof",
    agentId: t.agentId,
    status: original ? 5 : 4,
    sourceExpectationCaptured: true,
    sourceType: "git",
    sourceProvenanceState: "reported",
    sourceResolvedCommit: s.expectedSourceCommit,
    sourceRepository: "git://127.0.0.1:1234/synthetic",
    sourceRef: "main",
    startTime: new Date(original ? now - 9000 : now - 300).toISOString(),
    endTime: new Date(
      original ? f.fixedTime.originalFinishedAtUnixMilli : now + 100,
    ).toISOString(),
    steps: t.steps.flatMap((logical, logicalIndex) =>
      logical.attemptRunIds.map((id, index) => ({
        stepRunId: original
          ? f.original.stepRunIds[logicalIndex * 2 + index]
          : id,
        jobRunId: jobId,
        name: logical.name,
        stepIndex: logical.stepIndex,
        uses: logical.uses,
        action: logical.action,
        attempt: index + 1,
        retryMode: "whole_job",
        status: original ? (logicalIndex === 0 ? 5 : 8) : index === 0 ? 4 : 8,
        exitCode:
          logicalIndex === 0 ? (original ? 23 : index === 0 ? 0 : null) : null,
        startTime: original
          ? logicalIndex === 0
            ? new Date(now - 8000 + index * 1000).toISOString()
            : null
          : index === 0
            ? new Date(now - 200).toISOString()
            : null,
        endTime: original
          ? new Date(now - 6000 + index * 1000).toISOString()
          : new Date(now).toISOString(),
      })),
    ),
  };
  return {
    run: {
      runId,
      pipelineId: s.pipelineId,
      definitionCommitSha: s.definitionRevision,
      status: original ? 4 : 3,
    },
    jobs: { list: [job], total: 1 },
    logs: {
      entries: [
        {
          jobId,
          stepId: t.steps[0].attemptRunIds[0],
          message: f.expectedOutput.logMarker,
        },
      ],
      truncated: false,
    },
  };
}
function artifact() {
  const f = fixture();
  return {
    artifactId: "real-registered-artifact",
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
  };
}
const trace = () => [
  {
    method: "POST",
    path: "/api/v1/approvals/new-approval/approve",
    body: { reason: "" },
  },
];
function adapter(overrides = {}) {
  let clock = now;
  const calls = {
    votes: 0,
    downloads: 0,
    reads: 0,
    inspections: 0,
    rendered: 0,
  };
  const value = {
    now: () => clock,
    verifyIdentity: async (actor) => assert.equal(actor, fixture().actorId),
    readOriginal: async () => execution(true),
    openApproval: async () => approval(),
    voteOnce: async () => {
      calls.votes++;
      return approval("approved");
    },
    inspectApproval: async () => {
      calls.inspections++;
      return approval("approved");
    },
    closeApproval: async () => {},
    readNewExecution: async () => {
      calls.reads++;
      return execution();
    },
    verifyRenderedOutcome: async () => {
      calls.rendered++;
    },
    listNewArtifacts: async () => [artifact()],
    downloadOnce: async () => {
      calls.downloads++;
      return bytes;
    },
    listOriginalArtifacts: async () => [],
    pause: async (ms) => {
      clock += ms;
    },
    counts: () => ({ mutations: trace(), downloads: calls.downloads }),
    ...overrides,
  };
  return { value, calls };
}
function set(object, path, value) {
  const names = path.split(".");
  const last = names.pop();
  for (const key of names) object = object[key];
  object[last] = value;
}

test("valid minimal contract accepts fixed past cutoff, exact identity and two independent candidates", () =>
  validateOutcomeContract(fixture(), now));
for (const field of Object.keys(fixture()))
  test(`reject missing contract ${field}`, () => {
    const f = fixture();
    delete f[field];
    assert.throws(() => validateOutcomeContract(f, now));
  });
for (const [path, value] of [
  ["version", "confirmed-awaiting-independent-approval"],
  ["actorId", "requester"],
  ["firstApproverId", "second-candidate"],
  ["deadlineUnixMilli", now],
  ["fixedTime.cutoffUnixMilli", now + 1],
  ["fixedTime.originalFinishedAtUnixMilli", now],
  ["scope.expectedSourceCommit", "main"],
  ["scope.definitionRevision", "abc123"],
  ["scope.snapshotDigest", ""],
  ["scope.projectId", "../../other"],
  ["target.runId", "original-run"],
  ["target.jobRunId", "original-job"],
  ["target.claimId", "old-claim"],
  ["target.approvalId", "old-approval"],
  ["target.evidenceHash", "unknown"],
  ["target.approvalExpiresAtUnixMilli", now],
  ["target.steps.0.attemptRunIds", ["old-shell-1", "new-shell-2"]],
  ["target.steps.0.action", "upload"],
  ["target.steps.1.uses", "shell"],
  ["target.steps.1.stepIndex", 0],
  ["target.steps.1.attemptRunIds", ["new-upload-1"]],
  ["expectedOutput.name", "../escape"],
  ["expectedOutput.name", "/absolute"],
  ["expectedOutput.size", 0],
  ["expectedOutput.size", 1024 * 1024 + 1],
  ["expectedOutput.sha256", "partial"],
  ["expectedOutput.logMarker", "unsafe\nline"],
])
  test(`reject altered contract ${path} ${JSON.stringify(value)}`, () => {
    const f = fixture();
    set(f, path, value);
    assert.throws(() => validateOutcomeContract(f, now));
  });
for (const path of [
  "scope",
  "target",
  "original",
  "fixedTime",
  "expectedOutput",
])
  test(`reject extra protected or unexpected field in ${path}`, () => {
    const f = fixture();
    f[path].auth = "not-a-real-secret";
    assert.throws(() => validateOutcomeContract(f, now));
  });
test("reject duplicate new step IDs across logical steps", () => {
  const f = fixture();
  f.target.steps[1].attemptRunIds[1] = f.target.steps[0].attemptRunIds[1];
  assert.throws(() => validateOutcomeContract(f, now));
});
test("accept all exact pending/approved fresh evidence", () => {
  assertApprovalEvidence(approval(), fixture(), "pending");
  assertApprovalEvidence(approval("approved"), fixture(), "approved");
});
for (const [path, value] of [
  ["approvalId", "old-approval"],
  ["pipelineRunId", "original-run"],
  ["retryJobRunId", "original-job"],
  ["requestedBy", "second-candidate"],
  ["evidenceHash", "d".repeat(64)],
  ["canApprove", false],
  ["viewerDecision", "approved"],
  ["approvedCount", 0],
  ["requiredApproverCount", 1],
  ["mode", "any"],
  ["rejectedCount", 1],
  ["candidateApprovers", '["requester","second-candidate"]'],
  ["retryReview.evidence.kind", "retry_failed_step_v1"],
  ["retryReview.evidence.identity.claimId", "old-claim"],
  ["retryReview.evidence.identity.agentId", "other-agent"],
  ["retryReview.evidence.context.actorId", "first-candidate"],
  ["retryReview.evidence.inputs.sourceCommit", "f".repeat(40)],
  ["retryReview.evidence.inputs.artifacts", [{}]],
  ["retryReview.evidence.artifacts", [{}]],
  ["retryReview.evidence.source.PipelineRunID", "original-run"],
  ["retryReview.evidence.createdAtUnixMilli", now - 2000],
  ["retryReview.evidence.expiresAtUnixMilli", now + 60_000],
  ["retryReview.evidence.retryPlan.policy.allowed_exit_codes", [1]],
  [
    "retryReview.evidence.retryPlan.steps.0.attemptRunIds",
    ["new-shell-1", "other-step"],
  ],
  ["retryReview.evidence.retryPlan.steps.0.continueOnError", true],
])
  test(`reject mismatched or unauthorized approval ${path}`, () => {
    const a = approval();
    set(a, path, value);
    assert.throws(() => assertApprovalEvidence(a, fixture(), "pending"));
  });
test("confirmed/approved count alone cannot prove independent actor vote", () => {
  const a = approval("approved");
  delete a.viewerDecision;
  assert.throws(() => assertApprovalEvidence(a, fixture(), "approved"));
});
test("actual original failed and new terminal plus bounded marker validate", () => {
  const o = execution(true),
    n = execution();
  assertOriginalFailed(o.run, o.jobs, fixture());
  assertNewSucceeded(n.run, n.jobs, n.logs, fixture());
});
for (const [path, value] of [
  ["run.status", 3],
  ["jobs.list.0.status", 7],
  ["jobs.list.0.endTime", new Date(now).toISOString()],
  ["jobs.list.0.steps.0.exitCode", 0],
  ["jobs.list.0.steps.0.status", 7],
  ["jobs.list.0.sourceProvenanceState", "unknown"],
  ["jobs.list.0.steps.0.stepRunId", "new-shell-1"],
])
  test(`reject non-original-failure ${path}`, () => {
    const r = execution(true);
    set(r, path, value);
    assert.throws(() => assertOriginalFailed(r.run, r.jobs, fixture()));
  });
for (const [path, value] of [
  ["run.status", 2],
  ["run.runId", "original-run"],
  ["jobs.total", 2],
  ["jobs.list.0.status", 5],
  ["jobs.list.0.agentId", "other-agent"],
  ["jobs.list.0.sourceResolvedCommit", "f".repeat(40)],
  ["jobs.list.0.steps.0.exitCode", 23],
  ["jobs.list.0.steps.0.attempt", 2],
  ["jobs.list.0.steps.1.status", 4],
  ["jobs.list.0.steps.1.startTime", new Date(now).toISOString()],
  ["logs.truncated", true],
  ["logs.entries.0.stepId", "old-shell-1"],
  ["logs.entries.0.jobId", "original-job"],
  ["logs.entries.0.message", "prefix RERUN_SYNTHETIC_COMMAND_OK suffix"],
])
  test(`reject non-exact terminal proof ${path}`, () => {
    const r = execution();
    set(r, path, value);
    assert.throws(() => assertNewSucceeded(r.run, r.jobs, r.logs, fixture()));
  });
test("artifact metadata and actual bytes both required", () => {
  assertArtifact([artifact()], fixture());
  assert.deepEqual(assertDownloadedBytes(bytes, fixture()), {
    size: bytes.length,
    sha256: hash,
  });
});
for (const [key, value] of [
  ["projectId", "other-project"],
  ["pipelineRunId", "original-run"],
  ["jobRunId", "original-job"],
  ["stepRunId", "new-shell-1"],
  ["name", "different.txt"],
  ["size", bytes.length + 1],
  ["sizeKnown", false],
  ["storageType", "local"],
  ["status", "expired"],
  ["downloadAvailable", false],
])
  test(`reject artifact ${key} mismatch`, () =>
    assert.throws(() =>
      assertArtifact([{ ...artifact(), [key]: value }], fixture()),
    ));
test("reject duplicate publications", () =>
  assert.throws(() => assertArtifact([artifact(), artifact()], fixture())));
test("metadata cannot substitute for download bytes", () =>
  assert.throws(() => assertDownloadedBytes(artifact(), fixture())));
test("same-sized wrong bytes fail digest", () =>
  assert.throws(() =>
    assertDownloadedBytes(Buffer.alloc(bytes.length), fixture()),
  ));
test("longer download fails size", () =>
  assert.throws(() =>
    assertDownloadedBytes(Buffer.concat([bytes, bytes]), fixture()),
  ));
for (const extra of [
  { method: "POST", path: "/api/v1/pipelines/pipeline/trigger", body: {} },
  {
    method: "POST",
    path: "/api/v1/projects/project/copilot/rerun-intents",
    body: {},
  },
  {
    method: "POST",
    path: "/api/v1/projects/project/copilot/rerun-intents/fixed-intent/confirm",
    body: {},
  },
  ...trace(),
])
  test(`reject extra mutation ${extra.path}`, () =>
    assert.throws(() => assertMutationTrace([...trace(), extra], fixture())));
test("cannot add actor/candidate/approval bindings to vote payload", () =>
  assert.throws(() =>
    assertMutationTrace(
      [{ ...trace()[0], body: { reason: "", actorId: "second-candidate" } }],
      fixture(),
    ),
  ));
test("read-only observation never permits zero real vote", () =>
  assert.throws(() => assertMutationTrace([], fixture())));
test("deadline is inherited, never a fresh duration", () => {
  assert.equal(remaining(now + 1, now), 1);
  assert.throws(() => remaining(now, now));
  assert.throws(() => remaining(now - 1, now));
});

test("offline orchestration: complete browser observations still cannot claim overall acceptance", async () => {
  const a = adapter();
  const result = await driveOutcome(a.value, fixture());
  assert.equal(result.browserOutcomeComplete, true);
  assert.equal(result.runtimeAcceptanceComplete, false);
  assert.equal(result.newRunStatus, 3);
  assert.equal(result.originalRunStatus, 4);
  assert.equal(result.preparePosts, 0);
  assert.equal(result.confirmPosts, 0);
  assert.equal(result.approvalPosts, 1);
  assert.equal(result.artifactDownloads, 1);
  assert.equal(a.calls.votes, 1);
  assert.equal(a.calls.downloads, 1);
  assert.equal(a.calls.rendered, 1);
  assert.equal(result.decisionId, undefined);
});
test("offline orchestration: lost vote response only inspects and never revotes", async () => {
  let votes = 0,
    inspections = 0;
  const a = adapter({
    voteOnce: async () => {
      votes++;
      return null;
    },
    inspectApproval: async () =>
      ++inspections < 3 ? approval() : approval("approved"),
  });
  const result = await driveOutcome(a.value, fixture());
  assert.equal(result.approvalResponseLost, true);
  assert.equal(votes, 1);
  assert.equal(inspections, 3);
});
test("offline orchestration: lost vote without persisted approval expires, not success", async () => {
  let votes = 0;
  const a = adapter({
    voteOnce: async () => {
      votes++;
      return null;
    },
    inspectApproval: async () => approval(),
  });
  await assert.rejects(
    () => driveOutcome(a.value, fixture()),
    /deadline exhausted/,
  );
  assert.equal(votes, 1);
  assert.equal(a.calls.downloads, 0);
});
test("offline orchestration: revoked pending candidate cannot vote", async () => {
  const a = adapter({
    openApproval: async () => ({ ...approval(), canApprove: false }),
  });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
  assert.equal(a.calls.votes, 0);
});
test("offline orchestration: actual expired evidence fails before vote", async () => {
  const a = adapter({
    openApproval: async () => ({ ...approval(), status: 3 }),
  });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
  assert.equal(a.calls.votes, 0);
});
test("offline orchestration: mismatched vote response is not hidden by later inspection", async () => {
  const a = adapter({
    voteOnce: async () => ({ ...approval("approved"), approvalId: "other" }),
  });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
  assert.equal(a.calls.inspections, 0);
});
test("offline orchestration: failed new run cannot be called complete", async () => {
  const r = execution();
  r.run.status = 4;
  const a = adapter({ readNewExecution: async () => r });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
  assert.equal(a.calls.downloads, 0);
});
test("offline orchestration: logs may arrive later but observation has an inherited limit", async () => {
  let reads = 0;
  const r = execution();
  r.logs.entries = [];
  const a = adapter({
    readNewExecution: async () => (++reads < 3 ? r : execution()),
  });
  await driveOutcome(a.value, fixture());
  assert.equal(reads, 3);
  assert.equal(a.calls.votes, 1);
});
test("offline orchestration: absent command output cannot become a success", async () => {
  const r = execution();
  r.logs.entries = [];
  const a = adapter({ readNewExecution: async () => r });
  await assert.rejects(
    () => driveOutcome(a.value, fixture()),
    /deadline exhausted/,
  );
  assert.equal(a.calls.downloads, 0);
});
test("offline orchestration: rendered output check is mandatory", async () => {
  const a = adapter({
    verifyRenderedOutcome: async () => {
      throw new Error("UI output absent");
    },
  });
  await assert.rejects(
    () => driveOutcome(a.value, fixture()),
    /UI output absent/,
  );
  assert.equal(a.calls.downloads, 0);
});
test("offline orchestration: full expected bytes cannot be replaced with a file name", async () => {
  const a = adapter({ downloadOnce: async () => Buffer.from("result.txt") });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
});
test("offline orchestration: original public evidence changes fail", async () => {
  let reads = 0;
  const a = adapter({
    readOriginal: async () => {
      const r = execution(true);
      if (++reads > 1) r.jobs.list[0].jobName = "changed";
      return r;
    },
  });
  await assert.rejects(
    () => driveOutcome(a.value, fixture()),
    /Original public/,
  );
});
test("offline orchestration: original may not gain an artifact", async () => {
  const a = adapter({ listOriginalArtifacts: async () => [artifact()] });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
});
test("offline orchestration: source metadata must stay pinned across all phases", async () => {
  const r = execution();
  r.jobs.list[0].sourceRef = "changed";
  const a = adapter({ readNewExecution: async () => r });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
  assert.equal(a.calls.downloads, 0);
});
test("offline orchestration: duplicate network download is not hidden by single click", async () => {
  const a = adapter({ counts: () => ({ mutations: trace(), downloads: 2 }) });
  await assert.rejects(() => driveOutcome(a.value, fixture()));
});

function environment(phase = "outcome") {
  return {
    ARCENTRA_COPILOT_EXECUTION_BROWSER: "1",
    ARCENTRA_REQUIRE_COPILOT_EXECUTION_BROWSER: "1",
    ARCENTRA_REAL_STACK: "1",
    ARCENTRA_COPILOT_BROWSER_CWD: "/synthetic/frontend",
    ARCENTRA_COPILOT_BROWSER_FRONTEND_COMMIT: "9".repeat(40),
    ARCENTRA_COPILOT_RERUN_PHASE: phase,
    ARCENTRA_COPILOT_RERUN_CONTRACT: JSON.stringify(
      phase === "prepare" ? fixture().scope : fixture(),
    ),
    ARCENTRA_COPILOT_RERUN_DEADLINE_UNIX_MILLI: String(
      fixture().deadlineUnixMilli,
    ),
    ARCENTRA_ACCEPTANCE_BACKEND_URL: "http://127.0.0.1:2345",
    ARCENTRA_ACCEPTANCE_USERNAME:
      phase === "outcome" ? fixture().actorId : fixture().scope.actorId,
    ARCENTRA_ACCEPTANCE_PASSWORD: "synthetic-browser-disposable",
    UI_TEST_OUTPUT_DIR: `/synthetic/evidence/${phase}`,
  };
}
test("entry is inert without explicit fixture inputs", () =>
  assert.throws(() => readEntryContract({}, "/synthetic/frontend", now)));
test("all phase frames retain exact actor and parent deadline", () => {
  for (const phase of ["prepare", "outcome", "owner-outcome"]) {
    const value = readEntryContract(
      environment(phase),
      "/synthetic/frontend",
      now,
    );
    assert.equal(value.phase, phase);
    assert.equal(value.deadline, fixture().deadlineUnixMilli);
  }
});
for (const name of Object.keys(environment()))
  test(`entry rejects missing ${name}`, () => {
    const env = environment();
    delete env[name];
    assert.throws(() => readEntryContract(env, "/synthetic/frontend", now));
  });
for (const [key, value] of [
  ["ARCENTRA_COPILOT_RERUN_PHASE", "replay"],
  ["ARCENTRA_COPILOT_RERUN_DEADLINE_UNIX_MILLI", String(now)],
  ["ARCENTRA_COPILOT_RERUN_DEADLINE_UNIX_MILLI", String(now + 40_000)],
  ["ARCENTRA_COPILOT_BROWSER_CWD", "/different/frontend"],
  ["ARCENTRA_COPILOT_BROWSER_CWD", "relative"],
  ["ARCENTRA_ACCEPTANCE_BACKEND_URL", "https://127.0.0.1:2345"],
  ["ARCENTRA_ACCEPTANCE_BACKEND_URL", "http://external.example"],
  ["ARCENTRA_ACCEPTANCE_BACKEND_URL", "http://user:password@127.0.0.1:2345"],
  ["ARCENTRA_ACCEPTANCE_BACKEND_URL", "http://127.0.0.1:2345/?token=private"],
  ["ARCENTRA_ACCEPTANCE_USERNAME", "requester"],
  ["ARCENTRA_ACCEPTANCE_PASSWORD", "not-disposable"],
  ["UI_TEST_OUTPUT_DIR", "relative"],
])
  test(`entry rejects unsafe or mismatched ${key} ${value.includes("password") ? "credential URL" : value}`, () => {
    assert.throws(() =>
      readEntryContract(
        { ...environment(), [key]: value },
        "/synthetic/frontend",
        now,
      ),
    );
  });
test("entry rejects malformed preparation before any browser import", () => {
  const env = environment("prepare");
  env.ARCENTRA_COPILOT_RERUN_CONTRACT = JSON.stringify({
    ...fixture().scope,
    auth: "synthetic",
  });
  assert.throws(() => readEntryContract(env, "/synthetic/frontend", now));
});
test("entry bounds raw contract before parse", () => {
  assert.throws(() =>
    readEntryContract(
      { ...environment(), ARCENTRA_COPILOT_RERUN_CONTRACT: "x".repeat(16385) },
      "/synthetic/frontend",
      now,
    ),
  );
});
test("parsed shell action run is retained exactly", () => {
  const f = fixture();
  f.target.steps[0].action = "run";
  validateOutcomeContract(f, now);
  const a = approval();
  a.retryReview.evidence.retryPlan.steps[0].action = "run";
  assertApprovalEvidence(a, f, "pending");
});

test("invalid private inputs do not appear in entry errors", () => {
  for (const [key, value] of [
    ["ARCENTRA_ACCEPTANCE_BACKEND_URL", "http://user:PRIVATE_MARKER@127.0.0.1"],
    [
      "ARCENTRA_ACCEPTANCE_BACKEND_URL",
      "http://127.0.0.1/?token=PRIVATE_MARKER",
    ],
    ["ARCENTRA_COPILOT_RERUN_CONTRACT", "PRIVATE_MARKER_not_json"],
    ["ARCENTRA_ACCEPTANCE_PASSWORD", "PRIVATE_MARKER"],
  ]) {
    let caught;
    try {
      readEntryContract(
        { ...environment(), [key]: value },
        "/synthetic/frontend",
        now,
      );
    } catch (error) {
      caught = error;
    }
    assert.ok(caught);
    assert.equal(String(caught).includes("PRIVATE_MARKER"), false);
  }
});

test("frontend expected SHA is independent of pipeline source identity", () => {
  const input = readEntryContract(environment(), "/synthetic/frontend", now);
  assert.equal(input.expectedFrontendCommit, "9".repeat(40));
  assert.notEqual(
    input.expectedFrontendCommit,
    input.contract.scope.expectedSourceCommit,
  );
});
for (const value of [
  "",
  "main",
  "d73acbce",
  "A".repeat(40),
  "a".repeat(39),
  "a".repeat(41),
  "a".repeat(64),
  "a".repeat(40) + "\n",
])
  test(`reject malformed trusted frontend pin ${JSON.stringify(value)}`, () => {
    assert.throws(() =>
      readEntryContract(
        { ...environment(), ARCENTRA_COPILOT_BROWSER_FRONTEND_COMMIT: value },
        "/synthetic/frontend",
        now,
      ),
    );
  });
test("frontend provenance comes from matching actual HEAD and clean readback", () => {
  assert.equal(
    assertFrontendCheckout("9".repeat(40), "9".repeat(40) + "\n", ""),
    "9".repeat(40),
  );
});
for (const [head, status] of [
  ["8".repeat(40), ""],
  ["9".repeat(40), " M tests/actual-rerun-browser.mjs\n"],
  ["9".repeat(40), "?? unreviewed.mjs\n"],
  ["main", ""],
  ["9".repeat(40) + "\nextra", ""],
  ["9".repeat(40), undefined],
])
  test(`reject unpinned or dirty frontend readback ${JSON.stringify({ head, status })}`, () => {
    assert.throws(() => assertFrontendCheckout("9".repeat(40), head, status));
  });
test("missing trusted frontend pin cannot be derived from matching HEAD", () => {
  assert.throws(() => assertFrontendCheckout(undefined, "9".repeat(40), ""));
});

for (const name of [
  "ARCENTRA_COPILOT_EXECUTION_BROWSER",
  "ARCENTRA_REQUIRE_COPILOT_EXECUTION_BROWSER",
  "ARCENTRA_REAL_STACK",
])
  test(`actual entry process fails closed without required opt-in ${name}`, () => {
    const env = environment();
    delete env[name];
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./actual-rerun-browser.mjs", import.meta.url))],
      { env, encoding: "utf8", timeout: 5000, maxBuffer: 32_768 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`Explicit ${name}=1 required`));
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes("synthetic-browser-disposable"), false);
  });

for (const value of [
  "",
  "http://127.0.0.1:5174",
  "http://localhost:9999",
  "https://unrelated.invalid",
  undefined,
])
  test(`reject any inherited UI server override ${JSON.stringify(value)}`, () => {
    assert.throws(
      () =>
        readEntryContract(
          { ...environment(), UI_TEST_BASE_URL: value },
          "/synthetic/frontend",
          now,
        ),
      /UI_TEST_BASE_URL overrides are forbidden/,
    );
  });
test("actual entry rejects inherited UI override before browser imports or login", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./actual-rerun-browser.mjs", import.meta.url))],
    {
      env: { ...environment(), UI_TEST_BASE_URL: "http://127.0.0.1:9999" },
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 32_768,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("UI_TEST_BASE_URL overrides are forbidden"));
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.includes("synthetic-browser-disposable"), false);
});

function managedSummary() {
  return {
    kind: "actual-backend",
    status: "passed",
    pageErrorCount: 0,
    secretExposureCount: 0,
    consoleInspectionFailureCount: 0,
    lateConsoleEventCount: 0,
    unexpectedConsoleErrorCount: 0,
    blockedRequestCount: 0,
    unhandledRouteCount: 0,
    frontendServer: {
      managed: true,
      mode: "vite-development",
      ready: true,
      listeningWitness: true,
      exitCodeBeforeCleanup: null,
      signalBeforeCleanup: null,
    },
  };
}
test("pinned receipt requires successful managed frontend final diagnostics", () => {
  assertManagedFrontendSummary(managedSummary());
  parseManagedFrontendSummary(Buffer.from(JSON.stringify(managedSummary())));
});
for (const key of [
  "pageErrorCount",
  "secretExposureCount",
  "consoleInspectionFailureCount",
  "lateConsoleEventCount",
  "unexpectedConsoleErrorCount",
  "blockedRequestCount",
  "unhandledRouteCount",
])
  test(`failed final safeguard blocks pinned receipt: ${key}`, () => {
    assert.throws(() =>
      assertManagedFrontendSummary({ ...managedSummary(), [key]: 1 }),
    );
    const value = managedSummary();
    delete value[key];
    assert.throws(() => assertManagedFrontendSummary(value));
  });
for (const [key, value] of [
  ["managed", false],
  ["mode", "external-unknown"],
  ["ready", false],
  ["listeningWitness", false],
  ["exitCodeBeforeCleanup", 1],
  ["exitCodeBeforeCleanup", 0],
  ["signalBeforeCleanup", "SIGTERM"],
  ["signalBeforeCleanup", "SIGKILL"],
])
  test(`failed managed server witness blocks pinned receipt: ${key} ${value}`, () => {
    const summary = managedSummary();
    summary.frontendServer[key] = value;
    assert.throws(() => assertManagedFrontendSummary(summary));
  });
for (const key of Object.keys(managedSummary().frontendServer))
  test(`missing managed server witness blocks pinned receipt: ${key}`, () => {
    const summary = managedSummary();
    delete summary.frontendServer[key];
    assert.throws(() => assertManagedFrontendSummary(summary));
  });
test("missing or simulated summary cannot attest pinned frontend", () => {
  for (const value of [
    undefined,
    {},
    { ...managedSummary(), kind: "simulated-transport" },
    { ...managedSummary(), status: "failed" },
    { ...managedSummary(), frontendServer: undefined },
  ])
    assert.throws(() => assertManagedFrontendSummary(value));
});
test("summary parser rejects oversized or malformed input without echoing content", () => {
  assert.throws(
    () => parseManagedFrontendSummary(Buffer.alloc(65_537)),
    /Bounded/,
  );
  assert.throws(() => parseManagedFrontendSummary(Buffer.alloc(0)), /Bounded/);
  assert.throws(() => parseManagedFrontendSummary("not bytes"), /Bounded/);
  assert.throws(
    () =>
      parseManagedFrontendSummary(Buffer.from("PRIVATE_MARKER_invalid_json")),
    (error) => !String(error).includes("PRIVATE_MARKER"),
  );
});

// Synthetic adapter checks cover orchestration only, not a browser or runtime pass.
function ownerAdapter(overrides = {}) {
  let result;
  result = adapter({
    verifyIdentity: async (actor) =>
      assert.equal(actor, fixture().scope.actorId),
    openApproval: async () =>
      assert.fail("Owner must not open an approval vote"),
    voteOnce: async () => assert.fail("Owner must not vote"),
    inspectApproval: async () =>
      assert.fail("Owner outcome must not claim independent review"),
    closeApproval: async () => assert.fail("Owner has no approval dialog"),
    counts: () => ({ mutations: [], downloads: result.calls.downloads }),
    ...overrides,
  });
  return result;
}
test("original owner independently observes exact terminal output with no writes or vote", async () => {
  const a = ownerAdapter();
  const result = await driveOwnerOutcome(a.value, fixture());
  assert.equal(result.phase, "browser-owner-output-observed");
  assert.equal(result.ownerOutcomeComplete, true);
  assert.equal(result.actorId, fixture().scope.actorId);
  assert.equal(result.requesterId, fixture().scope.actorId);
  assert.notEqual(result.actorId, fixture().actorId);
  assert.equal(result.runtimeAcceptanceComplete, false);
  assert.equal(result.browserOutcomeComplete, undefined);
  assert.equal(result.approvalId, undefined);
  assert.equal(result.claimId, undefined);
  assert.equal(result.approvedCount, undefined);
  assert.equal(result.newRunStatus, 3);
  assert.equal(result.originalRunStatus, 4);
  assert.equal(result.preparePosts, 0);
  assert.equal(result.confirmPosts, 0);
  assert.equal(result.approvalPosts, 0);
  assert.equal(result.artifactDownloads, 1);
  assert.equal(result.artifactSha256, hash);
  assert.equal(a.calls.votes, 0);
  assert.equal(a.calls.inspections, 0);
  assert.equal(a.calls.rendered, 1);
});
for (const mutation of [
  ...trace(),
  {
    method: "POST",
    path: "/api/v1/projects/project/copilot/rerun-intents",
    body: {},
  },
  {
    method: "POST",
    path: "/api/v1/projects/project/copilot/rerun-intents/fixed-intent/confirm",
    body: {},
  },
])
  test(`owner observation rejects any mutation ${mutation.path}`, async () => {
    const a = ownerAdapter({
      counts: () => ({ mutations: [mutation], downloads: 1 }),
    });
    await assert.rejects(
      () => driveOwnerOutcome(a.value, fixture()),
      /strictly read-only/,
    );
  });
test("owner outcome cannot accept reviewer identity", async () => {
  const a = ownerAdapter({
    verifyIdentity: async (actor) => assert.equal(actor, fixture().actorId),
  });
  await assert.rejects(() => driveOwnerOutcome(a.value, fixture()));
  assert.equal(a.calls.downloads, 0);
});
test("owner outcome still requires rendered logs and real downloaded bytes", async () => {
  for (const override of [
    { verifyRenderedOutcome: async () => assert.fail("no rendered log") },
    { downloadOnce: async () => Buffer.alloc(bytes.length) },
    { listNewArtifacts: async () => [artifact(), artifact()] },
    { listOriginalArtifacts: async () => [artifact()] },
  ])
    await assert.rejects(() =>
      driveOwnerOutcome(ownerAdapter(override).value, fixture()),
    );
});
test("owner cannot claim successful outcome after a failed execution", async () => {
  const r = execution();
  r.run.status = 4;
  const a = ownerAdapter({ readNewExecution: async () => r });
  await assert.rejects(() => driveOwnerOutcome(a.value, fixture()));
  assert.equal(a.calls.downloads, 0);
});
test("owner missing output stays bounded by unchanged parent deadline", async () => {
  const r = execution();
  r.logs.entries = [];
  const a = ownerAdapter({ readNewExecution: async () => r });
  await assert.rejects(
    () => driveOwnerOutcome(a.value, fixture()),
    /deadline exhausted/,
  );
  assert.equal(a.calls.votes, 0);
  assert.equal(a.calls.downloads, 0);
});
test("owner may read after used approval expires but cannot expand parent deadline", () => {
  const f = fixture();
  f.target.approvalExpiresAtUnixMilli = now - 1;
  validateOwnerOutcomeContract(f, now);
  assert.throws(() => validateOutcomeContract(f, now));
  f.deadlineUnixMilli = now;
  assert.throws(() => validateOwnerOutcomeContract(f, now));
});
test("owner entry binds original-owner login even though approval contract names reviewer", () => {
  const input = readEntryContract(
    environment("owner-outcome"),
    "/synthetic/frontend",
    now,
  );
  assert.equal(input.actorId, fixture().scope.actorId);
  assert.equal(input.contract.actorId, fixture().actorId);
  assert.throws(() =>
    readEntryContract(
      {
        ...environment("owner-outcome"),
        ARCENTRA_ACCEPTANCE_USERNAME: fixture().actorId,
      },
      "/synthetic/frontend",
      now,
    ),
  );
});
