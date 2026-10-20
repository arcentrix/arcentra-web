/** Real-page preparation/confirmation driver. No fulfilled routes, seed sessions,
 * fabricated approvals, runtime commands or success evidence. The caller owns
 * real login and a separate independent-approver/runtime acceptance phase. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";
import { withholdSuccessfulResponseAndReload } from "./rerun-response-loss.mjs";
const id = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const digest = (v) => typeof v === "string" && /^(?:v1:)?[a-f0-9]{64}$/.test(v);
const sha = (v) =>
  typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
export const rerunAcknowledgement =
  "Create a new run of the whole job. The original run remains unchanged. Preparation may start after confirmation; a new independent approval is required before user commands.";
export function validateRerunBrowserContract(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [
    "actorId",
    "definitionRevision",
    "expectedSourceCommit",
    "originalJobRunId",
    "originalRunId",
    "pipelineId",
    "projectId",
    "resolvedSpecDigest",
    "snapshotDigest",
    "version",
  ]);
  assert.equal(value.version, "copilot-terminal-rerun-browser-v1");
  for (const key of [
    "actorId",
    "originalJobRunId",
    "originalRunId",
    "pipelineId",
    "projectId",
  ])
    assert.ok(id(value[key]), `Invalid ${key}`);
  for (const key of ["definitionRevision", "expectedSourceCommit"])
    assert.ok(sha(value[key]), `Full immutable ${key} required`);
  for (const key of ["resolvedSpecDigest", "snapshotDigest"])
    assert.ok(digest(value[key]), `Exact ${key} required`);
  return value;
}
export function assertRerunBrowserReview(review, contract) {
  assert.ok(review);
  for (const key of [
    "projectId",
    "pipelineId",
    "originalRunId",
    "originalJobRunId",
    "snapshotDigest",
  ])
    assert.equal(review[key], contract[key], `Exact ${key} review binding`);
  assert.equal(review.originalRunStatus, 4);
  assert.equal(review.originalJobStatus, 5);
  assert.equal(review.retryMode, "whole_job");
  assert.equal(review.definition.revision, contract.definitionRevision);
  assert.equal(
    review.definition.resolvedSpecDigest,
    contract.resolvedSpecDigest,
  );
  assert.equal(review.source.expectedCommit, contract.expectedSourceCommit);
  assert.ok(
    Array.isArray(review.policy.candidates) &&
      review.policy.candidates.length > 0,
  );
  assert.equal(review.policy.candidates.includes(contract.actorId), false);
}
export function assertRerunBrowserReceipt(value, contract, previous) {
  assert.ok(value && typeof value === "object");
  for (const key of [
    "projectId",
    "pipelineId",
    "originalRunId",
    "originalJobRunId",
    "snapshotDigest",
  ])
    assert.equal(value[key], contract[key], `Exact ${key} receipt binding`);
  for (const key of ["intentId", "requestId", "newRunId", "newJobRunId"])
    assert.ok(id(value[key]));
  for (const key of ["intentDigest", "reviewedRunContextDigest"])
    assert.ok(digest(value[key]));
  assert.notEqual(value.originalRunId, value.newRunId);
  assert.notEqual(value.originalJobRunId, value.newJobRunId);
  assert.equal(value.cancelNewExecutionAvailable, false);
  assert.ok(["prepared", "confirmed"].includes(value.state));
  assert.ok(Number.isSafeInteger(value.version) && value.version > 0);
  for (const key of ["createdAt", "expiresAt", "serverTime"])
    assert.ok(Number.isFinite(Date.parse(value[key])));
  assert.ok(Date.parse(value.expiresAt) > Date.parse(value.createdAt));
  assert.equal(
    value.decisionId,
    undefined,
    "A confirmation receipt must not be a vote receipt",
  );
  if (value.review) assertRerunBrowserReview(value.review, contract);
  assert.equal(
    value.cancelledAt,
    undefined,
    "Prepared/confirmed receipts cannot carry cancellation evidence",
  );
  if (value.state === "prepared") {
    assert.equal(
      value.confirmedAt,
      undefined,
      "A prepared request has no confirmation timestamp",
    );
    assert.equal(value.version, 1);
    assert.equal(value.reviewStatus, "current");
    assert.equal(value.canConfirm, true);
    assert.ok(value.review);
  } else {
    assert.equal(value.version, 2);
    assert.equal(value.canConfirm, false);
    assert.equal(value.canCancelPrepared, false);
    assert.ok(Number.isFinite(Date.parse(value.confirmedAt)));
    assert.ok(Date.parse(value.confirmedAt) >= Date.parse(value.createdAt));
    assert.ok(Date.parse(value.confirmedAt) < Date.parse(value.expiresAt));
  }
  if (previous) {
    for (const key of [
      "intentId",
      "requestId",
      "projectId",
      "pipelineId",
      "originalRunId",
      "originalJobRunId",
      "newRunId",
      "newJobRunId",
      "snapshotDigest",
      "intentDigest",
      "reviewedRunContextDigest",
      "createdAt",
      "expiresAt",
    ])
      assert.equal(value[key], previous[key], `Immutable ${key}`);
    if (previous.state === "confirmed")
      assert.equal(
        value.confirmedAt,
        previous.confirmedAt,
        "Replay preserves initial confirmation time",
      );
  }
  return value;
}
async function read(response, noStore = false) {
  assert.equal(response.status(), 200);
  if (noStore)
    assert.ok(
      (await response.headerValue("cache-control"))?.includes("no-store"),
    );
  const body = await response.json();
  assert.equal(body.code, 200);
  return body.detail;
}
function responseFor(page, method, path) {
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === method && new URL(r.url()).pathname === path,
  );
  void response.catch(() => {});
  return response;
}
export async function runRerunBrowserPreparation({
  page,
  base,
  contract,
  deadline,
}) {
  assert.ok(
    Number.isSafeInteger(deadline) && deadline > Date.now(),
    "Inherited live fixture deadline required",
  );
  const f = validateRerunBrowserContract(contract);
  const origin = new URL(base);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname),
    "Hosted fixture must use its loopback browser origin",
  );
  assert.equal(origin.pathname, "/");
  const root = `/api/v1/projects/${f.projectId}/copilot/rerun-intents`;
  const mutations = [];
  const reads = [];
  let recoveredReloads = 0;
  const onRequest = (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") reads.push(path);
    if (
      path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    )
      mutations.push({
        method: request.method(),
        path,
        body: request.postDataJSON(),
      });
  };
  page.on("request", onRequest);
  try {
    const userResponse = responseFor(page, "GET", "/api/v1/users/fetch");
    await page.goto(`${origin.origin}/workspace/Copilot/chat`);
    assert.equal(
      (await read(await userResponse)).userId,
      f.actorId,
      "Real requester login must be current",
    );
    const section = page.getByRole("region", {
      name: "Whole-job new executions",
      exact: true,
    });
    async function loadScope() {
      await page.getByLabel("Project ID", { exact: true }).fill(f.projectId);
      await page.getByLabel("Run ID", { exact: true }).fill(f.originalRunId);
      const availableResponse = responseFor(
        page,
        "GET",
        `${root}/availability`,
      );
      await page
        .getByRole("button", { name: "Load context choices", exact: true })
        .click();
      assert.deepEqual(await read(await availableResponse, true), {
        available: true,
        cancelNewExecutionAvailable: false,
      });
      await section.waitFor();
    }
    let reloadedUser;
    async function beforeReload(busyLabel) {
      // Response headers may be observed, but the UI never receives the held body.
      await section
        .getByRole("status")
        .filter({ hasText: busyLabel })
        .waitFor();
      assert.equal(await section.getByRole("article").count(), 0);
      reloadedUser = responseFor(page, "GET", "/api/v1/users/fetch");
    }
    async function recover(path, previous, expectedPosts) {
      assert.equal((await read(await reloadedUser)).userId, f.actorId);
      await loadScope();
      // Session storage was populated by the real UI, not the acceptance driver.
      await section
        .getByText(`Recovery request ID: ${previous.requestId}`, {
          exact: false,
        })
        .waitFor();
      assert.equal(await section.getByRole("article").count(), 0);
      assert.equal(
        await section
          .getByRole("button", { name: "Prepare new execution", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await section
          .getByRole("button", { name: "Confirm new execution", exact: true })
          .count(),
        0,
      );
      assert.equal(
        mutations.length,
        expectedPosts,
        "Reload must not retry a mutation",
      );
      assert.equal(
        reads.filter((value) => value === path).length,
        0,
        "Reload must not automatically inspect or retry recovery",
      );
      const inspectedResponse = responseFor(page, "GET", path);
      const inspect = section.getByRole("button", {
        name: "Inspect rerun request",
        exact: true,
      });
      await assertControlReachable(inspect);
      await inspect.click();
      const inspected = assertRerunBrowserReceipt(
        await read(await inspectedResponse, true),
        f,
        previous,
      );
      assert.equal(inspected.state, previous.state);
      assert.equal(
        reads.filter((value) => value === path).length,
        1,
        "One deliberate recovery GET required",
      );
      recoveredReloads++;
      assert.equal(
        mutations.length,
        expectedPosts,
        "Recovery must only inspect the fixed request",
      );
      return inspected;
    }
    await loadScope();
    await section
      .getByLabel("Original job ID", { exact: true })
      .fill(f.originalJobRunId);
    const eligibilityResponse = responseFor(page, "GET", `${root}/eligibility`);
    await section
      .getByRole("button", { name: "Check rerun eligibility", exact: true })
      .click();
    const eligibility = await read(await eligibilityResponse, true);
    assert.equal(eligibility.eligible, true);
    assertRerunBrowserReview(eligibility.review, f);
    assert.equal(
      mutations.length,
      0,
      "Eligibility and model context do not mutate",
    );
    const preparedResponse = await withholdSuccessfulResponseAndReload({
      page,
      url: `${origin.origin}${root}`,
      deadline,
      click: () =>
        section
          .getByRole("button", { name: "Prepare new execution", exact: true })
          .click(),
      validateResponse: (value) => {
        const receipt = assertRerunBrowserReceipt(value, f);
        assert.equal(receipt.state, "prepared");
        return receipt;
      },
      beforeReload: () => beforeReload("Preparing request…"),
    });
    // A lost Prepare response leaves only RequestID in the owner's browser.
    const prepared = await recover(
      `${root}/by-request/${preparedResponse.requestId}`,
      preparedResponse,
      1,
    );
    const article = section.getByRole("article", {
      name: `Whole-job re-execution ${prepared.intentId}`,
      exact: true,
    });
    const confirm = article.getByRole("button", {
      name: "Confirm new execution",
      exact: true,
    });
    const checkbox = article.getByRole("checkbox", {
      name: rerunAcknowledgement,
      exact: true,
    });
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(await confirm.isEnabled(), false);
    assert.deepEqual(mutations, [
      {
        method: "POST",
        path: root,
        body: {
          requestId: prepared.requestId,
          originalJobRunId: f.originalJobRunId,
          snapshotDigest: f.snapshotDigest,
        },
      },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertControlReachable(checkbox);
    await checkbox.check();
    await assertControlReachable(confirm);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Mobile page must not overflow",
    );
    const confirmedResponse = await withholdSuccessfulResponseAndReload({
      page,
      url: `${origin.origin}${root}/${prepared.intentId}/confirm`,
      deadline,
      click: () => confirm.click(),
      validateResponse: (value) => {
        const receipt = assertRerunBrowserReceipt(value, f, prepared);
        assert.equal(receipt.state, "confirmed");
        return receipt;
      },
      beforeReload: () => beforeReload("Confirming request…"),
    });
    // Lost Confirm uses the fixed IntentID learned by the earlier read, not a new POST.
    const confirmed = await recover(
      `${root}/${prepared.intentId}`,
      confirmedResponse,
      2,
    );
    await article.getByText("New execution created", { exact: true }).waitFor();
    assert.equal(await article.getByRole("checkbox").count(), 0);
    assert.equal(
      await article
        .getByRole("button", { name: "Confirm new execution", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(mutations[1], {
      method: "POST",
      path: `${root}/${prepared.intentId}/confirm`,
      body: {
        expectedVersion: prepared.version,
        intentDigest: prepared.intentDigest,
        reviewedRunContextDigest: prepared.reviewedRunContextDigest,
        acknowledgeNewExecution: true,
      },
    });
    assert.equal(
      mutations.length,
      2,
      "Reload and inspection never resubmit or approve",
    );
    const route = `/projects/${f.projectId}/pipelines?pipeline=${f.pipelineId}&run=`;
    assert.equal(
      await article
        .getByRole("link", { name: "View original execution", exact: true })
        .getAttribute("href"),
      route + f.originalRunId,
    );
    assert.equal(
      await article
        .getByRole("link", {
          name: "View new execution and independent approval",
          exact: true,
        })
        .getAttribute("href"),
      route + confirmed.newRunId,
    );
    assert.equal(
      await article
        .getByRole("button", { name: "Cancel new execution", exact: true })
        .count(),
      0,
    );
    const responseRecovery = {
      prepareResponseLost: true,
      confirmResponseLost: true,
      reloads: recoveredReloads,
      prepareInspections: reads.filter(
        (path) => path === `${root}/by-request/${prepared.requestId}`,
      ).length,
      confirmInspections: reads.filter(
        (path) => path === `${root}/${prepared.intentId}`,
      ).length,
    };
    assert.deepEqual(responseRecovery, {
      prepareResponseLost: true,
      confirmResponseLost: true,
      reloads: 2,
      prepareInspections: 1,
      confirmInspections: 1,
    });
    // This is explicitly an intermediate receipt, never overall acceptance.
    return {
      phase: "confirmed-awaiting-independent-approval",
      prepared,
      confirmed,
      preparePosts: 1,
      confirmPosts: 1,
      approvalPosts: 0,
      responseRecovery,
      runtimeAcceptanceComplete: false,
    };
  } finally {
    page.off("request", onRequest);
  }
}

/** Validate NEW approval evidence actually returned by the independently logged-in
 * candidate's existing approval dialog. The coordinator still proves distinct
 * persisted DecisionIDs and zero commands before approval in the real fixture. */
