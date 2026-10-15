/** Draft-only synthetic UI checks. These do not execute a container or contact an Agent. */
import assert from "node:assert/strict";
import { isNativeOptionDisabled } from "./browser-harness.mjs";

export function containerRetryFixtures(originalText) {
  const definition = JSON.parse(originalText);
  definition.runtime = { type: "containerd-offline-v1" };
  delete definition.jobs[0].retry;
  delete definition.jobs[0].approval;
  const retry = {
    mode: "failed_step",
    maxAttempts: 2,
    delay: "1s",
    allowedExitCodes: [9],
    idempotent: true,
  };
  const exactApproval = {
    required: true,
    type: "manual",
    plugin: "builtin:retry-approval",
    params: {},
  };
  const authored = (change) => {
    const spec = structuredClone(definition);
    spec.jobs[0].retry = structuredClone(retry);
    change?.(spec.jobs[0]);
    // Deliberately keep compact authored JSON: merely opening or changing controls
    // must not even reformat it before an explicit Apply.
    return JSON.stringify(spec);
  };
  return {
    off: JSON.stringify(definition),
    supported: authored(),
    failedStepApproved: authored((job) => {
      job.approval = structuredClone(exactApproval);
    }),
    blocked: [
      {
        name: "unknown approval",
        text: authored((job) => {
          job.approval = {};
        }),
        reason: /approval/i,
      },
      ...["continueOnError", "continue_on_error"].map((key) => ({
        name: key,
        text: authored((job) => {
          job.steps[0][key] = true;
        }),
        reason: /continueOnError|continue_on_error/i,
      })),
    ],
    unsupported: authored((job) => {
      job.retry = { mode: "future_scope", futureOption: "preserve-me" };
    }),
    wholeJobApproved: authored((job) => {
      job.retry.mode = "whole_job";
      job.approval = structuredClone(exactApproval);
    }),
    wholeJobUnknownApproval: authored((job) => {
      job.retry.mode = "whole_job";
      job.approval = {};
    }),
  };
}

