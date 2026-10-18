/** Scoped, write-only secret management against synthetic fixture or actual Control APIs. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";
export const projectSecretStages = Object.freeze([
  "project-secret-create",
  "project-secret-metadata",
  "project-secret-rotate",
  "project-secret-secondary-create",
  "project-secret-disable",
  "project-secret-reload",
]);
export const projectSecretSteps = Object.freeze([
  "secret-created",
  "secret-metadata-updated",
  "secret-rotated",
  "secondary-secret-created",
  "secondary-secret-disabled",
  "metadata-only-reload",
]);
export function projectSecretConfig(env, phase) {
  const initial = env.ARCENTRA_ACCEPTANCE_SECRET_INITIAL_VALUE;
  const rotated = env.ARCENTRA_ACCEPTANCE_SECRET_ROTATED_VALUE;
  if (initial === undefined && rotated === undefined) return {};
  assert.equal(phase, "build", "Secret journey requires the build phase");
  for (const value of [initial, rotated])
    assert.ok(
      typeof value === "string" &&
        /^synthetic-ci-secret-[A-Za-z0-9_-]{12,80}$/.test(value),
      "Secret journey accepts only explicitly synthetic bounded values",
    );
  assert.ok(
    initial !== rotated,
    "Rotation must use a distinct synthetic value",
  );
  return {
    projectSecretsJourney: true,
    secretInitialValue: initial,
    secretRotatedValue: rotated,
  };
}
export function projectSecretsEvidence(evidence) {
  if (!evidence) return {};
  assert.ok(Array.isArray(evidence.steps));
  assert.ok(evidence.steps.every((step) => projectSecretSteps.includes(step)));
  assert.equal(new Set(evidence.steps).size, evidence.steps.length);
  const summary = {
    journey: "project-secrets-v1",
    completed: projectSecretSteps.every((step) =>
      evidence.steps.includes(step),
    ),
    steps: projectSecretSteps.filter((step) => evidence.steps.includes(step)),
  };
  for (const key of ["projectId", "activeSecretId", "disabledSecretId"])
    if (evidence[key] !== undefined) {
      assert.ok(
        typeof evidence[key] === "string" &&
          /^[A-Za-z0-9_-]{1,64}$/.test(evidence[key]),
        "Only bounded opaque scoped identifiers can enter secret evidence",
      );
      summary[key] = evidence[key];
    }
  if (summary.completed)
    for (const key of ["projectId", "activeSecretId", "disabledSecretId"])
      assert.ok(summary[key]);
  return { projectSecrets: summary };
}
export function assertNoProjectSecretValues(value, values) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.ok(
    values.every(
      (secret) =>
        !text.includes(secret) &&
        !text.includes(Buffer.from(secret).toString("base64")),
    ),
    "Secret values must not appear in metadata, page, storage, or diagnostics",
  );
}
export function assertSecretMetadata(value, projectId, values) {
  assertNoProjectSecretValues(value, values);
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(
    Object.keys(value).sort(),
    [
      "secretId",
      "projectId",
      "name",
      "secretType",
      "description",
      "version",
      "isEnabled",
      "configured",
      "createdAt",
      "updatedAt",
      "canUpdate",
      "canRotate",
      "canDisable",
    ].sort(),
  );
  assert.equal(value.projectId, projectId);
  assert.ok(typeof value.secretId === "string" && value.secretId);
  assert.ok(typeof value.version === "string" && value.version);
  assert.equal(value.configured, true);
  return value;
}
export async function assertProjectSecretsPageSafe(page, diagnostics, values) {
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Close all secret forms before evidence capture",
  );
  assert.equal(await page.locator('[data-private="true"]').count(), 0);
  assertNoProjectSecretValues(await page.content(), values);
  assertNoProjectSecretValues(diagnostics, values);
  const persisted = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  assertNoProjectSecretValues(persisted, values);
}
export async function runProjectSecretsJourney({
  page,
  base,
  output,
  project,
  config,
  diagnostics,
  responseFor,
  envelope,
  setStage,
  setSensitiveFormOpen,
  evidence,
}) {
  const projectId = project.projectId;
  const endpoint = `/project/${projectId}/secrets`;
  const values = [config.secretInitialValue, config.secretRotatedValue];
  assert.ok(
    config.projectSecretsJourney &&
      values.every((value) => typeof value === "string"),
  );
  evidence.projectId = projectId;
  const mark = (step) => evidence.steps.push(step);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const write = async (method, path, click) => {
    const response = responseFor(method, path);
    const [result] = await Promise.all([response, click()]);
    return assertSecretMetadata(await envelope(result), projectId, values);
  };
  const safe = async () => {
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    setSensitiveFormOpen(false);
    await button("Refresh secrets").waitFor();
    await button("Refresh secrets").click({ trial: true });
    await assertProjectSecretsPageSafe(page, diagnostics, values);
  };
  await page.goto(`${base}/projects/${projectId}/secrets`);
  await page
    .getByText("No secrets are recorded for this project.", { exact: true })
    .waitFor();
  // Keyboard dismissal must discard an entered value without issuing a write.
  await button("Create secret").focus();
  await page.keyboard.press("Enter");
  setSensitiveFormOpen(true);
  await page.getByLabel("New secret value", { exact: true }).fill(values[0]);
  await page.keyboard.press("Escape");
  await safe();
  setStage("project-secret-create");
  await button("Create secret").click();
  setSensitiveFormOpen(true);
  await page.getByLabel("Secret name", { exact: true }).fill("CI_BUILD_TOKEN");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic build secret");
  const field = page.getByLabel("New secret value", { exact: true });
  assert.equal(await field.inputValue(), "");
  await field.fill(values[0]);
  assert.equal(
    await field.evaluate(
      (element) => getComputedStyle(element).webkitTextSecurity,
    ),
    "disc",
    "Secret input must render masked",
  );
  let active = await write("POST", endpoint, () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Create secret", exact: true })
      .click(),
  );
  evidence.activeSecretId = active.secretId;
  mark("secret-created");
  await safe();
  await page
    .getByRole("heading", { name: "CI_BUILD_TOKEN", exact: true })
    .waitFor();
  setStage("project-secret-metadata");
  const initialVersion = active.version;
  await button("Edit metadata for CI_BUILD_TOKEN").click();
  assert.equal(
    await page.getByLabel("New secret value", { exact: true }).count(),
    0,
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic build secret reviewed");
  active = await write("PATCH", `${endpoint}/${active.secretId}`, () =>
    button("Save metadata").click(),
  );
  assert.notEqual(active.version, initialVersion);
  assert.equal(active.description, "Synthetic build secret reviewed");
  mark("secret-metadata-updated");
  await safe();
  setStage("project-secret-rotate");
  await button("Rotate CI_BUILD_TOKEN").click();
  setSensitiveFormOpen(true);
  assert.equal(await field.inputValue(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertControlReachable(button("Cancel"), "Secret form Cancel");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Secret form must fit a narrow viewport",
  );
  await page.screenshot({
    path: `${output}/project-secret-rotation-empty-mobile.png`,
    fullPage: true,
  });
  const previousVersion = active.version;
  await field.fill(values[1]);
  assert.equal(await button("Rotate secret").isDisabled(), true);
  await page.getByRole("checkbox").check();
  await assertControlReachable(
    button("Rotate secret"),
    "Secret rotation action",
  );
  active = await write("POST", `${endpoint}/${active.secretId}/rotate`, () =>
    button("Rotate secret").click(),
  );
  assert.notEqual(active.version, previousVersion);
  mark("secret-rotated");
  await safe();
  await page.setViewportSize({ width: 1440, height: 1050 });
  setStage("project-secret-secondary-create");
  await button("Create secret").click();
  setSensitiveFormOpen(true);
  await page
    .getByLabel("Secret name", { exact: true })
    .fill("CI_DISABLED_TOKEN");
  await field.fill(values[0]);
  let disabled = await write("POST", endpoint, () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Create secret", exact: true })
      .click(),
  );
  evidence.disabledSecretId = disabled.secretId;
  mark("secondary-secret-created");
  await safe();
  setStage("project-secret-disable");
  await button("Disable CI_DISABLED_TOKEN").click();
  await page
    .getByText(
      "Disabling prevents later resolution. This cannot be undone here.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("checkbox").check();
  disabled = await write(
    "POST",
    `${endpoint}/${disabled.secretId}/disable`,
    () => button("Disable secret").click(),
  );
  assert.equal(disabled.isEnabled, 0);
  mark("secondary-secret-disabled");
  await safe();
  setStage("project-secret-reload");
  const response = responseFor("GET", endpoint);
  await page.reload();
  const inventory = await envelope(await response);
  assert.equal(inventory.projectId, projectId);
  assert.equal(inventory.total, 2);
  for (const row of inventory.list)
    assertSecretMetadata(row, projectId, values);
  assert.equal(
    inventory.list.find((row) => row.secretId === active.secretId).version,
    active.version,
  );
  assert.equal(
    inventory.list.find((row) => row.secretId === disabled.secretId).isEnabled,
    0,
  );
  await page
    .getByRole("heading", { name: "CI_DISABLED_TOKEN", exact: true })
    .waitFor();
  assert.equal(await button("Rotate CI_DISABLED_TOKEN").isDisabled(), true);
  assert.equal(await button("Disable CI_DISABLED_TOKEN").isDisabled(), true);
  await safe();
  mark("metadata-only-reload");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertControlReachable(button("Refresh secrets"), "Refresh secrets");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `${output}/project-secrets-metadata-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  return projectSecretsEvidence(evidence).projectSecrets;
}
