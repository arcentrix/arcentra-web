/** Parse only explicit disposable-fixture inputs. Never creates a browser or performs I/O. */
import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import {
  validateOutcomeContract,
  validateOwnerOutcomeContract,
  validatePreparationScope,
} from "./copilot-rerun-outcome-contract.mjs";

export function readEntryContract(env, cwd, now = Date.now()) {
  for (const name of [
    "ARCENTRA_COPILOT_EXECUTION_BROWSER",
    "ARCENTRA_REQUIRE_COPILOT_EXECUTION_BROWSER",
    "ARCENTRA_REAL_STACK",
  ])
    assert.equal(env[name], "1", `Explicit ${name}=1 required`);
  assert.ok(
    !Object.hasOwn(env, "UI_TEST_BASE_URL"),
    "UI_TEST_BASE_URL overrides are forbidden; serve the pinned checkout with managed Vite",
  );
  assert.ok(
    ["prepare", "outcome", "owner-outcome"].includes(
      env.ARCENTRA_COPILOT_RERUN_PHASE,
    ),
    "Explicit rerun phase required",
  );
  assert.ok(
    typeof env.ARCENTRA_COPILOT_BROWSER_CWD === "string" &&
      isAbsolute(env.ARCENTRA_COPILOT_BROWSER_CWD),
  );
  assert.equal(
    resolve(env.ARCENTRA_COPILOT_BROWSER_CWD),
    resolve(cwd),
    "Run from the pinned frontend checkout",
  );
  const expectedFrontendCommit = env.ARCENTRA_COPILOT_BROWSER_FRONTEND_COMMIT;
  assert.ok(
    typeof expectedFrontendCommit === "string" &&
      /^[a-f0-9]{40}$/.test(expectedFrontendCommit),
    "Trusted frontend checkout pin must be exactly 40 lowercase hex characters",
  );
  const raw = env.ARCENTRA_COPILOT_RERUN_CONTRACT;
  assert.ok(
    typeof raw === "string" && Buffer.byteLength(raw) <= 16384,
    "Bounded explicit rerun contract required",
  );
  let contract;
  try {
    contract = JSON.parse(raw);
  } catch {
    throw new Error("Invalid fixture contract JSON");
  }
  const deadline = Number(env.ARCENTRA_COPILOT_RERUN_DEADLINE_UNIX_MILLI);
  assert.ok(
    Number.isSafeInteger(deadline) && deadline > now,
    "The original Go deadline must remain live",
  );
  const phase = env.ARCENTRA_COPILOT_RERUN_PHASE;
  if (phase !== "prepare") {
    (phase === "owner-outcome"
      ? validateOwnerOutcomeContract
      : validateOutcomeContract)(contract, now);
    assert.equal(
      contract.deadlineUnixMilli,
      deadline,
      "Do not reset the parent deadline",
    );
  }
  if (phase === "prepare") validatePreparationScope(contract);
  let backend;
  try {
    backend = new URL(env.ARCENTRA_ACCEPTANCE_BACKEND_URL);
  } catch {
    throw new Error("Invalid loopback backend URL");
  }
  assert.ok(
    backend.protocol === "http:" &&
      backend.hostname === "127.0.0.1" &&
      backend.pathname === "/" &&
      backend.search === "" &&
      backend.hash === "" &&
      backend.username === "" &&
      backend.password === "",
    "Backend must be a plain loopback origin without credentials or query data",
  );
  const actorId =
    phase === "owner-outcome" ? contract.scope.actorId : contract.actorId;
  assert.ok(
    typeof actorId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(actorId),
  );
  assert.equal(
    env.ARCENTRA_ACCEPTANCE_USERNAME,
    actorId,
    "Actual login must match this phase's actor",
  );
  assert.ok(
    typeof env.ARCENTRA_ACCEPTANCE_PASSWORD === "string" &&
      /^synthetic-browser-[A-Za-z0-9_-]+$/.test(
        env.ARCENTRA_ACCEPTANCE_PASSWORD,
      ),
    "Only disposable fixture login credentials are accepted",
  );
  assert.ok(
    typeof env.UI_TEST_OUTPUT_DIR === "string" &&
      isAbsolute(env.UI_TEST_OUTPUT_DIR),
    "Private phase-specific evidence directory required",
  );
  return {
    phase,
    contract,
    deadline,
    expectedFrontendCommit,
    cwd: resolve(cwd),
    backend: backend.origin,
    actorId,
    outputDirectory: resolve(env.UI_TEST_OUTPUT_DIR),
  };
}

/** Compare independently supplied CI checkout pin with actual Git readback. */
export function assertFrontendCheckout(
  expectedCommit,
  headOutput,
  statusOutput,
) {
  assert.ok(
    typeof expectedCommit === "string" && /^[a-f0-9]{40}$/.test(expectedCommit),
    "Trusted frontend pin required",
  );
  assert.ok(
    typeof headOutput === "string" && /^[a-f0-9]{40}\n?$/.test(headOutput),
    "Exact Git HEAD readback required",
  );
  const observedCommit = headOutput.trim();
  assert.equal(
    observedCommit,
    expectedCommit,
    "Actual frontend HEAD must equal the independently supplied checkout pin",
  );
  assert.equal(statusOutput, "", "Frontend source must remain clean");
  return observedCommit;
}

/** A passing page callback alone cannot attest the managed frontend server. */
export function assertManagedFrontendSummary(summary) {
  assert.ok(summary && typeof summary === "object" && !Array.isArray(summary));
  assert.equal(summary.kind, "actual-backend");
  assert.equal(summary.status, "passed");
  for (const key of [
    "pageErrorCount",
    "secretExposureCount",
    "consoleInspectionFailureCount",
    "lateConsoleEventCount",
    "unexpectedConsoleErrorCount",
    "blockedRequestCount",
    "unhandledRouteCount",
  ])
    assert.equal(summary[key], 0, `Browser safeguard ${key} must pass`);
  const server = summary.frontendServer;
  assert.ok(server && typeof server === "object" && !Array.isArray(server));
  assert.equal(server.managed, true);
  assert.equal(server.mode, "vite-development");
  assert.equal(server.ready, true);
  assert.equal(server.listeningWitness, true);
  assert.equal(server.exitCodeBeforeCleanup, null);
  assert.equal(server.signalBeforeCleanup, null);
  return summary;
}
export function parseManagedFrontendSummary(bytes) {
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65_536,
    "Bounded harness summary required",
  );
  let summary;
  try {
    summary = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Invalid harness summary JSON");
  }
  return assertManagedFrontendSummary(summary);
}