export function assertIndependentRerunApproval(
  approval,
  contract,
  confirmed,
  actorId,
) {
  assert.ok(id(actorId) && actorId !== contract.actorId);
  assert.equal(approval.pipelineRunId, confirmed.newRunId);
  assert.equal(approval.retryJobRunId, confirmed.newJobRunId);
  assert.equal(approval.plugin, "builtin:retry-approval");
  assert.equal(approval.bindingKind, "retry_whole_job_v1");
  assert.equal(approval.requestedBy, contract.actorId);
  const evidence = approval.retryReview?.evidence;
  assert.ok(evidence);
  assert.equal(evidence.context.pipelineRunId, confirmed.newRunId);
  assert.equal(evidence.identity.pipelineRunId, confirmed.newRunId);
  assert.equal(evidence.identity.jobRunId, confirmed.newJobRunId);
  assert.equal(evidence.inputs.sourceCommit, contract.expectedSourceCommit);
  assert.equal(
    evidence.context.definitionCommitSha,
    contract.definitionRevision,
  );
  assert.equal(
    evidence.context.resolvedDefinitionDigest,
    contract.resolvedSpecDigest,
  );
  assert.equal(evidence.context.actorId, contract.actorId);
  assert.ok(evidence.context.policy.candidates.includes(actorId));
  assert.equal(
    evidence.context.policy.candidates.includes(contract.actorId),
    false,
  );
  assert.ok(id(evidence.identity.claimId));
  assert.equal(approval.approvalId, evidence.approvalId);
  return evidence;
}
