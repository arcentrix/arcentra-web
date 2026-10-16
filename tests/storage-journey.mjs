/** Browser-only storage setup using the existing, disposable CI MinIO fixture. */
import assert from "node:assert/strict";
import { redactDiagnosticText } from "./browser-harness.mjs";

export const storageFixtureCredentials = Object.freeze({
  accessKey: "ci-only-s3-user",
  secretKey: "ci-only-s3-password",
});
export const storageInitialName = "Acceptance MinIO";
export const storageEditedName = "Acceptance MinIO reviewed";
export const storageDescription =
  "Synthetic CI artifact storage, metadata reviewed";

export function syntheticStorageConfig(endpoint) {
  assert.ok(
    ["127.0.0.1:19000", "minio:9000"].includes(endpoint),
    "Storage setup permits only the exact synthetic host or image target",
  );
  return {
    endpoint,
    ...storageFixtureCredentials,
    bucket: "acceptance",
    region: "us-east-1",
    useTLS: false,
    basePath: "actual-app",
  };
}

export function storageSensitiveValues(endpoint) {
  syntheticStorageConfig(endpoint);
  return [
    ...Object.values(storageFixtureCredentials),
    ...Object.values(storageFixtureCredentials).map((value) =>
      Buffer.from(value).toString("base64"),
    ),
  ];
}

export function assertNoStorageSecrets(value, endpoint) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(
    redactDiagnosticText(text, storageSensitiveValues(endpoint)) === text,
    true,
    "Storage credentials must not appear in returned data, page, console or errors",
  );
}

export function assertPublicStorage(
  value,
  endpoint,
  { edited = false, isDefault = 0 } = {},
) {
  assertNoStorageSecrets(value, endpoint);
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Storage response must be an object",
  );
  assert.equal(value.storageId, "acceptance");
  assert.equal(value.storageType, "minio");
  assert.equal(value.name, edited ? storageEditedName : storageInitialName);
  assert.equal(value.isEnabled, 1);
  assert.equal(value.isDefault, isDefault);
  if (edited) assert.equal(value.description, storageDescription);
  const expected = syntheticStorageConfig(endpoint);
  delete expected.accessKey;
  delete expected.secretKey;
  assert.ok(
    JSON.stringify(Object.keys(value.config).sort()) ===
      JSON.stringify(Object.keys(expected).sort()),
    "Only noncredential target fields may be returned",
  );
  for (const [key, field] of Object.entries(expected))
    assert.ok(
      value.config[key] === field,
      "Persisted storage target must match the synthetic fixture",
    );
  assert.ok(
    JSON.stringify([...value.configuredFields].sort()) ===
      '["accessKey","secretKey"]',
    "Both write-only credentials must remain configured",
  );
}

export async function assertStoragePageSafe(page, diagnostics, endpoint) {
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Close all sensitive forms before evidence capture",
  );
  assert.equal(
    await page.locator('input[type="password"]').count(),
    0,
    "Credential fields must be removed after save or cancellation",
  );
  assertNoStorageSecrets(await page.content(), endpoint);
  assertNoStorageSecrets(diagnostics, endpoint);
}

