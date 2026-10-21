import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  copilotHistoryStages,
  copilotTurnReceipt,
  runCopilotHistoryJourney,
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
  assert.match(entry, /expectDisabledTerminalRerunResponse/);
  assert.ok(
    journey.indexOf("await assertDisabledTerminalRerunProbe(response") <
      journey.indexOf("expectDisabledTerminalRerunResponse(response)"),
  );
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

// Unit-only interface doubles exercise every create/resume branch of the real
// journey. They are not used by the real entrypoint or as browser/API evidence.
async function checkHistoryJourneyInterface(requireDisabledProbe) {
  const base = "http://127.0.0.1:4173";
  const prefix = "/api/v1/projects/project/copilot/conversations";
  const conversation = { ...contract, conversationId: "conversation" };
  const turns = [];
  const listeners = new Set();
  const waiters = [];
  const stages = [];
  const reachability = [];
  const probes = [];
  let lastProbe;
  let question = "";
  let historyTurnIds = [];
  let consent = false;
  let preview;
  let plan;
  let selectedTurn;
  let selectedKind;
  const response = (method, suffix, detail, input) => {
    const request = {
      method: () => method,
      url: () => `${base}${prefix}${suffix}`,
      postDataJSON: () => input,
    };
    return {
      request: () => request,
      url: request.url,
      status: () => 200,
      headerValue: async (name) => {
        assert.equal(name, "cache-control");
        return "no-store";
      },
      json: async () => ({ code: 200, detail }),
    };
  };
  const emit = (method, suffix, detail, input) => {
    emitResponse(response(method, suffix, detail, input));
  };
  const emitResponse = (value) => {
    for (const listener of listeners) listener(value.request());
    const index = waiters.findIndex((waiter) => waiter.predicate(value));
    assert.notEqual(
      index,
      -1,
      "Every emitted response needs its exact watcher",
    );
    waiters.splice(index, 1)[0].resolve(value);
  };
  const nameText = (name) => (name instanceof RegExp ? name.source : name);
  const locator = (role, name, parent) => {
    assert.equal(typeof nameText(name), "string");
    const control = {
      async fill(value) {
        assert.equal(role, "label");
        assert.equal(typeof value, "string");
        if (name === "Question") {
          question = value;
          consent = false;
        } else assert.ok(["Project ID", "Run ID"].includes(name));
      },
      async selectOption(value) {
        assert.equal(role, "label");
        assert.equal(typeof value, "string");
        if (name === "Saved turn for proposal") selectedTurn = value;
        else {
          assert.equal(name, "Proposal kind");
          selectedKind = value;
        }
      },
      async check() {
        assert.equal(role, "label");
        if (name instanceof RegExp) {
          if (name.source.includes("Send this question")) consent = true;
          else {
            assert.equal(parent, "Plan plan");
            assert.ok(name.test("I understand this records review only"));
          }
        } else if (name !== contract.stepId) {
          const match = /^Include turn (\d+) in next preview$/.exec(name);
          assert.ok(match);
          historyTurnIds = [turns[Number(match[1]) - 1].turnId];
          consent = false;
        }
      },
      async uncheck() {
        assert.equal(name, contract.stepId);
        consent = false;
      },
      async isChecked() {
        return name instanceof RegExp ? consent : false;
      },
      async isDisabled() {
        assert.equal(name, "Analyze selected context");
        return !consent;
      },
      async waitFor() {
        if (role === "article" && name.startsWith("Saved turn "))
          assert.ok(
            turns.some((turn) => name === `Saved turn ${turn.sequence}`),
          );
        if (role === "text") {
          assert.equal(parent, "Plan plan");
          assert.equal(name, "Not executed");
          assert.equal(plan.state, "reviewed");
        }
      },
      async innerText() {
        if (name === "Private conversation history")
          return "Retained for 30 days";
        if (parent === "Redacted context preview") return preview.text;
        const turn = turns.find(
          (turn) => (parent || name) === `Saved turn ${turn.sequence}`,
        );
        assert.ok(turn);
        return role === "selector"
          ? turn.text
          : `${turn.question}\n${turn.text}`;
      },
      async count() {
        if (role === "region" && name === "Whole-job new executions") return 0;
        assert.equal(role, "selector");
        assert.ok(
          ["a, img, script, iframe", "script, img, iframe"].includes(name),
        );
        return 0;
      },
      getByLabel: (child) => locator("label", child, name),
      getByRole: (childRole, options) => locator(childRole, options.name, name),
      getByText: (child, options) => {
        assert.deepEqual(options, { exact: true });
        return locator("text", child, name);
      },
      locator: (selector) => locator("selector", selector, name),
      async scrollIntoViewIfNeeded() {
        assert.equal(name, "Refresh private history");
        reachability.push("scroll");
      },
      async evaluate(callback) {
        assert.equal(name, "Refresh private history");
        reachability.push("evaluate");
        return callback(element);
      },
      async click(options) {
        assert.equal(role, "button");
        if (options) {
          assert.equal(name, "Refresh private history");
          assert.deepEqual(options, { trial: true });
          reachability.push("trial-click");
          return;
        }
        switch (name) {
          case "Load context choices": {
            if (!requireDisabledProbe) return;
            const path =
              "/api/v1/projects/project/copilot/rerun-intents/availability";
            const request = {
              url: () => `${base}${path}`,
              method: () => "GET",
              isNavigationRequest: () => false,
              resourceType: () => "xhr",
            };
            lastProbe = {
              url: request.url,
              request: () => request,
              status: () => 503,
              headerValue: async () => "private, no-store",
              json: async () => ({
                code: 503,
                path,
                timestamp: 1792474000,
                errMsg: "Whole-job new execution is temporarily unavailable",
              }),
            };
            return emitResponse(lastProbe);
          }
          case "Create private conversation · 30 days":
            return emit("POST", "", conversation, {
              acknowledgeRetention: true,
            });
          case "Load private conversations":
            return emit("GET", "", { conversations: [conversation] });
          case "Open private conversation conversation":
            historyTurnIds = [];
            consent = false;
            return emit("GET", "/conversation", { conversation, turns });
          case "Preview redacted context":
            preview = {
              text: `Question: ${question}\n${historyTurnIds.map((id) => turns.find((turn) => turn.turnId === id).text).join("\n")}`,
              digest: `preview-${turns.length}`,
              historyTurnIds: [...historyTurnIds],
              historyBytes: historyTurnIds.length * 64,
            };
            consent = false;
            return emit("POST", "/conversation/preview", preview, {
              historyTurnIds: [...historyTurnIds],
            });
          case "Analyze selected context": {
            assert.equal(consent, true);
            const sequence = turns.length + 1;
            const turn = {
              turnId: `turn-${sequence}`,
              requestId: `request-${sequence}`,
              sequence,
              question,
              text: `SYNTHETIC_HISTORY_REPLY_${sequence}`,
              state: "completed",
              contentAvailable: true,
              expiresAt: "2099-01-01T00:00:00Z",
            };
            turns.push(turn);
            emit("POST", "/conversation/turns", turn, {
              requestId: turn.requestId,
              contextDigest: preview.digest,
              historyTurnIds: [...historyTurnIds],
              shareSelectedContext: true,
            });
            historyTurnIds = [];
            consent = false;
            return;
          }
          case "Create review-only proposal":
            assert.equal(selectedTurn, "turn-1");
            assert.equal(selectedKind, "new_run_review");
            plan = {
              planId: "plan",
              turnId: selectedTurn,
              kind: selectedKind,
              state: "proposed",
              version: 1,
              planDigest: "plan-digest",
              expiresAt: "2099-01-01T00:00:00Z",
              executionEnabled: false,
              executionStatus: "Not executed",
              eligible: true,
            };
            return emit("POST", "/conversation/plans", plan);
          case "Record review · Not executed": {
            assert.equal(parent, "Plan plan");
            const input = {
              expectedVersion: plan.version,
              planDigest: plan.planDigest,
              acknowledgeNotExecuted: true,
            };
            plan = { ...plan, state: "reviewed", version: 2 };
            return emit("POST", "/conversation/plans/plan/review", plan, input);
          }
          case "Load saved plans":
            return emit("GET", "/conversation/plans", { plans: [plan] });
          default:
            assert.fail(`Unexpected journey button: ${name}`);
        }
      },
    };
    return control;
  };
  // Page deliberately has no Locator-only scrollIntoViewIfNeeded method.
  const page = {
    async goto(url) {
      assert.equal(url, `${base}/workspace/Copilot/chat`);
      historyTurnIds = [];
      consent = false;
    },
    getByRole: (role, options) => locator(role, options.name),
    getByLabel: (name) => locator("label", name),
    waitForResponse(predicate, options) {
      assert.equal(typeof predicate, "function");
      assert.deepEqual(options, { timeout: 60000 });
      return new Promise((resolve) => waiters.push({ predicate, resolve }));
    },
    on(event, listener) {
      assert.equal(event, "request");
      listeners.add(listener);
    },
    off(event, listener) {
      assert.equal(event, "request");
      assert.equal(listeners.delete(listener), true);
    },
    async setViewportSize(size) {
      assert.deepEqual(size, { width: 390, height: 844 });
    },
    async evaluate(callback) {
      return callback();
    },
  };
  const element = {
    getBoundingClientRect: () => ({
      left: 10,
      top: 10,
      right: 210,
      bottom: 50,
      width: 200,
      height: 40,
    }),
    getAttribute: () => "Refresh private history",
    contains: (target) => target === element,
  };
  const globals = ["document", "window", "innerWidth", "innerHeight"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
  );
  try {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    globalThis.window = { innerWidth: 390 };
    globalThis.document = {
      documentElement: { scrollWidth: 390 },
      querySelector: () => null,
      elementFromPoint: () => element,
    };
    const input = {
      ...(requireDisabledProbe
        ? {
            expectDisabledTerminalRerunResponse: (value) => {
              assert.strictEqual(value, lastProbe);
              probes.push(stages.at(-1));
            },
          }
        : {}),
      page,
      base,
      profileResponse: response("GET", "/profile", {
        userId: contract.actorId,
      }),
      setStage: (stage) => {
        assert.ok(copilotHistoryStages.includes(stage));
        stages.push(stage);
      },
    };
    const created = await runCopilotHistoryJourney({ ...input, contract });
    assert.equal(created.sendCount, 2);
    assert.deepEqual(created.historySelections, [[], ["turn-1"]]);
    assert.equal(created.uncheckedHistoryExcluded, true);
    const resumed = await runCopilotHistoryJourney({
      ...input,
      contract: { ...contract, phase: "resume", previous: created },
    });
    assert.equal(resumed.sendCount, 0);
    assert.deepEqual(resumed.turns, created.turns);
    assert.deepEqual(resumed.plan, created.plan);
    assert.deepEqual(reachability, [
      "scroll",
      "evaluate",
      "trial-click",
      "scroll",
      "evaluate",
      "trial-click",
    ]);
    assert.deepEqual(
      probes,
      requireDisabledProbe
        ? [
            "copilot-history-create",
            "copilot-history-reload",
            "copilot-history-resume",
          ]
        : [],
    );
    assert.equal(waiters.length, 0);
    assert.equal(listeners.size, 0);
    for (const stage of copilotHistoryStages) assert.ok(stages.includes(stage));
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
for (const requireDisabledProbe of [false, true])
  test(`create and resume preserve full journey contracts with default-off probes ${requireDisabledProbe}`, () =>
    checkHistoryJourneyInterface(requireDisabledProbe));

for (const [name, change] of [
  [
    "wrong body code",
    (value) => {
      value.body.code = 500;
    },
  ],
  [
    "foreign body path",
    (value) => {
      value.body.path += "/PRIVATE";
    },
  ],
  [
    "extra private field",
    (value) => {
      value.body.PRIVATE = "PRIVATE";
    },
  ],
  [
    "enabled execution controls",
    (value) => {
      value.controls = 1;
    },
  ],
])
  test(`actual history never registers a probe allowance after ${name}`, async () => {
    const base = "http://127.0.0.1:5174";
    const path = "/api/v1/projects/project/copilot/rerun-intents/availability";
    const value = {
      controls: 0,
      body: {
        code: 503,
        path,
        timestamp: 1792474000,
        errMsg: "Whole-job new execution is temporarily unavailable",
      },
    };
    change(value);
    const request = {
      method: () => "GET",
      url: () => `${base}${path}`,
      isNavigationRequest: () => false,
      resourceType: () => "xhr",
    };
    const response = {
      request: () => request,
      url: request.url,
      status: () => 503,
      headerValue: async () => "private, no-store",
      json: async () => value.body,
    };
    let registered = 0;
    let detached = false;
    const page = {
      on: () => {},
      off: () => {
        detached = true;
      },
      goto: async () => {},
      getByLabel: () => ({ fill: async () => {} }),
      getByRole: (role, { name }) => {
        if (role === "region" && name === "Whole-job new executions")
          return { count: async () => value.controls };
        assert.equal(name, "Load context choices");
        return { click: async () => {} };
      },
      waitForResponse: async (predicate) => {
        assert.equal(predicate(response), true);
        return response;
      },
    };
    await assert.rejects(() =>
      runCopilotHistoryJourney({
        page,
        base,
        contract,
        profileResponse: {
          status: () => 200,
          json: async () => ({
            code: 200,
            detail: { userId: contract.actorId },
          }),
        },
        setStage: () => {},
        expectDisabledTerminalRerunResponse: () => {
          registered++;
        },
      }),
    );
    assert.equal(registered, 0);
    assert.equal(detached, true);
  });
