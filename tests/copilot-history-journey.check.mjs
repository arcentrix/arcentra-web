import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  copilotHistoryStages,
  copilotTurnReceipt,
  validateCopilotHistoryContract,
} from "./copilot-history-journey.mjs";
const contract = {
  actorId: "user",
  projectId: "project",
  pipelineId: "pipeline",
  runId: "run",
  stepId: "step",
  phase: "create",
  previous: null,
};
test("history real fixture contract rejects missing, unbounded, foreign and arbitrary phase inputs", () => {
  assert.deepEqual(validateCopilotHistoryContract(contract), contract);
  for (const changed of [
    { phase: "mock" },
    { actorId: "" },
    { runId: "../foreign" },
    { previous: {} },
    { providerKey: "not-allowed" },
  ])
    assert.throws(() =>
      validateCopilotHistoryContract({ ...contract, ...changed }),
    );
  assert.throws(() =>
    validateCopilotHistoryContract({
      ...contract,
      phase: "resume",
      previous: {
        version: "copilot-history-v1",
        phase: "create",
        sendCount: 2,
        executionMutationCount: 0,
        actorId: "another-user",
      },
    }),
  );
});
test("history receipts prove durable actual bodies using hashes without storing plaintext", () => {
  const turn = {
    turnId: "turn",
    requestId: "request",
    sequence: 1,
    state: "completed",
    contentAvailable: true,
    question: "synthetic private question",
    text: "synthetic private answer",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  const receipt = copilotTurnReceipt(turn);
  assert.deepEqual(Object.keys(receipt).sort(), [
    "expiresAt",
    "questionSha256",
    "requestId",
    "sequence",
    "textSha256",
    "turnId",
  ]);
  assert.match(receipt.questionSha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.textSha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(receipt).includes(turn.question), false);
  assert.equal(JSON.stringify(receipt).includes(turn.text), false);
  for (const changed of [
    { state: "dispatching" },
    { contentAvailable: false },
    { text: "" },
    { expiresAt: "not-a-date" },
  ])
    assert.throws(() => copilotTurnReceipt({ ...turn, ...changed }));
});
test("real entrypoint does not fall back to mocked routes, browser storage seeding or unguarded evidence", async () => {
  const entry = await readFile(
    new URL("./actual-copilot-history-acceptance.mjs", import.meta.url),
    "utf8",
  );
  const journey = await readFile(
    new URL("./copilot-history-journey.mjs", import.meta.url),
    "utf8",
  );
  for (const source of [entry, journey])
    assert.doesNotMatch(
      source,
      /route\.fulfill|addInitScript|localStorage\.setItem|sessionStorage\.setItem/,
    );
  assert.match(entry, /ARCENTRA_REAL_STACK/);
  assert.match(entry, /actualBackendConfig\(\)/);
  assert.match(entry, /observeInboxLogin/);
  assert.doesNotMatch(
    entry,
    /page\.screenshot|safeFailureScreenshot|setSensitiveFormOpen\(false\)/,
  );
  assert.match(entry, /setSensitiveFormOpen\(true\)/);
  assert.match(entry, /flag: "wx"/);
  assert.match(journey, /SYNTHETIC_HISTORY_REPLY_1/);
  assert.match(journey, /SYNTHETIC_HISTORY_REPLY_2/);
  assert.match(journey, /Reload and restart must remain read-only/);
  assert.ok(copilotHistoryStages.includes("copilot-history-resume"));
});