/** All mutations are explicit product UI clicks. Never submit through page.evaluate or APIRequestContext. */
export async function runStorageSetup({
  page,
  base,
  output,
  diagnostics,
  responseFor,
  envelope,
  record,
  setStage,
  setSensitiveFormOpen,
  protectSensitiveValue,
  endpoint,
}) {
  const storage = syntheticStorageConfig(endpoint);
  setStage("storage-create");
  const initialList = responseFor("GET", "/storage/configs");
  initialList.catch(() => {});
  await page.goto(`${base}/settings?section=storage`);
  await page
    .getByRole("heading", { name: "Artifact storage", exact: true })
    .waitFor();
  assert.deepEqual(await envelope(await initialList), []);
  await page.getByRole("button", { name: "New storage", exact: true }).click();
  setSensitiveFormOpen(true);
  let dialog = page.getByRole("dialog", { name: "New storage", exact: true });
  await dialog.waitFor();
  // Closing a draft must discard both synthetic credentials without any write.
  await dialog
    .getByLabel("Access key", { exact: true })
    .fill(storage.accessKey);
  await dialog
    .getByLabel("Secret key", { exact: true })
    .fill(storage.secretKey);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  setSensitiveFormOpen(false);
  await assertStoragePageSafe(page, diagnostics, endpoint);
  await page.getByRole("button", { name: "New storage", exact: true }).click();
  setSensitiveFormOpen(true);
  dialog = page.getByRole("dialog", { name: "New storage", exact: true });
  await dialog.waitFor();
  for (const field of ["Access key", "Secret key"])
    assert.equal(
      await dialog.getByLabel(field, { exact: true }).inputValue(),
      "",
    );
  await dialog.getByLabel("Storage ID", { exact: true }).fill("acceptance");
  await dialog.getByLabel("Name", { exact: true }).fill(storageInitialName);
  await dialog.getByLabel("Provider", { exact: true }).selectOption("minio");
  for (const [label, key] of [
    ["Endpoint", "endpoint"],
    ["Bucket", "bucket"],
    ["Region", "region"],
    ["Base path", "basePath"],
    ["Access key", "accessKey"],
    ["Secret key", "secretKey"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(storage[key]);
  await dialog.getByLabel("Use TLS", { exact: true }).uncheck();
  const created = responseFor("POST", "/storage/configs");
  await dialog
    .getByRole("button", { name: "Create storage", exact: true })
    .click();
  const createdResponse = await created;
  const createPayload = createdResponse.request().postDataJSON();
  protectSensitiveValue(createPayload.config);
  const submittedConfig = JSON.parse(
    Buffer.from(createPayload.config, "base64").toString("utf8"),
  );
  assert.ok(
    Object.keys(submittedConfig).length === Object.keys(storage).length &&
      Object.entries(storage).every(
        ([key, value]) => submittedConfig[key] === value,
      ),
    "UI must submit exactly the approved synthetic storage configuration",
  );
  assertNoStorageSecrets(await createdResponse.text(), endpoint);
  assertPublicStorage(await envelope(createdResponse), endpoint);
  await dialog.waitFor({ state: "hidden" });
  setSensitiveFormOpen(false);
  const card = page.getByTestId("storage-acceptance");
  await card.waitFor();
  await record("storage-create-via-ui-redacted-response");

  setStage("storage-edit");
  await card
    .getByRole("button", {
      name: `Edit storage ${storageInitialName}`,
      exact: true,
    })
    .click();
  setSensitiveFormOpen(true);
  dialog = page.getByRole("dialog", { name: "Edit storage", exact: true });
  await dialog.waitFor();
  for (const field of ["Access key", "Secret key"])
    assert.equal(
      await dialog.getByLabel(field, { exact: true }).inputValue(),
      "",
      "Editing never repopulates saved credentials",
    );
  for (const field of ["Replace access key", "Replace secret key"])
    assert.equal(
      await dialog.getByLabel(field, { exact: true }).isChecked(),
      false,
    );
  // An explicitly enabled but still blank replacement is also preservation.
  await dialog.getByLabel("Replace access key", { exact: true }).check();
  await dialog.getByLabel("Replace secret key", { exact: true }).check();
  await dialog.getByLabel("Name", { exact: true }).fill(storageEditedName);
  await dialog
    .getByLabel("Description", { exact: true })
    .fill(storageDescription);
  const updated = responseFor("PUT", "/storage/configs/acceptance");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const updateResponse = await updated;
  const updatePayload = updateResponse.request().postDataJSON();
  const updateConfig = updatePayload.config
    ? JSON.parse(Buffer.from(updatePayload.config, "base64").toString("utf8"))
    : {};
  assert.equal(Object.hasOwn(updateConfig, "accessKey"), false);
  assert.equal(Object.hasOwn(updateConfig, "secretKey"), false);
  assertPublicStorage(await envelope(updateResponse), endpoint, {
    edited: true,
  });
  await dialog.waitFor({ state: "hidden" });
  setSensitiveFormOpen(false);
  await record("storage-edit-metadata-preserves-blank-credentials");

  setStage("storage-default");
  await card
    .getByRole("button", {
      name: `Set ${storageEditedName} as default`,
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Change default storage",
    exact: true,
  });
  await dialog.waitFor();
  const changed = responseFor("POST", "/storage/configs/acceptance/default");
  await dialog
    .getByRole("button", { name: "Confirm default", exact: true })
    .click();
  assertNoStorageSecrets(await envelope(await changed), endpoint);
  await dialog.waitFor({ state: "hidden" });

  setStage("storage-reload");
  const reloaded = responseFor("GET", "/storage/configs");
  await page.reload();
  const list = await envelope(await reloaded);
  assert.equal(list.length, 1);
  assertPublicStorage(list[0], endpoint, { edited: true, isDefault: 1 });
  await card.getByText(storageEditedName, { exact: true }).waitFor();
  await card.getByText("Default (saved)", { exact: true }).waitFor();
  await page
    .getByText(
      /Saving configuration does not test connectivity or reload running services/,
    )
    .waitFor();
  await record("storage-explicit-default-and-reload");
  await assertStoragePageSafe(page, diagnostics, endpoint);
  assert.equal(
    await page
      .getByRole("button", {
        name: /Delete storage|Disable storage|Test connection/,
      })
      .count(),
    0,
  );
  await page.screenshot({
    path: `${output}/storage-setup-configured.png`,
    fullPage: true,
  });
  await record("storage-no-secret-in-page-or-diagnostics");
}
