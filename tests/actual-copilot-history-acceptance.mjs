/** Two-phase real Control + disposable MySQL history acceptance. No API or session fixtures. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { actualBackendConfig, runBrowserTest } from "./browser-harness.mjs";
import { observeInboxLogin } from "./inbox-auth-guard.mjs";
import {
  runCopilotHistoryJourney,
  validateCopilotHistoryContract,
} from "./copilot-history-journey.mjs";
const config = actualBackendConfig();
assert.equal(process.env.ARCENTRA_REAL_STACK, "1");
const raw = process.env.ARCENTRA_COPILOT_HISTORY_CONTRACT;
assert.ok(
  typeof raw === "string" && Buffer.byteLength(raw) <= 16384,
  "A bounded actual history contract is required",
);
const contract = validateCopilotHistoryContract(JSON.parse(raw));
let receipt;
let outputDirectory;
await runBrowserTest(
  "actual-backend",
  async ({
    page,
    base,
    output,
    setStage,
    setSensitiveFormOpen,
    protectSensitiveValue,
    expectDisabledTerminalRerunResponse,
  }) => {
    outputDirectory = output;
    setStage("login");
    await page.goto(`${base}/login`);
    await page.getByRole("heading", { name: "Welcome back" }).waitFor();
    setSensitiveFormOpen(true);
    await page
      .getByRole("textbox", { name: "Email / Username" })
      .fill(config.username);
    await page.getByLabel("Password", { exact: true }).fill(config.password);
    const responseFor = (method, path) =>
      page.waitForResponse(
        (response) =>
          response.request().method() === method &&
          new URL(response.url()).pathname === `/api/v1${path}`,
      );
    const loginResponse = responseFor("POST", "/users/login");
    const profileResponse = responseFor("GET", "/users/fetch");
    profileResponse.catch(() => {});
    await observeInboxLogin(
      page,
      async () => {
        await page.getByRole("button", { name: "Login", exact: true }).click();
        const login = await loginResponse;
        assert.equal(login.status(), 200);
        return login.json();
      },
      (value) => {
        protectSensitiveValue(value);
      },
    );
    await page.waitForURL((url) => url.pathname !== "/login");
    // Keep screenshots disabled: synthetic model output deliberately contains a
    // secret canary whose plaintext must never become a failure artifact.
    setSensitiveFormOpen(true);
    receipt = await runCopilotHistoryJourney({
      page,
      base,
      contract,
      profileResponse: await profileResponse,
      setStage,
      // The disposable history fixture enables model/history only, never the
      // independent terminal-rerun capability. Every load must prove default-off.
      expectDisabledTerminalRerunResponse,
    });
    // Hash-only receipts and strict diagnostics are the evidence. No success or
    // failure screenshot may capture a redaction failure before backend checks.
    setStage("journey-complete");
  },
  {
    backend: config.backend,
    totalTimeoutMs: 180000,
    sensitiveValues: [config.password],
  },
);
// Publish no receipt until strict browser/network diagnostics and teardown succeed.
assert.ok(receipt && outputDirectory);
await writeFile(
  `${outputDirectory}/copilot-history-receipt.json`,
  `${JSON.stringify(receipt)}\n`,
  { mode: 0o600, flag: "wx" },
);
