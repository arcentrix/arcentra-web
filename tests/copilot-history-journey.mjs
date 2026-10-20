/** Real UI/API history journey. This module never intercepts, seeds or substitutes responses. */
import assert from "node:assert/strict";
import { assertDisabledTerminalRerunProbe } from "./copilot-execution-journey.mjs";
import { createHash } from "node:crypto";
import { assertControlReachable } from "./artifact-controls.mjs";
export const copilotHistoryStages = Object.freeze([
  "copilot-history-create",
  "copilot-history-preview",
  "copilot-history-send",
  "copilot-history-followup",
  "copilot-history-plan",
  "copilot-history-reload",
  "copilot-history-resume",
  "copilot-history-mobile",
]);
const id = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");
export function validateCopilotHistoryContract(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [
    "actorId",
    "phase",
    "pipelineId",
    "previous",
    "projectId",
    "runId",
    "stepId",
  ]);
  for (const name of ["actorId", "pipelineId", "projectId", "runId", "stepId"])
    assert.ok(id(value[name]), "Verified fixture identity is required");
  assert.ok(["create", "resume"].includes(value.phase));
  if (value.phase === "create") assert.equal(value.previous, null);
  else {
    const prior = value.previous;
    assert.ok(
      prior &&
        prior.version === "copilot-history-v1" &&
        prior.phase === "create" &&
        prior.sendCount === 2 &&
        prior.executionMutationCount === 0,
    );
    for (const name of ["actorId", "pipelineId", "projectId", "runId"])
      assert.equal(prior[name], value[name]);
    assert.ok(
      id(prior.conversationId) &&
        prior.turns?.length === 2 &&
        prior.plan?.kind === "new_run_review" &&
        prior.plan?.state === "reviewed" &&
        prior.plan?.executionEnabled === false &&
        prior.uncheckedHistoryExcluded === true &&
        Array.isArray(prior.previewDigests) &&
        prior.previewDigests.length === 2 &&
        prior.previewDigests.every(
          (digest) =>
            typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest),
        ),
    );
  }
  return value;
}
export function copilotTurnReceipt(turn) {
  assert.ok(
    turn &&
      id(turn.turnId) &&
      id(turn.requestId) &&
      Number.isSafeInteger(turn.sequence) &&
      turn.sequence > 0 &&
      turn.state === "completed" &&
      turn.contentAvailable === true &&
      typeof turn.question === "string" &&
      typeof turn.text === "string" &&
      turn.text.length > 0 &&
      Number.isFinite(Date.parse(turn.expiresAt)),
    "A completed durable body is required",
  );
  return {
    turnId: turn.turnId,
    requestId: turn.requestId,
    sequence: turn.sequence,
    questionSha256: hash(turn.question),
    textSha256: hash(turn.text),
    expiresAt: turn.expiresAt,
  };
}
function planReceipt(plan) {
  assert.ok(
    plan &&
      id(plan.planId) &&
      id(plan.turnId) &&
      plan.kind === "new_run_review" &&
      plan.state === "reviewed" &&
      Number.isSafeInteger(plan.version) &&
      plan.version > 1 &&
      typeof plan.planDigest === "string" &&
      plan.planDigest.length > 0 &&
      Number.isFinite(Date.parse(plan.expiresAt)) &&
      plan.executionEnabled === false &&
      plan.executionStatus === "Not executed",
    "A durable review-only plan is required",
  );
  return {
    planId: plan.planId,
    turnId: plan.turnId,
    kind: plan.kind,
    state: plan.state,
    version: plan.version,
    planDigest: plan.planDigest,
    expiresAt: plan.expiresAt,
    executionEnabled: false,
  };
}
export async function runCopilotHistoryJourney({
  page,
  base,
  contract,
  profileResponse,
  setStage,
  expectDisabledTerminalRerunResponse,
}) {
  const fixture = validateCopilotHistoryContract(contract);
  const envelope = async (response) => {
    assert.equal(response.status(), 200, "Copilot API must return HTTP 200");
    assert.equal(
      (await response.headerValue("cache-control"))?.includes("no-store"),
      true,
      "Private responses require no-store",
    );
    const body = await response.json();
    assert.equal(body.code, 200);
    return body.detail;
  };
  const profile = await profileResponse.json();
  assert.ok(
    profileResponse.status() === 200 &&
      profile.code === 200 &&
      profile.detail.userId === fixture.actorId,
    "The actual authenticated actor must match the fixture",
  );
  const prefix = `/api/v1/projects/${fixture.projectId}/copilot/conversations`;
  const responseFor = (method, suffix, timeout = 60000) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        new URL(response.url()).pathname === `${prefix}${suffix}`,
      { timeout },
    );
  const mutations = [];
  const requestObserver = (request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    )
      mutations.push({ method: request.method(), path });
  };
  page.on("request", requestObserver);
  let conversationId;
  let savedTurns;
  let savedPlan;
  let selections;
  let previewDigests = [];
  let uncheckedHistoryExcluded = false;
  const load = async () => {
    await page.goto(`${base}/workspace/Copilot/chat`);
    await page
      .getByLabel("Project ID", { exact: true })
      .fill(fixture.projectId);
    await page.getByLabel("Run ID", { exact: true }).fill(fixture.runId);
    // Only the actual default-off history fixture supplies this callback.
    // Watch before the click and inspect the real response before any allowance.
    const disabledProbe = expectDisabledTerminalRerunResponse
      ? page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname ===
              `/api/v1/projects/${fixture.projectId}/copilot/rerun-intents/availability`,
          { timeout: 60000 },
        )
      : undefined;
    disabledProbe?.catch(() => {});
    await page
      .getByRole("button", { name: "Load context choices", exact: true })
      .click();
    if (disabledProbe) {
      const response = await disabledProbe;
      await assertDisabledTerminalRerunProbe(response, base, fixture.projectId);
      assert.equal(
        await page
          .getByRole("region", {
            name: "Whole-job new executions",
            exact: true,
          })
          .count(),
        0,
        "The read-only history fixture must not expose terminal execution controls",
      );
      expectDisabledTerminalRerunResponse(response);
    }
    await page
      .getByRole("button", { name: "Load private conversations", exact: true })
      .waitFor();
  };
  const openSaved = async (expectedTurns, expectedPlan) => {
    const listed = responseFor("GET", "");
    await page
      .getByRole("button", { name: "Load private conversations", exact: true })
      .click();
    const list = await envelope(await listed);
    assert.ok(
      list.conversations.some(
        (row) =>
          row.conversationId === conversationId &&
          row.projectId === fixture.projectId &&
          row.runId === fixture.runId,
      ),
    );
    const detailResponse = responseFor("GET", `/${conversationId}`);
    await page
      .getByRole("button", {
        name: `Open private conversation ${conversationId}`,
        exact: true,
      })
      .click();
    const detail = await envelope(await detailResponse);
    assert.equal(detail.conversation.conversationId, conversationId);
    for (const name of ["projectId", "pipelineId", "runId"])
      assert.equal(detail.conversation[name], fixture[name]);
    assert.deepEqual(detail.turns.map(copilotTurnReceipt), expectedTurns);
    for (const turn of detail.turns) {
      const article = page.getByRole("article", {
        name: `Saved turn ${turn.sequence}`,
        exact: true,
      });
      await article.waitFor();
      assert.ok(
        (await article.locator("pre").innerText()) === turn.text,
        "Visible saved body must match durable response",
      );
      assert.equal(
        await article.locator("a, img, script, iframe").count(),
        0,
        "Saved model text must remain inert",
      );
      assert.ok((await article.innerText()).includes(turn.question));
      assert.equal(
        await page
          .getByLabel(`Include turn ${turn.sequence} in next preview`, {
            exact: true,
          })
          .isChecked(),
        false,
      );
    }
    assert.equal(
      await page.getByLabel(/Send this question/).isChecked(),
      false,
    );
    const planResponse = responseFor("GET", `/${conversationId}/plans`);
    await page
      .getByRole("button", { name: "Load saved plans", exact: true })
      .click();
    const planList = await envelope(await planResponse);
    const plan = planList.plans.find(
      (row) => row.planId === expectedPlan.planId,
    );
    assert.deepEqual(planReceipt(plan), expectedPlan);
    await page
      .getByRole("article", {
        name: `Plan ${expectedPlan.planId}`,
        exact: true,
      })
      .getByText("Not executed", { exact: true })
      .waitFor();
  };
  try {
    setStage(
      fixture.phase === "create"
        ? "copilot-history-create"
        : "copilot-history-resume",
    );
    await load();
    if (fixture.phase === "create") {
      assert.ok(
        (
          await page
            .getByRole("region", { name: "Private conversation history" })
            .innerText()
        ).includes("30 days"),
      );
      const createdResponse = responseFor("POST", "");
      await page
        .getByRole("button", {
          name: "Create private conversation · 30 days",
          exact: true,
        })
        .click();
      const response = await createdResponse;
      assert.equal(
        response.request().postDataJSON().acknowledgeRetention,
        true,
      );
      const created = await envelope(response);
      assert.ok(id(created.conversationId));
      conversationId = created.conversationId;
      for (const name of ["projectId", "pipelineId", "runId"])
        assert.equal(created[name], fixture[name]);
      const step = page.getByLabel(fixture.stepId, { exact: false });
      await step.check();
      const firstQuestion =
        "Why did the synthetic compiler fail? Give a read-only diagnosis.";
      const secondQuestion =
        "Using only the checked earlier pair, explain the next diagnostic check. Do not execute anything.";
      const send = async (question, selected) => {
        setStage(
          selected.length
            ? "copilot-history-followup"
            : "copilot-history-preview",
        );
        await page.getByLabel("Question", { exact: true }).fill(question);
        const previewResponse = responseFor(
          "POST",
          `/${conversationId}/preview`,
        );
        await page
          .getByRole("button", {
            name: "Preview redacted context",
            exact: true,
          })
          .click();
        const previewRaw = await previewResponse;
        assert.deepEqual(
          previewRaw.request().postDataJSON().historyTurnIds,
          selected,
        );
        const preview = await envelope(previewRaw);
        assert.deepEqual(preview.historyTurnIds ?? [], selected);
        assert.ok(
          typeof preview.text === "string" && preview.text.includes(question),
        );
        assert.ok(preview.historyBytes <= 8192);
        if (selected.length)
          assert.ok(
            preview.text.includes("SYNTHETIC_HISTORY_REPLY_1"),
            "Selected history must appear in the exact approved preview",
          );
        const previewRegion = page.getByRole("region", {
          name: "Redacted context preview",
          exact: true,
        });
        assert.ok(
          (await previewRegion.locator("pre").innerText()) === preview.text,
          "Visible preview must match exact outbound text",
        );
        assert.equal(
          await page
            .getByRole("button", {
              name: "Analyze selected context",
              exact: true,
            })
            .isDisabled(),
          true,
        );
        await page.getByLabel(/Send this question/).check();
        const turnResponse = responseFor("POST", `/${conversationId}/turns`);
        setStage("copilot-history-send");
        await page
          .getByRole("button", {
            name: "Analyze selected context",
            exact: true,
          })
          .click();
        const turnRaw = await turnResponse;
        const input = turnRaw.request().postDataJSON();
        assert.equal(input.contextDigest, preview.digest);
        assert.equal(input.shareSelectedContext, true);
        assert.deepEqual(input.historyTurnIds, selected);
        const turn = await envelope(turnRaw);
        previewDigests.push(hash(preview.text));
        assert.equal(turn.requestId, input.requestId);
        await page
          .getByRole("article", {
            name: `Saved turn ${turn.sequence}`,
            exact: true,
          })
          .waitFor();
        return turn;
      };
      const first = await send(firstQuestion, []);
      assert.ok(
        first.text.includes("SYNTHETIC_HISTORY_REPLY_1"),
        "First synthetic provider marker must be visible in its saved answer",
      );
      // The unchanged current log selection makes this a valid preview with
      // no selected prior turns. It must not inherit the preceding answer.
      await page.getByLabel("Question", { exact: true }).fill(secondQuestion);
      const uncheckedResponse = responseFor(
        "POST",
        `/${conversationId}/preview`,
      );
      await page
        .getByRole("button", { name: "Preview redacted context", exact: true })
        .click();
      const uncheckedRaw = await uncheckedResponse;
      assert.deepEqual(
        uncheckedRaw.request().postDataJSON().historyTurnIds,
        [],
      );
      const unchecked = await envelope(uncheckedRaw);
      assert.deepEqual(unchecked.historyTurnIds, []);
      assert.ok(
        typeof unchecked.text === "string" &&
          !unchecked.text.includes("SYNTHETIC_HISTORY_REPLY_1"),
        "Unchecked history must be absent from the exact preview",
      );
      uncheckedHistoryExcluded = true;
      await page
        .getByLabel(`Include turn ${first.sequence} in next preview`, {
          exact: true,
        })
        .check();
      await step.uncheck();
      const second = await send(secondQuestion, [first.turnId]);
      assert.ok(
        second.text.includes("SYNTHETIC_HISTORY_REPLY_2"),
        "Second synthetic provider marker must be visible in its saved answer",
      );
      savedTurns = [first, second].map(copilotTurnReceipt);
      selections = [[], [first.turnId]];
      assert.equal(savedTurns[1].sequence, savedTurns[0].sequence + 1);
      setStage("copilot-history-plan");
      await page
        .getByLabel("Saved turn for proposal", { exact: true })
        .selectOption(first.turnId);
      await page
        .getByLabel("Proposal kind", { exact: true })
        .selectOption("new_run_review");
      const planResponse = responseFor("POST", `/${conversationId}/plans`);
      await page
        .getByRole("button", {
          name: "Create review-only proposal",
          exact: true,
        })
        .click();
      const proposal = await envelope(await planResponse);
      assert.equal(proposal.executionEnabled, false);
      assert.equal(proposal.executionStatus, "Not executed");
      assert.equal(proposal.state, "proposed");
      assert.equal(proposal.eligible, true);
      const article = page.getByRole("article", {
        name: `Plan ${proposal.planId}`,
        exact: true,
      });
      await article.getByLabel(/I understand this records review only/).check();
      const reviewedResponse = responseFor(
        "POST",
        `/${conversationId}/plans/${proposal.planId}/review`,
      );
      await article
        .getByRole("button", {
          name: "Record review · Not executed",
          exact: true,
        })
        .click();
      const reviewedRaw = await reviewedResponse;
      assert.deepEqual(reviewedRaw.request().postDataJSON(), {
        expectedVersion: proposal.version,
        planDigest: proposal.planDigest,
        acknowledgeNotExecuted: true,
      });
      savedPlan = planReceipt(await envelope(reviewedRaw));
      setStage("copilot-history-reload");
      await load();
      await openSaved(savedTurns, savedPlan);
    } else {
      conversationId = fixture.previous.conversationId;
      savedTurns = fixture.previous.turns;
      savedPlan = fixture.previous.plan;
      selections = fixture.previous.historySelections;
      previewDigests = fixture.previous.previewDigests;
      uncheckedHistoryExcluded = fixture.previous.uncheckedHistoryExcluded;
      await openSaved(savedTurns, savedPlan);
    }
    setStage("copilot-history-mobile");
    await page.setViewportSize({ width: 390, height: 844 });
    await assertControlReachable(
      page.getByRole("button", {
        name: "Refresh private history",
        exact: true,
      }),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "Private history must fit the mobile viewport",
    );
    assert.equal(
      await page
        .getByRole("region", { name: "Review-only action plans" })
        .locator("script, img, iframe")
        .count(),
      0,
    );
    const permitted = new Set([
      prefix,
      `${prefix}/${conversationId}/preview`,
      `${prefix}/${conversationId}/turns`,
      `${prefix}/${conversationId}/plans`,
      `${prefix}/${conversationId}/plans/${savedPlan.planId}/review`,
    ]);
    const executionMutations = mutations.filter(
      (request) => request.method !== "POST" || !permitted.has(request.path),
    );
    assert.deepEqual(
      executionMutations,
      [],
      "The history journey must not invoke any execution mutation",
    );
    const sendCount = mutations.filter(
      (request) => request.path === `${prefix}/${conversationId}/turns`,
    ).length;
    assert.equal(sendCount, fixture.phase === "create" ? 2 : 0);
    if (fixture.phase === "resume")
      assert.deepEqual(
        mutations,
        [],
        "Reload and restart must remain read-only",
      );
    return {
      version: "copilot-history-v1",
      phase: fixture.phase,
      actorId: fixture.actorId,
      projectId: fixture.projectId,
      pipelineId: fixture.pipelineId,
      runId: fixture.runId,
      conversationId,
      turns: savedTurns,
      plan: savedPlan,
      historySelections: selections,
      previewDigests,
      uncheckedHistoryExcluded,
      sendCount,
      executionMutationCount: 0,
    };
  } finally {
    page.off("request", requestObserver);
  }
}
