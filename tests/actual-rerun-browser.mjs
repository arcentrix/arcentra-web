/** Inert unless all explicit fixture opt-ins, private phase input and pinned checkout are present. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { open, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  assertFrontendCheckout,
  parseManagedFrontendSummary,
  readEntryContract,
} from "./copilot-rerun-entry-contract.mjs";
import {
  remaining,
  runRerunBrowserOutcome,
} from "./copilot-rerun-outcome-journey.mjs";

const input = readEntryContract(process.env, process.cwd());
const git = promisify(execFile);
async function verifyFrontend() {
  const options = () => ({
    cwd: input.cwd,
    timeout: Math.min(2000, remaining(input.deadline)),
    maxBuffer: 16_384,
  });
  const head = await git("git", ["rev-parse", "HEAD"], options());
  const status = await git(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    options(),
  );
  return assertFrontendCheckout(
    input.expectedFrontendCommit,
    head.stdout,
    status.stdout,
  );
}
const frontendCommit = await verifyFrontend();
const load = (file) => import(pathToFileURL(`${input.cwd}/tests/${file}`).href);
const [{ runBrowserTest }, { observeInboxLogin }, preparation, controls] =
  await Promise.all([
    load("browser-harness.mjs"),
    load("inbox-auth-guard.mjs"),
    load("copilot-rerun-journey.mjs"),
    load("artifact-controls.mjs"),
  ]);
if (input.phase === "prepare")
  preparation.validateRerunBrowserContract(input.contract);
const password = process.env.ARCENTRA_ACCEPTANCE_PASSWORD;
let receipt;
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
    assert.equal(
      output,
      input.outputDirectory,
      "Evidence must stay in this phase's private directory",
    );
    setStage("login");
    setSensitiveFormOpen(true); // No screenshots of authenticated/protected fixture state.
    page.setDefaultTimeout(Math.min(10_000, remaining(input.deadline)));
    await page.goto(`${base}/login`);
    await page
      .getByRole("textbox", { name: "Email / Username" })
      .fill(input.actorId);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const responseFor = (method, path) => {
      const promise = page.waitForResponse(
        (response) =>
          response.request().method() === method &&
          new URL(response.url()).pathname === `/api/v1${path}`,
        { timeout: Math.min(10_000, remaining(input.deadline)) },
      );
      void promise.catch(() => {});
      return promise;
    };
    const login = responseFor("POST", "/users/login");
    const profile = responseFor("GET", "/users/fetch");
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
    const user = await profile;
    assert.equal(user.status(), 200);
    const value = await user.json();
    assert.equal(value.code, 200);
    assert.equal(value.detail.userId, input.actorId);
    await page.waitForURL((url) => url.pathname !== "/login");
    remaining(input.deadline);
    let observed;
    if (input.phase === "prepare") {
      observed = await preparation.runRerunBrowserPreparation({
        page,
        base,
        contract: input.contract,
        deadline: input.deadline,
        setStage,
      });
    } else {
      if (input.phase === "owner-outcome")
        setStage("copilot-rerun-owner-outcome");
      else setStage("copilot-rerun-outcome");
      observed = await runRerunBrowserOutcome({
        page,
        base,
        contract: input.contract,
        ownerOnly: input.phase === "owner-outcome",
        ...controls,
      });
    }
    remaining(input.deadline);
    assert.equal(observed.runtimeAcceptanceComplete, false);
    receipt = { ...observed, frontendCommit };
    setStage("journey-complete");
  },
  {
    backend: input.backend,
    requireManagedFrontend: true,
    totalTimeoutMs: Math.min(45_000, remaining(input.deadline)),
    sensitiveValues: [password],
  },
);
remaining(input.deadline);
assert.ok(receipt);
assert.equal(
  await verifyFrontend(),
  receipt.frontendCommit,
  "Frontend provenance must remain unchanged throughout the journey",
);
// Read at most one byte beyond the 64 KiB bound from the same opened file.
const summaryFile = await open(`${input.outputDirectory}/summary.json`, "r");
try {
  const info = await summaryFile.stat();
  assert.ok(
    info.isFile() && info.size > 0 && info.size <= 65_536,
    "Bounded regular harness summary required",
  );
  const bytes = Buffer.alloc(65_537);
  let count = 0;
  while (count < bytes.length) {
    const { bytesRead } = await summaryFile.read(
      bytes,
      count,
      bytes.length - count,
      count,
    );
    if (bytesRead === 0) break;
    count += bytesRead;
  }
  parseManagedFrontendSummary(bytes.subarray(0, count));
} finally {
  await summaryFile.close();
}
remaining(input.deadline);
const encoded = `${JSON.stringify(receipt)}\n`;
assert.ok(
  Buffer.byteLength(encoded) <= 16_384,
  "Bounded phase receipt required",
);
await writeFile(
  `${input.outputDirectory}/copilot-rerun-${input.phase === "prepare" ? "preparation" : input.phase}-receipt.json`,
  encoded,
  { mode: 0o600, flag: "wx" },
);
