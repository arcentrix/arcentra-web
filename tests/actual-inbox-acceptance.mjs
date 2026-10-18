import { observeInboxLogin } from "./inbox-auth-guard.mjs";
/** Real Inbox UI on existing disposable Control; no response/session seeding. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  actualBackendConfig,
  runBrowserTest,
  safeFailureScreenshot,
} from "./browser-harness.mjs";
import { runPersonalInboxJourney } from "./personal-inbox-journey.mjs";

const config = actualBackendConfig();
assert.equal(process.env.ARCENTRA_REAL_STACK, "1");
const raw = process.env.ARCENTRA_INBOX_CONTRACT;
assert.ok(typeof raw === "string" && raw.length <= 16_384);
const contract = JSON.parse(raw);
assert.deepEqual(Object.keys(contract).sort(), [
  "actorId",
  "failed",
  "phase",
  "previous",
  "successful",
]);
assert.ok(["read", "resume"].includes(contract.phase));
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
    const captureSecrets = [config.password];
    await observeInboxLogin(
      page,
      async () => {
        await page.getByRole("button", { name: "Login", exact: true }).click();
        const login = await loginResponse;
        assert.equal(login.status(), 200);
        return login.json();
      },
      (value) => {
        captureSecrets.push(value);
        protectSensitiveValue(value);
      },
    );
    await page.waitForURL((url) => url.pathname !== "/login");
    setSensitiveFormOpen(false);
    receipt = await runPersonalInboxJourney({
      page,
      base,
      ...contract,
      profileResponse: await profileResponse,
      setStage,
    });
    assert.ok(
      await safeFailureScreenshot(page, captureSecrets),
      "Inbox screenshot must not contain authentication material",
    );
    await page.screenshot({
      path: `${output}/inbox-${contract.phase}.png`,
      fullPage: true,
    });
    setStage("journey-complete");
  },
  {
    backend: config.backend,
    totalTimeoutMs: 100_000,
    sensitiveValues: [config.password],
  },
);
// Never emit a completion receipt until console/network and browser cleanup pass.
assert.ok(receipt && outputDirectory);
await writeFile(
  `${outputDirectory}/inbox-receipt.json`,
  `${JSON.stringify(receipt)}\n`,
  { mode: 0o600, flag: "wx" },
);
