import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  personalInboxReadSteps,
  personalInboxResumeSteps,
  personalInboxSnapshot,
  personalInboxResponseAfterNavigation,
  validatePersonalInboxReceipt,
} from "./personal-inbox-journey.mjs";
const failed = {
  projectId: "project-1",
  pipelineId: "pipeline-1",
  runId: "run-failed",
  status: "failed",
};
const successful = { ...failed, runId: "run-success", status: "success" };
const entry = (expected, read) => ({
  id: `notice-${expected.runId}`,
  kind: "run_result",
  status: expected.status,
  occurredAt: "2026-10-18T12:00:00Z",
  deliveredAt: "2026-10-18T12:00:01Z",
  readAt: read ? "2026-10-18T12:01:00Z" : null,
  target: {
    type: "run",
    projectId: expected.projectId,
    pipelineId: expected.pipelineId,
    runId: expected.runId,
  },
  availability: "available",
});
const snapshot = (read = true) => ({
  list: [entry(failed, false), entry(successful, read)],
  nextCursor: null,
  scanIncomplete: false,
});
const receipt = () => ({
  journey: "personal-inbox-v1",
  phase: "read",
  completed: true,
  steps: [...personalInboxReadSteps],
  userId: "actor-1",
  readEntry: entry(successful, true),
  unreadEntry: entry(failed, false),
});
const options = { phase: "read", actorId: "actor-1", failed, successful };
test("exact receipt and primary snapshot match the strict backend metadata contract", () => {
  assert.deepEqual(
    personalInboxSnapshot(snapshot(), failed, successful, true),
    { readEntry: entry(successful, true), unreadEntry: entry(failed, false) },
  );
  assert.deepEqual(validatePersonalInboxReceipt(receipt(), options), receipt());
});
test("partial pages, duplicate deliveries, foreign scope and fabricated payloads fail closed", () => {
  for (const modify of [
    (value) => {
      value.scanIncomplete = true;
    },
    (value) => {
      value.nextCursor = "opaque";
    },
    (value) => {
      value.list.push(value.list[0]);
    },
    (value) => {
      value.list[1].target.projectId = "foreign";
    },
    (value) => {
      value.list[1].title = "sensitive-provider-text";
    },
    (value) => {
      value.list[1].target.url = "https://external.test";
    },
    (value) => {
      value.list[1].readAt = null;
    },
    (value) => {
      value.list[0].readAt = "2026-10-18T12:00:00Z";
    },
    (value) => {
      value.list[1].deliveredAt = "2026-10-18T12:00:00";
    },
    (value) => {
      value.list[1].deliveredAt = "2026-02-30T00:00:00Z";
    },
    (value) => {
      value.list = [];
    },
  ]) {
    const value = snapshot();
    modify(value);
    assert.throws(
      () => personalInboxSnapshot(value, failed, successful, true),
      (error) => !error.message.includes("sensitive-provider-text"),
    );
  }
});
test("resume requires exact prior requester, IDs and all persisted timestamp fields", () => {
  const previous = receipt();
  const resumed = {
    ...previous,
    phase: "resume",
    steps: [...personalInboxResumeSteps],
  };
  const resumeOptions = { ...options, phase: "resume", previous };
  assert.deepEqual(
    validatePersonalInboxReceipt(resumed, resumeOptions),
    resumed,
  );
  for (const field of ["id", "occurredAt", "deliveredAt", "readAt"]) {
    const changed = structuredClone(resumed);
    changed.readEntry[field] =
      field === "id" ? "other-id" : "2026-10-19T00:00:00Z";
    assert.throws(() => validatePersonalInboxReceipt(changed, resumeOptions));
  }
  for (const change of [
    { userId: "other-user" },
    { steps: [] },
    { extra: "secret" },
    { completed: false },
  ])
    assert.throws(() =>
      validatePersonalInboxReceipt({ ...resumed, ...change }, resumeOptions),
    );
  assert.throws(() =>
    validatePersonalInboxReceipt(resumed, {
      ...resumeOptions,
      previous: undefined,
    }),
  );
});
test("main-document navigation rejects old refresh and iframe responses", async () => {
  const page = new EventEmitter();
  const main = {};
  const iframe = {};
  page.mainFrame = () => main;
  const request = (frame = main) => ({
    frame: () => frame,
    method: () => "GET",
    url: () => "http://127.0.0.1:4173/api/v1/inbox?filter=all&limit=20",
  });
  const response = (req) => ({
    request: () => req,
    url: req.url,
    status: () => 200,
    headerValue: async () => "no-store",
    json: async () => ({ code: 200, detail: snapshot() }),
  });
  let predicate;
  let resolve;
  page.waitForResponse = (callback) => {
    predicate = callback;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const result = await personalInboxResponseAfterNavigation(
    page,
    "http://127.0.0.1:4173",
    async () => {
      const stale = request();
      page.emit("request", stale);
      assert.equal(predicate(response(stale)), false);
      page.emit("framenavigated", iframe);
      const child = request(iframe);
      page.emit("request", child);
      assert.equal(predicate(response(child)), false);
      page.emit("framenavigated", main);
      const fresh = request();
      page.emit("request", fresh);
      assert.equal(predicate(response(stale)), false);
      assert.equal(predicate(response(fresh)), true);
      resolve(response(fresh));
    },
  );
  assert.deepEqual(result, snapshot());
  assert.equal(page.listenerCount("request"), 0);
  assert.equal(page.listenerCount("framenavigated"), 0);
});
test("navigation failure propagates and removes observers without returning evidence", async () => {
  const page = new EventEmitter();
  page.mainFrame = () => ({});
  page.waitForResponse = () => new Promise(() => {});
  await assert.rejects(
    personalInboxResponseAfterNavigation(
      page,
      "http://127.0.0.1:4173",
      async () => {
        throw new Error("Synthetic navigation failure");
      },
    ),
    /Synthetic navigation failure/,
  );
  assert.equal(page.listenerCount("request"), 0);
  assert.equal(page.listenerCount("framenavigated"), 0);
});

test("personal Inbox allows actual zero/unread counts and explicit read controls but rejects fabricated/action content", async () => {
  const { assertPersonalInboxContent } =
    await import("./ui-honesty-journey.mjs");
  const scope = (text, buttons) => ({
    innerText: async () => text,
    getByRole: (_role, { name }) => ({
      count: async () => buttons.filter((button) => name.test(button)).length,
    }),
  });
  await assertPersonalInboxContent(
    scope("Personal inbox 0 unread No items in this inbox yet.", [
      "Refresh",
      "All",
      "Unread",
    ]),
  );
  await assertPersonalInboxContent(
    scope("Personal inbox 1 unread Run succeeded Unread success", [
      "Refresh",
      "Mark read",
    ]),
  );
  await assertPersonalInboxContent(
    scope("Personal inbox 99+ unread At least 3 unread", ["Mark read"]),
  );
  await assert.rejects(assertPersonalInboxContent(scope("STRIPE_SECRET", [])));
  await assert.rejects(
    assertPersonalInboxContent(scope("0 unread", ["Approve"])),
  );
  await assert.rejects(
    assertPersonalInboxContent(scope("0 unread", ["Mark all read"])),
  );
});

test("personal shell waits for the actual count body rather than passing against pre-fetch placeholders", async () => {
  const { assertPersonalInboxShell } = await import("./ui-honesty-journey.mjs");
  const page = new EventEmitter();
  const frame = {};
  const waiters = [];
  const labels = [];
  page.url = () => "http://127.0.0.1:4173/inbox";
  page.mainFrame = () => frame;
  page.waitForResponse = (predicate) =>
    new Promise((resolve) => waiters.push({ predicate, resolve }));
  let deliverCount;
  const count = new Promise((resolve) => {
    deliverCount = resolve;
  });
  page.getByRole = (role, options) => ({
    waitFor: async () => {},
    count: async () => 0,
    click: async () => {
      assert.equal(role, "button");
      assert.equal(options.name, "Refresh");
      for (const path of ["/api/v1/inbox", "/api/v1/inbox/unread-count"]) {
        const request = {
          method: () => "GET",
          frame: () => frame,
          url: () => `http://127.0.0.1:4173${path}`,
        };
        const response = {
          request: () => request,
          url: request.url,
          status: () => 200,
          json: async () => ({
            code: 200,
            detail: path.endsWith("unread-count")
              ? await count
              : { list: [], nextCursor: null, scanIncomplete: false },
          }),
        };
        page.emit("request", request);
        for (const waiter of waiters)
          if (waiter.predicate(response)) waiter.resolve(response);
      }
    },
  });
  page.getByText = (text) => ({
    waitFor: async () => {
      labels.push(text);
    },
  });
  page.waitForFunction = async (_check, expected) => {
    assert.deepEqual(expected, []);
  };
  page.locator = () => ({
    innerText: async () => "Personal inbox 0 unread",
    getByRole: () => ({ count: async () => 0 }),
  });
  let finished = false;
  const pending = assertPersonalInboxShell(page).then(() => {
    finished = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  assert.equal(labels.includes("0 unread"), false);
  deliverCount({ count: 0, capped: false, incomplete: false });
  await pending;
  assert.equal(labels.includes("0 unread"), true);
  assert.equal(page.listenerCount("request"), 0);
});

test("run-visible proof rejects mislabeled terminal outcomes and occurrence times", async () => {
  const { assertPersonalInboxRunVisible } =
    await import("./personal-inbox-journey.mjs");
  const item = entry(failed, false);
  const pageFor = (title, timestamp) => ({
    locator: () => ({
      waitFor: async () => {},
      count: async () => 1,
      getByRole: (role, { name }) => ({
        count: async () => (role === "heading" ? Number(name === title) : 1),
        getAttribute: async () =>
          "/projects/project-1/pipelines?pipeline=pipeline-1&run=run-failed",
      }),
      locator: () => ({
        waitFor: async () => {},
        count: async () => 1,
        getAttribute: async () => timestamp,
      }),
    }),
  });
  await assertPersonalInboxRunVisible(
    pageFor("Run failed", item.occurredAt),
    item,
    false,
  );
  await assert.rejects(
    assertPersonalInboxRunVisible(
      pageFor("Run succeeded", item.occurredAt),
      item,
      false,
    ),
    /terminal outcome/,
  );
  await assert.rejects(
    assertPersonalInboxRunVisible(
      pageFor("Run failed", "2026-10-19T00:00:00Z"),
      item,
      false,
    ),
    /occurrence timestamp/,
  );
});
