/** Only real UI requests/downloads in the exported browser entry point.
 * No route fulfillment, session injection, synthetic approvals or terminal DB writes.
 * The pure driveOutcome seam below is for offline orchestration checks, not acceptance. */
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  validateOutcomeContract,
  assertApprovalEvidence,
  assertOriginalFailed,
  assertNewSucceeded,
  assertArtifact,
  assertDownloadedBytes,
  assertMutationTrace,
} from "./copilot-rerun-outcome-contract.mjs";

export const approvalAcknowledgement =
  "I reviewed the exact source commit, all inputs, steps and total attempt limit";
export function remaining(deadline, now = Date.now()) {
  const result = deadline - now;
  assert.ok(
    Number.isSafeInteger(result) && result > 0,
    "Existing fixture deadline exhausted",
  );
  return result;
}

/** Does not sleep past the inherited deadline, and never retries a mutation. */
export async function driveOutcome(adapter, contract) {
  const f = validateOutcomeContract(contract, adapter.now());
  const voteDeadline = Math.min(
    f.deadlineUnixMilli,
    f.target.approvalExpiresAtUnixMilli,
  );
  await adapter.verifyIdentity(f.actorId);
  const originalBefore = await adapter.readOriginal();
  const oldJob = assertOriginalFailed(
    originalBefore.run,
    originalBefore.jobs,
    f,
  );
  const pending = await adapter.openApproval();
  const evidence = assertApprovalEvidence(pending, f, "pending");
  assert.equal(evidence.source.Repository, oldJob.sourceRepository);
  assert.equal(evidence.source.Ref, oldJob.sourceRef);
  remaining(voteDeadline, adapter.now());
  // The adapter makes exactly one deliberate UI click. A lost response only permits reads.
  const voteResponse = await adapter.voteOnce(voteDeadline);
  if (voteResponse !== null)
    assertApprovalEvidence(voteResponse, f, "approved");
  let approval;
  for (;;) {
    remaining(f.deadlineUnixMilli, adapter.now());
    approval = await adapter.inspectApproval();
    if (approval.status === 1) break;
    assertApprovalEvidence(approval, f, "pending");
    remaining(voteDeadline, adapter.now());
    await adapter.pause(Math.min(200, remaining(voteDeadline, adapter.now())));
  }
  assertApprovalEvidence(approval, f, "approved");
  await adapter.closeApproval();
  let result;
  for (;;) {
    remaining(f.deadlineUnixMilli, adapter.now());
    result = await adapter.readNewExecution();
    assert.equal(result.run.runId, f.target.runId);
    assert.equal(result.run.pipelineId, f.scope.pipelineId);
    assert.ok(
      [1, 2, 3].includes(result.run.status),
      "New run must be pending/running or genuinely successful",
    );
    if (result.run.status === 3 && result.jobs?.list?.[0]?.status === 4) {
      // Log delivery can follow the durable terminal response. Do not turn malformed data into polling.
      const hasMarker = result.logs?.entries?.some(
        (entry) =>
          entry.stepId === f.target.steps[0].attemptRunIds[0] &&
          typeof entry.message === "string" &&
          entry.message.split(/\r?\n/).includes(f.expectedOutput.logMarker),
      );
      if (hasMarker) break;
    }
    await adapter.pause(
      Math.min(200, remaining(f.deadlineUnixMilli, adapter.now())),
    );
  }
  const newJob = assertNewSucceeded(result.run, result.jobs, result.logs, f);
  await adapter.verifyRenderedOutcome(newJob);
  assert.equal(newJob.sourceRepository, oldJob.sourceRepository);
  assert.equal(newJob.sourceRef, oldJob.sourceRef);
  const artifact = assertArtifact(await adapter.listNewArtifacts(), f);
  const downloaded = assertDownloadedBytes(
    await adapter.downloadOnce(artifact),
    f,
  );
  const originalAfter = await adapter.readOriginal();
  const oldJobAfter = assertOriginalFailed(
    originalAfter.run,
    originalAfter.jobs,
    f,
  );
  // The safe public job projection is immutable as well as the stronger Go-owned row baseline.
  assert.ok(
    isDeepStrictEqual(oldJobAfter, oldJob),
    "Original public job/step evidence must remain unchanged",
  );
  assert.deepEqual(
    await adapter.listOriginalArtifacts(),
    [],
    "Original failed execution must still publish nothing",
  );
  remaining(f.deadlineUnixMilli, adapter.now());
  const counts = adapter.counts();
  assertMutationTrace(counts.mutations, f);
  assert.equal(counts.downloads, 1);
  return {
    version: f.version,
    phase: "browser-independent-approval-and-output-observed",
    browserOutcomeComplete: true,
    runtimeAcceptanceComplete: false,
    actorId: f.actorId,
    requesterId: f.scope.actorId,
    firstApproverId: f.firstApproverId,
    projectId: f.scope.projectId,
    pipelineId: f.scope.pipelineId,
    originalRunId: f.scope.originalRunId,
    originalJobRunId: f.scope.originalJobRunId,
    originalRunStatus: originalAfter.run.status,
    originalJobStatus: oldJobAfter.status,
    requestId: f.target.requestId,
    intentId: f.target.intentId,
    newRunId: f.target.runId,
    newJobRunId: f.target.jobRunId,
    claimId: evidence.identity.claimId,
    approvalId: approval.approvalId,
    approvalEvidenceHash: approval.evidenceHash,
    approvalStatus: approval.status,
    approvedCount: approval.approvedCount,
    sourceCommit: newJob.sourceResolvedCommit,
    newRunStatus: result.run.status,
    newJobStatus: newJob.status,
    commandStepRunId: f.target.steps[0].attemptRunIds[0],
    uploadStepRunId: f.target.steps[1].attemptRunIds[0],
    commandMarkerObserved: true,
    artifactId: artifact.artifactId,
    artifactSize: downloaded.size,
    artifactSha256: downloaded.sha256,
    preparePosts: 0,
    confirmPosts: 0,
    approvalPosts: counts.mutations.length,
    artifactDownloads: counts.downloads,
    approvalResponseLost: voteResponse === null,
  };
}

