/** Existing disposable container lane: real login/UI → durable vote → actual retry. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { runBrowserTest } from "./browser-harness.mjs";
import { observeInboxLogin } from "./inbox-auth-guard.mjs";
import {
  validateExecutionBrowserContract,
  runExecutionBrowserJourney,
} from "./copilot-execution-journey.mjs";
assert.equal(process.env.ARCENTRA_COPILOT_EXECUTION_BROWSER, "1");
assert.equal(process.env.ARCENTRA_REQUIRE_COPILOT_EXECUTION_BROWSER, "1");
assert.equal(process.env.ARCENTRA_REAL_STACK, "1");
const raw = process.env.ARCENTRA_COPILOT_EXECUTION_CONTRACT;
assert.ok(raw && Buffer.byteLength(raw) <= 16384);
const contract = validateExecutionBrowserContract(JSON.parse(raw));
const backend = new URL(process.env.ARCENTRA_ACCEPTANCE_BACKEND_URL);
assert.equal(backend.protocol, "http:");
assert.equal(backend.hostname, "127.0.0.1");
assert.equal(backend.pathname, "/");
assert.equal(backend.search, "");
assert.equal(backend.username, "");
const username = process.env.ARCENTRA_ACCEPTANCE_USERNAME;
const password = process.env.ARCENTRA_ACCEPTANCE_PASSWORD;
assert.equal(username, contract.actorId);
assert.match(password, /^synthetic-browser-[A-Za-z0-9_-]+$/);
let receipt, outputDirectory;
await runBrowserTest(
  "actual-backend",
  async ({
    page,
    base,
    output,
    setStage,
    setSensitiveFormOpen,
    protectSensitiveValue,
    expectHttpErrorOnce,
  }) => {
    outputDirectory = output;
    setStage("login");
    setSensitiveFormOpen(true);
    await page.goto(`${base}/login`);
    await page
      .getByRole("textbox", { name: "Email / Username" })
      .fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const responseFor = (method, path) =>
      page.waitForResponse(
        (r) =>
          r.request().method() === method &&
          new URL(r.url()).pathname === `/api/v1${path}`,
      );
    const login = responseFor("POST", "/users/login"),
      profile = responseFor("GET", "/users/fetch");
    profile.catch(() => {});
    await observeInboxLogin(
      page,
      async () => {
        await page.getByRole("button", { name: "Login", exact: true }).click();
        const response = await login;
        assert.equal(response.status(), 200);
        return response.json();
      },
      protectSensitiveValue,
    );
    const identity = await profile;
    assert.equal(identity.status(), 200);
    assert.equal((await identity.json()).detail.userId, contract.actorId);
    await page.waitForURL((url) => url.pathname !== "/login");
    // Keep screenshots disabled; upload only the credential-free receipt/summary.
    receipt = await runExecutionBrowserJourney({
      page,
      base,
      contract,
      setStage,
      expectHttpErrorOnce,
    });
    setStage("journey-complete");
  },
  {
    backend: backend.origin,
    totalTimeoutMs: 45000,
    sensitiveValues: [password],
  },
);
assert.ok(receipt && outputDirectory);
await writeFile(
  `${outputDirectory}/copilot-execution-receipt.json`,
  `${JSON.stringify(receipt)}\n`,
  { mode: 0o600, flag: "wx" },
);
