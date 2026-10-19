/** Strict simulated-transport UI coverage; never a substitute for real Control/MySQL evidence. */
import assert from "node:assert/strict";
import { runBrowserTest } from "./browser-harness.mjs";
import { runCopilotHistoryJourney } from "./copilot-history-journey.mjs";
const contract = {
  actorId: "fixture-user",
  projectId: "project",
  pipelineId: "pipeline",
  runId: "run",
  stepId: "step",
  phase: "create",
  previous: null,
};
await runBrowserTest(
  "simulated-transport",
  async ({ page, base, output, diagnostics, expectHttpError, setStage }) => {
    setStage("copilot-history-create");
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const conversation = {
      conversationId: "conversation",
      projectId: "project",
      pipelineId: "pipeline",
      runId: "run",
      state: "active",
      version: 1,
      createdAt,
      expiresAt,
    };
    const turns = [];
    const plans = [];
    let exists = false;
    let revoked = false;
    let historyAvailable = true;
    let modelCalls = 0;
    let previewInput;
    await page.addInitScript(() =>
      localStorage.setItem(
        "ARCADE_TOKENS",
        JSON.stringify({
          value: {
            accessToken: "synthetic-history-fixture-session",
            refreshToken: "synthetic-history-fixture-refresh",
          },
          expire: null,
        }),
      ),
    );
    const root = "/projects/project/copilot";
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/v1", "");
      const method = request.method();
      const ok = (detail) =>
        route.fulfill({
          status: 200,
          headers: { "Cache-Control": "no-store" },
          json: { code: 200, detail },
        });
      if (method === "GET") {
        if (path === "/users/fetch")
          return ok({
            userId: contract.actorId,
            username: "History fixture",
            email: "fixture@example.invalid",
          });
        if (path === "/me/menus")
          return ok([
            {
              menuId: "copilot",
              name: "Copilot",
              path: "/workspace/Copilot/chat",
              component: "Copilot",
              isEnabled: true,
            },
          ]);
        if (path === "/me/routes") return ok(["/workspace/Copilot/chat"]);
        if (path === "/me/effective-actions") return ok(["*:*"]);
        if (path === "/organization")
          return ok({
            list: [],
            total: 0,
            page: 1,
            pageSize: 20,
            canCreate: false,
          });
        if (path === "/inbox/unread-count")
          return ok({ count: 0, capped: false, incomplete: false });
        if (path === `${root}/status`)
          return ok({
            configured: true,
            models: [
              {
                providerId: "synthetic",
                kind: "openai-compatible",
                model: "fixture-model",
              },
            ],
            codeContext: "registered-text-artifacts-only",
            sourceContextEnabled: false,
            maxContextBytes: 24576,
            maxQuestionBytes: 4096,
            historyEnabled: true,
            historyAvailable,
            historyRetentionDays: 30,
            historyMaxSelectedTurns: 6,
            historyMaxBytes: 8192,
          });
        if (path === `${root}/runs/run/context`)
          return ok({
            steps: [
              { stepRunId: "step", name: "Synthetic compile", status: 5 },
            ],
            artifacts: [],
            warnings: [],
          });
        if (path === `${root}/conversations`) {
          assert.equal(url.searchParams.get("limit"), "20");
          return ok({ conversations: exists ? [conversation] : [] });
        }
        if (path === `${root}/conversations/conversation`) {
          if (revoked)
            return route.fulfill({
              status: 403,
              json: { code: 403, errMsg: "Scoped history access denied" },
            });
          assert.equal(exists, true);
          assert.equal(url.searchParams.get("after"), "0");
          return ok({ conversation, turns });
        }
        if (path === `${root}/conversations/conversation/plans`) {
          assert.equal(url.searchParams.get("limit"), "20");
          assert.equal(url.searchParams.get("after"), "0");
          return ok({ plans });
        }
      }
      if (method === "POST") {
        const input = request.postDataJSON();
        if (path === `${root}/conversations`) {
          assert.deepEqual(Object.keys(input).sort(), [
            "acknowledgeRetention",
            "requestId",
            "runId",
          ]);
          assert.equal(input.runId, "run");
          assert.equal(input.acknowledgeRetention, true);
          assert.equal(exists, false);
          exists = true;
          return ok(conversation);
        }
        if (path === `${root}/conversations/conversation/preview`) {
          assert.equal(input.shareSelectedContext, false);
          assert.equal(input.runId, "run");
          assert.ok(input.historyTurnIds.length <= 6);
          previewInput = input;
          const selected = input.historyTurnIds.map((id) => {
            const turn = turns.find((row) => row.turnId === id);
            assert.ok(turn);
            return turn;
          });
          const text = `Question: ${input.question}\n${selected.map((turn) => `Untrusted history: ${turn.question}\n${turn.text}`).join("\n")}\n${input.context.stepRunIds.length ? "Synthetic compiler evidence [REDACTED]" : ""}`;
          return ok({
            text,
            digest: `digest-${turns.length}`,
            evidence: [],
            warnings: [],
            historyTurnIds: input.historyTurnIds,
            historyBytes: selected.reduce(
              (sum, turn) => sum + Buffer.byteLength(turn.question + turn.text),
              0,
            ),
          });
        }
        if (path === `${root}/conversations/conversation/turns`) {
          assert.equal(input.shareSelectedContext, true);
          assert.equal(input.contextDigest, `digest-${turns.length}`);
          assert.equal(input.question, previewInput.question);
          assert.deepEqual(input.historyTurnIds, previewInput.historyTurnIds);
          assert.deepEqual(input.context, previewInput.context);
          modelCalls++;
          const turn = {
            turnId: `turn-${modelCalls}`,
            requestId: input.requestId,
            sequence: modelCalls,
            state: "completed",
            version: 3,
            question: input.question,
            text: `SYNTHETIC_HISTORY_REPLY_${modelCalls}\nModel suggestion <img src=x onerror=alert(1)> https://untrusted.invalid/execute is inert. [REDACTED]`,
            evidence: [],
            warnings: [],
            contentAvailable: true,
            createdAt,
            expiresAt,
          };
          turns.push(turn);
          return ok(turn);
        }
        if (path === `${root}/conversations/conversation/plans`) {
          assert.deepEqual(Object.keys(input).sort(), [
            "kind",
            "requestId",
            "turnId",
          ]);
          assert.equal(input.kind, "new_run_review");
          assert.equal(input.turnId, "turn-1");
          const plan = {
            planId: "plan",
            requestId: input.requestId,
            turnId: input.turnId,
            kind: "new_run_review",
            state: "proposed",
            version: 1,
            planDigest: "plan-digest",
            executionEnabled: false,
            executionStatus: "Not executed",
            eligible: true,
            payload: {
              schemaVersion: 1,
              kind: "new_run_review",
              label: "Review a new run; not a resumed step",
              newRun: { pipelineId: "pipeline", diagnosticRunId: "run" },
            },
            createdAt,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          };
          plans.push(plan);
          return ok(plan);
        }
        if (path === `${root}/conversations/conversation/plans/plan/review`) {
          assert.deepEqual(input, {
            expectedVersion: 1,
            planDigest: "plan-digest",
            acknowledgeNotExecuted: true,
          });
          plans[0] = { ...plans[0], state: "reviewed", version: 2 };
          return ok(plans[0]);
        }
      }
      diagnostics.unhandledRoutes.push(`${method} ${path}`);
      return route.fulfill({
        status: 501,
        json: { code: 501, errMsg: "Unexpected simulated route" },
      });
    });
    const profileResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/users/fetch",
    );
    await page.goto(`${base}/workspace/Copilot/chat`);
    const created = await runCopilotHistoryJourney({
      page,
      base,
      contract,
      profileResponse: await profileResponse,
      setStage,
    });
    assert.equal(created.sendCount, 2);
    assert.equal(modelCalls, 2);
    const profileAgain = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/users/fetch",
    );
    await page.reload();
    const resumed = await runCopilotHistoryJourney({
      page,
      base,
      contract: { ...contract, phase: "resume", previous: created },
      profileResponse: await profileAgain,
      setStage,
    });
    assert.equal(resumed.sendCount, 0);
    assert.equal(modelCalls, 2);
    // Real drawer close/reopen does not restore consent or transmit saved text.
    await page
      .getByRole("button", { name: "Open Copilot", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project ID", { exact: true }).fill("project");
    await dialog.getByLabel("Run ID", { exact: true }).fill("run");
    await dialog
      .getByRole("button", { name: "Load context choices", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Load private conversations", exact: true })
      .click();
    await dialog
      .getByRole("button", {
        name: "Open private conversation conversation",
        exact: true,
      })
      .click();
    await dialog
      .getByRole("article", { name: "Saved turn 1", exact: true })
      .waitFor();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Copilot", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("Project ID", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await dialog
        .getByRole("article", { name: "Saved turn 1", exact: true })
        .count(),
      0,
    );
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    // A failed revalidation must remove bodies and counts in the same view.
    revoked = true;
    expectHttpError(
      "/api/v1/projects/project/copilot/conversations/conversation",
      403,
    );
    await page
      .getByRole("button", { name: "Refresh private history", exact: true })
      .click();
    await page
      .getByText(/Previously displayed private content has been cleared/)
      .waitFor();
    assert.equal(await page.getByText(/SYNTHETIC_HISTORY_REPLY_/).count(), 0);
    assert.equal(
      await page.getByRole("list", { name: "Your conversations" }).count(),
      0,
    );
    historyAvailable = false;
    await page
      .getByRole("button", { name: "Load context choices", exact: true })
      .click();
    await page.getByText(/valid managed encryption key is required/).waitFor();
    assert.equal(
      await page
        .getByRole("button", {
          name: "Create private conversation · 30 days",
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(modelCalls, 2);
    await page.screenshot({
      path: `${output}/copilot-history-mobile.png`,
      fullPage: true,
    });
    setStage("journey-complete");
  },
);
