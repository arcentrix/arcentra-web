/** Owned-child readiness and cleanup only; no HTTP request precedes a verified listen witness. */
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

export function observeManagedFrontend(child, { host, port, timeoutMs }) {
  assert.equal(host, "127.0.0.1");
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000);
  let resolveReady,
    rejectReady,
    rejectFailure,
    timer,
    witnessed = false,
    failure;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const failed = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  void ready.catch(() => {});
  void failed.catch(() => {});
  const fail = (message) => {
    failure ??= new Error(message);
    clearTimeout(timer);
    rejectReady(failure);
    rejectFailure(failure);
  };
  const alive = () =>
    Number.isInteger(child.pid) &&
    child.pid > 0 &&
    child.exitCode === null &&
    child.signalCode === null &&
    child.connected === true;
  const onMessage = (message) => {
    if (witnessed) {
      fail("Managed frontend emitted a duplicate listening witness");
      return;
    }
    const valid =
      message &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      Object.keys(message).sort().join(",") === "host,pid,port,type" &&
      message.type === "arcentra-vite-listening-v1" &&
      message.pid === child.pid &&
      message.host === host &&
      message.port === port &&
      alive();
    if (!valid) {
      fail(
        "Managed frontend listening witness does not match the owned child and exact origin",
      );
      return;
    }
    witnessed = true;
    clearTimeout(timer);
    resolveReady();
  };
  const onError = () => fail("Managed frontend child failed");
  const onExit = () => fail("Managed frontend child exited before cleanup");
  const onDisconnect = () =>
    fail("Managed frontend child IPC disconnected before cleanup");
  child.on("message", onMessage);
  child.on("error", onError);
  child.on("exit", onExit);
  child.on("disconnect", onDisconnect);
  timer = setTimeout(
    () =>
      fail(
        "Managed frontend did not attest listening within the startup deadline",
      ),
    timeoutMs,
  );
  if (!alive()) fail("Managed frontend child is not alive with owned IPC");
  return {
    ready,
    failed,
    get witnessed() {
      return witnessed;
    },
    assertAlive() {
      if (failure) throw failure;
      assert.ok(
        witnessed && alive(),
        "Managed frontend must remain the live witnessed child",
      );
    },
    dispose() {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
      child.off("disconnect", onDisconnect);
    },
  };
}

export function spawnManagedFrontend({
  host,
  port,
  timeoutMs,
  env,
  cwd = process.cwd(),
}) {
  assert.equal(host, "127.0.0.1");
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000);
  const child = fork(
    fileURLToPath(new URL("./managed-vite-server.mjs", import.meta.url)),
    [host, String(port)],
    {
      cwd,
      env,
      execArgv: [],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  const observation = observeManagedFrontend(child, { host, port, timeoutMs });
  return { child, observation };
}

export async function stopManagedFrontend(child, observation) {
  observation.dispose();
  if (child.exitCode !== null || child.signalCode !== null) return;
  const wait = (milliseconds) =>
    new Promise((resolve) => {
      let timer;
      const done = () => {
        clearTimeout(timer);
        child.off("exit", done);
        resolve(true);
      };
      child.once("exit", done);
      timer = setTimeout(() => {
        child.off("exit", done);
        resolve(false);
      }, milliseconds);
      if (child.exitCode !== null || child.signalCode !== null) done();
    });
  const graceful = wait(3000);
  child.kill("SIGTERM");
  if (await graceful) return;
  const forced = wait(1000);
  child.kill("SIGKILL");
  assert.equal(
    await forced,
    true,
    "Owned managed frontend cleanup did not join",
  );
}

/** Strict startup consumes the original phase budget; it never resets the browser deadline. */
export function remainingManagedBrowserBudget(
  timeoutMs,
  startedAt,
  now = Date.now(),
) {
  assert.ok(
    Number.isSafeInteger(timeoutMs) &&
      timeoutMs > 0 &&
      Number.isFinite(startedAt) &&
      Number.isFinite(now),
  );
  const remaining = timeoutMs - Math.max(0, now - startedAt);
  assert.ok(
    remaining > 0,
    "Managed frontend startup exhausted the original browser phase budget",
  );
  return remaining;
}
