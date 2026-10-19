import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { observeInboxLogin } from "./inbox-auth-guard.mjs";
const envelope = () => ({
  code: 200,
  detail: {
    token: {
      accessToken: "synthetic-access",
      refreshToken: "synthetic-refresh",
    },
  },
});
test("actual login guards both tokens before any later observations", async () => {
  const page = new EventEmitter();
  const protectedValues = [];
  await observeInboxLogin(
    page,
    async () => envelope(),
    (value) => protectedValues.push(value),
  );
  assert.deepEqual(protectedValues, ["synthetic-access", "synthetic-refresh"]);
  assert.equal(page.listenerCount("console"), 0);
});
test("pre-registration console objects fail even without retained raw arguments", async () => {
  const page = new EventEmitter();
  const protectedValues = [];
  await assert.rejects(
    observeInboxLogin(
      page,
      async () => {
        page.emit("console", { object: "synthetic-access" });
        return envelope();
      },
      (value) => protectedValues.push(value),
    ),
    /must not emit console/,
  );
  assert.deepEqual(protectedValues, ["synthetic-access", "synthetic-refresh"]);
  assert.equal(page.listenerCount("console"), 0);
});
test("bad or failed token responses cannot bypass guards and leave no listener", async () => {
  for (const body of [
    { code: 500 },
    { code: 200, detail: { token: { accessToken: "", refreshToken: "x" } } },
  ]) {
    const page = new EventEmitter();
    await assert.rejects(
      observeInboxLogin(
        page,
        async () => body,
        () => {},
      ),
    );
    assert.equal(page.listenerCount("console"), 0);
  }
  const page = new EventEmitter();
  await assert.rejects(
    observeInboxLogin(
      page,
      async () => {
        throw new Error("transport failed");
      },
      () => {},
    ),
  );
  assert.equal(page.listenerCount("console"), 0);
});
