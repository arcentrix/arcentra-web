import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter, once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  remainingManagedBrowserBudget,
  observeManagedFrontend,
  spawnManagedFrontend,
  stopManagedFrontend,
} from "./managed-frontend.mjs";

const settings = { host: "127.0.0.1", port: 5174, timeoutMs: 1000 };
function child() {
  return Object.assign(new EventEmitter(), {
    pid: 1234,
    exitCode: null,
    signalCode: null,
    connected: true,
  });
}
const witness = () => ({
  type: "arcentra-vite-listening-v1",
  pid: 1234,
  host: "127.0.0.1",
  port: 5174,
});
test("no readiness HTTP fetch before owned child attests exact actual listener", async () => {
  const process = child(),
    state = observeManagedFrontend(process, settings);
  let fetches = 0;
  const next = state.ready.then(() => {
    state.assertAlive();
    fetches++;
  });
  await Promise.resolve();
  assert.equal(fetches, 0);
  process.emit("message", witness());
  await next;
  assert.equal(fetches, 1);
  assert.equal(state.witnessed, true);
  state.dispose();
});
for (const [key, value] of [
  ["pid", 1],
  ["host", "localhost"],
  ["host", "0.0.0.0"],
  ["port", 5175],
  ["port", "5174"],
  ["type", "ready"],
  ["unexpected", true],
])
  test(`mismatched listening witness blocks first fetch: ${key} ${value}`, async () => {
    const process = child(),
      state = observeManagedFrontend(process, settings);
    let fetches = 0;
    const next = state.ready.then(() => {
      fetches++;
    });
    process.emit("message", { ...witness(), [key]: value });
    await assert.rejects(next, /listening witness/);
    assert.equal(fetches, 0);
    state.dispose();
  });
for (const message of [
  null,
  [],
  "ready",
  { type: "arcentra-vite-listening-v1" },
])
  test(`malformed listening witness is rejected: ${JSON.stringify(message)}`, async () => {
    const process = child(),
      state = observeManagedFrontend(process, settings);
    process.emit("message", message);
    await assert.rejects(state.ready, /listening witness/);
    state.dispose();
  });
for (const event of ["error", "exit", "disconnect"])
  test(`child ${event} before listen blocks first fetch`, async () => {
    const process = child(),
      state = observeManagedFrontend(process, settings);
    let fetches = 0;
    const next = state.ready.then(() => {
      fetches++;
    });
    process.emit(event, new Error("PRIVATE_STARTUP_ERROR"));
    await assert.rejects(
      next,
      (error) => !String(error).includes("PRIVATE_STARTUP_ERROR"),
    );
    assert.equal(fetches, 0);
    state.dispose();
  });
test("stalled child times out without HTTP readiness or external fallback", async () => {
  const process = child(),
    state = observeManagedFrontend(process, { ...settings, timeoutMs: 5 });
  let fetches = 0;
  await assert.rejects(
    state.ready.then(() => {
      fetches++;
    }),
    /startup deadline/,
  );
  assert.equal(fetches, 0);
  assert.equal(state.witnessed, false);
  state.dispose();
});
test("exit after witnessed listen interrupts the active journey", async () => {
  const process = child(),
    state = observeManagedFrontend(process, settings);
  process.emit("message", witness());
  await state.ready;
  process.exitCode = 1;
  process.connected = false;
  process.emit("exit", 1);
  await assert.rejects(state.failed, /exited before cleanup/);
  assert.throws(() => state.assertAlive());
  state.dispose();
});
test("duplicate child witness fails instead of replacing identity", async () => {
  const process = child(),
    state = observeManagedFrontend(process, settings);
  process.emit("message", witness());
  await state.ready;
  process.emit("message", witness());
  await assert.rejects(state.failed, /duplicate/);
  state.dispose();
});
test("witness from already dead child is insufficient", async () => {
  const process = child();
  process.exitCode = 1;
  const state = observeManagedFrontend(process, settings);
  await assert.rejects(state.ready, /not alive/);
  state.dispose();
});
test("owned child cleanup joins without treating its expected exit as journey failure", async () => {
  const process = child(),
    state = observeManagedFrontend(process, settings);
  process.emit("message", witness());
  await state.ready;
  const signals = [];
  process.kill = (signal) => {
    signals.push(signal);
    setImmediate(() => {
      process.exitCode = 0;
      process.emit("exit", 0);
    });
    return true;
  };
  await stopManagedFrontend(process, state);
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.equal(process.listenerCount("message"), 0);
  assert.equal(process.listenerCount("exit"), 0);
});

test("actual occupied loopback port refuses child witness before any HTTP readiness fetch", async () => {
  const root = await mkdtemp(join(tmpdir(), "arcentra-managed-vite-"));
  const foreign = createServer();
  foreign.listen(0, "127.0.0.1");
  await once(foreign, "listening");
  const port = foreign.address().port;
  let managed;
  try {
    managed = spawnManagedFrontend({
      host: "127.0.0.1",
      port,
      timeoutMs: 10_000,
      cwd: root,
      env: { PATH: process.env.PATH },
    });
    managed.child.stdout.resume();
    managed.child.stderr.resume();
    let fetches = 0;
    await assert.rejects(
      managed.observation.ready.then(() => {
        fetches++;
      }),
      /exited|disconnected|failed/,
    );
    assert.equal(fetches, 0);
    assert.equal(managed.observation.witnessed, false);
    assert.equal(foreign.listening, true, "Never stop an unrelated listener");
  } finally {
    if (managed) await stopManagedFrontend(managed.child, managed.observation);
    await new Promise((resolve) => foreign.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
test("actual Vite API listener attests its owned PID/origin and joins on cleanup without a browser", async () => {
  const root = await mkdtemp(join(tmpdir(), "arcentra-managed-vite-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  await writeFile(
    join(root, "index.html"),
    "<!doctype html><title>owned synthetic Vite</title>",
  );
  let managed;
  try {
    managed = spawnManagedFrontend({
      host: "127.0.0.1",
      port,
      timeoutMs: 10_000,
      cwd: root,
      env: { PATH: process.env.PATH },
    });
    managed.child.stdout.resume();
    managed.child.stderr.resume();
    await managed.observation.ready;
    managed.observation.assertAlive();
    assert.equal(managed.observation.witnessed, true);
  } finally {
    if (managed) await stopManagedFrontend(managed.child, managed.observation);
    await rm(root, { recursive: true, force: true });
  }
});

test("managed startup consumes the existing phase budget rather than resetting it", () => {
  assert.equal(remainingManagedBrowserBudget(45_000, 1000, 11_000), 35_000);
  assert.throws(
    () => remainingManagedBrowserBudget(45_000, 1000, 46_000),
    /exhausted/,
  );
  assert.throws(
    () => remainingManagedBrowserBudget(45_000, 1000, 46_001),
    /exhausted/,
  );
});