/** Caller owns real login, secret guards, network firewall, diagnostic checks and process timeout. */
export async function runRerunBrowserOutcome({
  page,
  base,
  contract,
  assertControlReachable,
  applyArtifactRunFilter,
}) {
  const f = validateOutcomeContract(contract);
  assert.equal(typeof assertControlReachable, "function");
  assert.equal(typeof applyArtifactRunFilter, "function");
  const origin = new URL(base);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname));
  assert.ok(["http:", "https:"].includes(origin.protocol));
  assert.equal(origin.pathname, "/");
  assert.equal(origin.search, "");
  assert.equal(origin.hash, "");
  assert.equal(origin.username, "");
  assert.equal(origin.password, "");
  const mutations = [];
  let downloads = 0;
  const onRequest = (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      // Never retain unexpected credential bodies in diagnostics.
      const expected =
        path === `/api/v1/approvals/${f.target.approvalId}/approve`;
      const validBody =
        expected && isDeepStrictEqual(request.postDataJSON(), { reason: "" });
      mutations.push({
        method: request.method(),
        path,
        body: validBody ? { reason: "" } : { unexpectedBody: true },
      });
    }
    if (
      request.method() === "GET" &&
      /^\/api\/v1\/projects\/[^/]+\/artifacts\/[^/]+\/download$/.test(path)
    )
      downloads++;
  };
  const timeout = (cap = 10_000, deadline = f.deadlineUnixMilli) =>
    Math.min(cap, remaining(deadline));
  function responseFor(method, path, predicate = () => true, cap = 10_000) {
    const promise = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          url.origin === origin.origin &&
          response.request().method() === method &&
          url.pathname === path &&
          predicate(url)
        );
      },
      { timeout: timeout(cap) },
    );
    void promise.catch(() => {});
    return promise;
  }
  async function read(response) {
    assert.equal(
      response.status(),
      200,
      "Actual scoped API request must succeed",
    );
    const content = await response.body();
    assert.ok(
      content.length <= 1024 * 1024,
      "Bounded synthetic response required",
    );
    const value = JSON.parse(content.toString("utf8"));
    assert.equal(value.code, 200);
    return value.detail;
  }
  async function click(control, deadline = f.deadlineUnixMilli) {
    remaining(deadline);
    await assertControlReachable(control);
    await control.click({ timeout: timeout(10_000, deadline) });
  }
  const runPath = (runId) =>
    `/api/v1/pipelines/${f.scope.pipelineId}/runs/${runId}`;
  const runRoute = (runId) =>
    `${origin.origin}/projects/${f.scope.projectId}/pipelines?pipeline=${f.scope.pipelineId}&run=${runId}`;
  async function readRun(runId, navigate) {
    const root = runPath(runId);
    const responses = [
      responseFor("GET", root),
      responseFor("GET", `${root}/jobs`),
      responseFor(
        "GET",
        `${root}/logs`,
        (url) =>
          !url.searchParams.get("stepRunId") &&
          (!url.searchParams.get("fromLine") ||
            url.searchParams.get("fromLine") === "0"),
      ),
    ];
    if (navigate) await page.goto(runRoute(runId), { timeout: timeout() });
    else
      await click(
        page.getByRole("button", { name: "Refresh execution", exact: true }),
      );
    const [run, jobs, logs] = await Promise.all(
      responses.map(async (promise) => read(await promise)),
    );
    return { run, jobs, logs };
  }
  const approvalPath = `/api/v1/approvals/${f.target.approvalId}`;
  const dialog = () =>
    page.getByRole("dialog", {
      name: "Review exact container retry plan",
      exact: true,
    });
  let originalInitial;
  let voteClicked = false;
  let downloadClicked = false;
  page.on("request", onRequest);
  try {
    return await driveOutcome(
      {
        now: () => Date.now(),
        async verifyIdentity(actorId) {
          const user = responseFor("GET", "/api/v1/users/fetch");
          originalInitial = await readRun(f.scope.originalRunId, true);
          assert.equal(
            (await read(await user)).userId,
            actorId,
            "Separate actual candidate login required",
          );
          assert.equal(mutations.length, 0);
        },
        async readOriginal() {
          if (originalInitial) {
            const result = originalInitial;
            originalInitial = undefined;
            return result;
          }
          return readRun(f.scope.originalRunId, true);
        },
        async openApproval() {
          await readRun(f.target.runId, true);
          const response = responseFor("GET", approvalPath);
          await click(
            page.getByRole("button", {
              name: `Review approval ${f.target.approvalId}`,
              exact: true,
            }),
          );
          const result = await read(await response);
          const checkbox = dialog().getByRole("checkbox", {
            name: approvalAcknowledgement,
            exact: true,
          });
          await checkbox.waitFor({ timeout: timeout() });
          assert.equal(await checkbox.isChecked(), false);
          assert.equal(
            await dialog()
              .getByRole("button", { name: "Approve retry plan", exact: true })
              .isEnabled(),
            false,
          );
          assert.equal(mutations.length, 0);
          return result;
        },
        async voteOnce(deadline) {
          assert.equal(voteClicked, false, "No approval retry");
          const checkbox = dialog().getByRole("checkbox", {
            name: approvalAcknowledgement,
            exact: true,
          });
          await assertControlReachable(checkbox);
          await checkbox.check({ timeout: timeout(10_000, deadline) });
          const response = responseFor(
            "POST",
            `${approvalPath}/approve`,
            () => true,
            Math.min(5000, remaining(deadline)),
          );
          voteClicked = true;
          await click(
            dialog().getByRole("button", {
              name: "Approve retry plan",
              exact: true,
            }),
            deadline,
          );
          let value;
          try {
            value = await response;
          } catch (error) {
            if (error?.name !== "TimeoutError") throw error;
            return null; // Only refresh/inspection is allowed after an unknown response.
          }
          return read(value); // Malformed/denied responses are errors, never a fabricated success.
        },
        async inspectApproval() {
          const response = responseFor("GET", approvalPath);
          await click(
            dialog().getByRole("button", {
              name: "Refresh approval evidence",
              exact: true,
            }),
          );
          return read(await response);
        },
        async closeApproval() {
          await click(
            dialog().getByRole("button", { name: "Close review", exact: true }),
          );
        },
        async readNewExecution() {
          return readRun(f.target.runId, false);
        },
        async verifyRenderedOutcome(job) {
          const logs = page.getByLabel("Execution logs", { exact: true });
          await logs
            .filter({ hasText: f.expectedOutput.logMarker })
            .waitFor({ timeout: timeout() });
          await page
            .getByRole("region", {
              name: `${job.jobName} initial checkout`,
              exact: true,
            })
            .getByText(f.scope.expectedSourceCommit, { exact: true })
            .waitFor({ timeout: timeout() });
        },
        async listNewArtifacts() {
          await page.goto(
            `${origin.origin}/projects/${f.scope.projectId}/artifacts`,
            { timeout: timeout() },
          );
          const list = await applyArtifactRunFilter(
            page,
            f.scope.projectId,
            f.target.runId,
          );
          await page
            .getByText("1 matching artifacts", { exact: true })
            .waitFor({ timeout: timeout() });
          return list;
        },
        async downloadOnce(item) {
          assert.equal(
            downloadClicked,
            false,
            "Exactly one deliberate artifact download",
          );
          downloadClicked = true;
          const response = responseFor(
            "GET",
            `/api/v1/projects/${f.scope.projectId}/artifacts/${item.artifactId}/download`,
          );
          const downloaded = page.waitForEvent("download", {
            timeout: timeout(),
          });
          void downloaded.catch(() => {});
          await click(
            page.getByRole("button", {
              name: `Download ${item.name}`,
              exact: true,
            }),
          );
          const [http, download] = await Promise.all([response, downloaded]);
          assert.equal(http.status(), 200);
          assert.ok(
            (await http.headerValue("content-disposition"))
              ?.toLowerCase()
              .startsWith("attachment;"),
          );
          assert.ok(
            (await http.headerValue("cache-control"))?.includes("no-store"),
          );
          assert.equal(await download.failure(), null);
          assert.equal(download.suggestedFilename(), basename(item.name));
          const file = await download.path();
          const info = await stat(file);
          assert.ok(
            info.isFile() &&
              info.size === f.expectedOutput.size &&
              info.size <= 1024 * 1024,
            "Bound bytes before reading",
          );
          return readFile(file);
        },
        async listOriginalArtifacts() {
          await page.goto(
            `${origin.origin}/projects/${f.scope.projectId}/artifacts`,
            { timeout: timeout() },
          );
          return applyArtifactRunFilter(
            page,
            f.scope.projectId,
            f.scope.originalRunId,
            { expectEmpty: true },
          );
        },
        pause: (ms) => page.waitForTimeout(ms),
        counts: () => ({ mutations, downloads }),
      },
      f,
    );
  } finally {
    page.off("request", onRequest);
  }
}
