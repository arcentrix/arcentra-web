/** Actual production UI/API confirmations only. No fulfilled routes or injected sessions. */
import assert from "node:assert/strict";

export function validateExecutionBrowserContract(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [
    "actorId",
    "approvalId",
    "intentDigest",
    "intentId",
    "intentVersion",
    "jobRunId",
    "projectId",
    "retryMode",
    "runId",
    "version",
  ]);
  assert.equal(value.version, "copilot-execution-browser-v1");
  assert.equal(value.retryMode, "whole_job");
  for (const key of [
    "actorId",
    "approvalId",
    "intentId",
    "jobRunId",
    "projectId",
    "runId",
  ])
    assert.match(value[key], /^[A-Za-z0-9_-]{1,128}$/);
  assert.match(value.intentDigest, /^(?:v1:)?[a-f0-9]{64}$/);
  assert.ok(
    Number.isSafeInteger(value.intentVersion) && value.intentVersion > 0,
  );
  return value;
}

export function assertExecutionBrowserIdentity(value, contract, state) {
  assert.ok(value && typeof value === "object");
  for (const key of [
    "intentId",
    "projectId",
    "runId",
    "jobRunId",
    "approvalId",
    "intentDigest",
  ])
    assert.equal(value[key], contract[key], `Exact ${key} binding is required`);
  assert.equal(value.state, state);
  assert.equal(
    value.version,
    contract.intentVersion + (state === "submitted" ? 1 : 0),
  );
  if (state === "submitted") {
    assert.match(value.decisionId, /^[A-Za-z0-9_-]{1,128}$/);
    assert.ok(
      typeof value.submittedAt === "string" &&
        Number.isFinite(Date.parse(value.submittedAt)),
      "A durable submission timestamp is required",
    );
    assert.ok(Date.parse(value.submittedAt) >= Date.parse(value.createdAt));
    assert.ok(Date.parse(value.submittedAt) < Date.parse(value.expiresAt));
  }
}

export async function runExecutionBrowserJourney({
  page,
  base,
  contract,
  setStage,
}) {
  const f = validateExecutionBrowserContract(contract);
  const prefix = `/api/v1/projects/${f.projectId}/copilot`;
  const responseFor = (method, path) =>
    page.waitForResponse(
      (r) =>
        r.request().method() === method && new URL(r.url()).pathname === path,
    );
  const read = async (r) => {
    assert.equal(r.status(), 200, "Real Copilot route must succeed");
    assert.ok((await r.headerValue("cache-control"))?.includes("no-store"));
    const body = await r.json();
    assert.equal(body.code, 200);
    return body.detail;
  };
  const mutations = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (
      path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(r.method())
    )
      mutations.push({ method: r.method(), path, body: r.postDataJSON() });
  });
  setStage("copilot-execution-confirm");
  await page.goto(`${base}/workspace/Copilot/chat`);
  await page.getByLabel("Project ID", { exact: true }).fill(f.projectId);
  await page.getByLabel("Run ID", { exact: true }).fill(f.runId);
  const statusResponse = responseFor("GET", `${prefix}/status`);
  await page
    .getByRole("button", { name: "Load context choices", exact: true })
    .click();
  const status = await read(await statusResponse);
  assert.equal(status.retryExecutionAvailable, true);
  assert.equal(
    status.configured,
    false,
    "No model transport is used by this confirmation browser",
  );
  const listResponse = responseFor("GET", `${prefix}/execution-intents`);
  await page
    .getByRole("button", { name: "Load bound retry actions", exact: true })
    .click();
  const listed = await read(await listResponse);
  const intent = listed.intents.find((i) => i.intentId === f.intentId);
  assert.ok(intent);
  assertExecutionBrowserIdentity(intent, f, "prepared");
  assert.equal(intent.intentDigest, f.intentDigest);
  assert.equal(intent.version, f.intentVersion);
  assert.equal(intent.jobRunId, f.jobRunId);
  assert.equal(intent.approvalId, f.approvalId);
  assert.equal(intent.approvedCount, 1);
  assert.equal(intent.requiredApproverCount, 2);
  assert.equal(intent.runtimeAdmissionObserved, false);
  assert.equal(intent.retryReview.evidence.retryPlan.policy.max_attempts, 2);
  assert.equal(intent.retryReview.evidence.retryPlan.policy.mode, "whole_job");
  assert.deepEqual(
    intent.retryReview.evidence.retryPlan.policy.allowed_exit_codes,
    [23],
  );
  const action = page.getByRole("article", {
    name: `Bound retry action ${f.intentId}`,
    exact: true,
  });
  const submit = action.getByRole("button", {
    name: "Submit permanent approval · May start job and retries",
    exact: true,
  });
  assert.equal(
    await submit.isEnabled(),
    false,
    "Review/list alone must not consent",
  );
  assert.equal(mutations.length, 0);
  await action.getByRole("checkbox").check();
  assert.equal(await submit.isEnabled(), true);
  const confirmedResponse = responseFor(
    "POST",
    `${prefix}/execution-intents/${f.intentId}/confirm`,
  );
  await submit.click();
  const confirmed = await read(await confirmedResponse);
  assertExecutionBrowserIdentity(confirmed, f, "submitted");
  assert.match(confirmed.decisionId, /^[A-Za-z0-9_-]{1,128}$/);
  assert.deepEqual(mutations, [
    {
      method: "POST",
      path: `${prefix}/execution-intents/${f.intentId}/confirm`,
      body: {
        expectedVersion: f.intentVersion,
        intentDigest: f.intentDigest,
        acknowledgePermanentApproval: true,
      },
    },
  ]);
  await action.getByText(/Permanent approval submitted/).waitFor();
  setStage("copilot-execution-observe");
  let observed;
  const deadline = Date.now() + 20_000;
  do {
    const inspectedResponse = responseFor(
      "GET",
      `${prefix}/execution-intents/${f.intentId}`,
    );
    await action
      .getByRole("button", { name: "Inspect current action", exact: true })
      .click();
    observed = await read(await inspectedResponse);
    assertExecutionBrowserIdentity(observed, f, "submitted");
    assert.equal(observed.submittedAt, confirmed.submittedAt);
    assert.equal(observed.decisionId, confirmed.decisionId);
    if (observed.jobStatus === 4) break;
    assert.ok(
      Date.now() < deadline,
      "Real command/retry must reach terminal success within the existing lane budget",
    );
    await page.waitForTimeout(200);
  } while (true);
  assert.equal(observed.currentGeneration, 2);
  assert.equal(observed.runtimeAdmissionObserved, true);
  await action
    .getByText(/Runtime admission: Observed\. Job status: 4\. Generation: 2\./)
    .waitFor();
  assert.equal(
    mutations.length,
    1,
    "Status observation must not re-submit or trigger jobs",
  );
  return {
    version: f.version,
    actorId: f.actorId,
    intentId: f.intentId,
    decisionId: confirmed.decisionId,
    confirmPosts: 1,
    jobStatus: observed.jobStatus,
    generation: observed.currentGeneration,
    runtimeAdmissionObserved: observed.runtimeAdmissionObserved,
  };
}