/** Real viewport/actionability checks; the harness unit tests only verify orchestration. */
export async function assertRetryEditorViewports({
  page,
  warning,
  apply,
  expectedWarning,
  assertUnchanged,
}) {
  const originalViewport = page.viewportSize();
  assert.ok(
    originalViewport,
    "The synthetic harness requires a fixed viewport",
  );
  try {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 1440, height: 1050 },
    ]) {
      await page.setViewportSize(viewport);
      await warning.scrollIntoViewIfNeeded();
      assert.equal(await warning.innerText(), expectedWarning);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Expanded retry editor must not overflow the ${viewport.width}px viewport horizontally`,
      );
      await apply.scrollIntoViewIfNeeded();
      // Trial mode runs ordinary actionability checks without changing the draft.
      await apply.click({ trial: true });
      await assertUnchanged();
    }
  } finally {
    await page.setViewportSize(originalViewport);
  }
}

/** Use the actual visible Definition dialog; no DOM mutation or forced clicks. */
export async function assertContainerRetryDraft({
  page,
  definition,
  assertNoSave,
}) {
  const original = await definition.inputValue();
  const fixtures = containerRetryFixtures(original);
  const editor = page.locator("details").filter({
    has: page.getByText("Retry policy · off unless explicitly configured", {
      exact: true,
    }),
  });
  await editor.locator("summary").click();
  const scope = editor.getByRole("combobox", { name: "Retry scope" });
  const apply = editor.getByRole("button", {
    name: "Apply retry policy to draft",
    exact: true,
  });
  const maximum = editor.getByRole("spinbutton", { name: "Maximum attempts" });
  const exitCodes = editor.getByRole("textbox", { name: "Retry exit codes" });
  const idempotent = editor.getByRole("checkbox");
  const optionDisabled = (mode) =>
    scope.locator(`option[value="${mode}"]`).evaluate(isNativeOptionDisabled);
  const unchanged = async (authored) => {
    assert.equal(
      await definition.inputValue(),
      authored,
      "Retry controls must preserve authored JSON until an explicit draft edit",
    );
    assertNoSave();
  };
  const load = async (authored, mode) => {
    await definition.fill(authored);
    await page.waitForFunction(
      (expected) =>
        document.querySelector('[aria-label="Retry scope"]')?.value ===
        expected,
      mode,
    );
    await unchanged(authored);
  };
  const remove = async (authored) => {
    await scope.selectOption("off");
    await unchanged(authored);
    assert.equal(await apply.isEnabled(), true);
    await apply.click();
    const expected = JSON.parse(authored);
    delete expected.jobs[0].retry;
    assert.deepEqual(JSON.parse(await definition.inputValue()), expected);
    assertNoSave();
  };

  await load(fixtures.off, "off");
  assert.equal(await optionDisabled("failed_step"), false);
  const availability = await editor
    .getByText(/allowFailedStepRetry/)
    .innerText();
  assert.match(availability, /both Control and Agent/);
  assert.match(availability, /Each defaults off/);
  assert.match(availability, /editing this draft does not enable it/);
  await scope.selectOption("failed_step");
  await unchanged(fixtures.off);
  const note = await editor.getByRole("note").innerText();
  for (const warning of [
    /Earlier successful steps are preserved/i,
    /partial writes/i,
    /one continuously live session/i,
    /No rollback/i,
    /Background processes are not guaranteed to survive/i,
    /live or zombie descendants/i,
  ])
    assert.match(note, warning);
  await editor.getByText(/No automatic resume after restart/i).waitFor();
  await apply.click();
  await editor
    .getByRole("alert")
    .filter({ hasText: /Confirm idempotency/ })
    .waitFor();
  await unchanged(fixtures.off);
  await exitCodes.fill("9, 75");
  await apply.click();
  await unchanged(fixtures.off);
  await idempotent.check();
  await exitCodes.fill("");
  await apply.click();
  await unchanged(fixtures.off);
  await exitCodes.fill("9, 75");
  await maximum.fill("1");
  await apply.click();
  await editor
    .getByRole("alert")
    .filter({ hasText: /2–5 attempts/ })
    .waitFor();
  await unchanged(fixtures.off);
  await maximum.fill("6");
  await apply.click();
  await unchanged(fixtures.off);
  await maximum.fill("2");
  await exitCodes.fill("0");
  await apply.click();
  await editor
    .getByRole("alert")
    .filter({ hasText: /exit codes from 1 to 125/ })
    .waitFor();
  await unchanged(fixtures.off);
  await exitCodes.fill("9, 9");
  await apply.click();
  await unchanged(fixtures.off);
  await exitCodes.fill("9, 75");
  await unchanged(fixtures.off);
  assert.equal(await apply.isEnabled(), true);
  await apply.click();
  const expected = JSON.parse(fixtures.off);
  expected.jobs[0].retry = {
    mode: "failed_step",
    maxAttempts: 2,
    delay: "1s",
    allowedExitCodes: [9, 75],
    idempotent: true,
  };
  assert.deepEqual(JSON.parse(await definition.inputValue()), expected);
  assertNoSave();
  const appliedDraft = await definition.inputValue();
  await assertRetryEditorViewports({
    page,
    warning: editor.getByRole("note"),
    apply,
    expectedWarning: note,
    assertUnchanged: () => unchanged(appliedDraft),
  });
  await remove(await definition.inputValue());

  await load(fixtures.supported, "failed_step");
  assert.equal(await optionDisabled("failed_step"), false);
  assert.equal(await apply.isEnabled(), true);
  // Selecting another scope alone cannot normalize or replace the loaded policy.
  await scope.selectOption("whole_job");
  assert.match(
    await editor.getByRole("note").innerText(),
    /fresh session, rootfs, and workspace, with the pinned source SHA and input artifacts/,
  );
  await unchanged(fixtures.supported);
  await scope.selectOption("failed_step");
  await maximum.fill("5");
  await unchanged(fixtures.supported);
  await apply.click();
  const maximumPolicy = JSON.parse(fixtures.supported);
  maximumPolicy.jobs[0].retry.maxAttempts = 5;
  assert.deepEqual(JSON.parse(await definition.inputValue()), maximumPolicy);
  assertNoSave();

  for (const fixture of fixtures.blocked) {
    await load(fixture.text, "failed_step");
    assert.equal(await optionDisabled("failed_step"), true, fixture.name);
    assert.equal(await apply.isDisabled(), true, fixture.name);
    assert.match(
      await editor.getByRole("alert").innerText(),
      fixture.reason,
      fixture.name,
    );
    await unchanged(fixture.text);
    await remove(fixture.text);
  }

  await load(fixtures.unsupported, "unsupported");
  assert.equal(await optionDisabled("unsupported"), true);
  assert.equal(await apply.isDisabled(), true);
  assert.match(
    await editor.getByRole("alert").innerText(),
    /Unsupported authored retry policy/i,
  );
  await scope.selectOption("failed_step");
  await unchanged(fixtures.unsupported);
  await remove(fixtures.unsupported);

  await load(fixtures.wholeJobUnknownApproval, "whole_job");
  assert.equal(await optionDisabled("whole_job"), true);
  assert.equal(await apply.isDisabled(), true);
  assert.match(
    await editor.getByRole("alert").innerText(),
    /exact manual builtin:retry-approval/i,
  );
  await unchanged(fixtures.wholeJobUnknownApproval);
  await remove(fixtures.wholeJobUnknownApproval);

  await load(fixtures.failedStepApproved, "failed_step");
  assert.equal(await optionDisabled("failed_step"), false);
  await editor.getByText(/allowFailedStepRetryApproval/).waitFor();
  await maximum.fill("3");
  await unchanged(fixtures.failedStepApproved);
  await apply.click();
  const approvedStepDraft = JSON.parse(fixtures.failedStepApproved);
  approvedStepDraft.jobs[0].retry.maxAttempts = 3;
  assert.deepEqual(
    JSON.parse(await definition.inputValue()),
    approvedStepDraft,
  );
  assertNoSave();

  await load(fixtures.wholeJobApproved, "whole_job");
  assert.equal(await optionDisabled("whole_job"), false);
  assert.equal(await optionDisabled("failed_step"), false);
  assert.equal(await apply.isEnabled(), true);
  await editor.getByText(/allowWholeJobRetryApproval/).waitFor();
  await apply.click();
  assert.deepEqual(
    JSON.parse(await definition.inputValue()),
    JSON.parse(fixtures.wholeJobApproved),
  );
  assertNoSave();
  await remove(await definition.inputValue());

  await definition.fill(original);
  await editor.locator("summary").click();
  await unchanged(original);
}
