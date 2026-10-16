/** Explicit transport fixtures for storage UI regression; never real API acceptance. */
import assert from "node:assert/strict";
import {
  assertStoragePageSafe,
  runStorageSetup,
  storageEditedName,
  storageResponseAfterReload,
  syntheticStorageConfig,
} from "./storage-journey.mjs";

export function storageFixture() {
  const state = {
    mode: "normal",
    row: null,
    stored: null,
    reads: 0,
    writes: 0,
    rejectedWrites: 0,
  };
  return {
    state,
    async route(route) {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace("/api/v1", "");
      if (!path.startsWith("/storage/")) return false;
      const method = request.method();
      const ok = async (detail) => {
        await route.fulfill({ json: { code: 200, detail } });
        return true;
      };
      const denied = async () => {
        await route.fulfill({
          status: 403,
          json: { code: 403, errMsg: "Synthetic storage permission revoked" },
        });
        return true;
      };
      const publicRow = () => {
        if (!state.row) return null;
        const { accessKey, secretKey, ...config } = state.stored;
        return {
          ...state.row,
          config,
          configuredFields: ["accessKey", "secretKey"],
        };
      };
      if (method === "GET" && path === "/storage/configs") {
        state.reads++;
        if (["restricted", "revoked-read"].includes(state.mode))
          return denied();
        return ok(state.row ? [publicRow()] : []);
      }
      if (method === "GET" && path === "/storage/configs/acceptance") {
        if (state.mode === "revoked-read") return denied();
        return ok(publicRow());
      }
      if (state.mode === "revoked-write") {
        state.rejectedWrites++;
        return denied();
      }
      if (method === "POST" && path === "/storage/configs") {
        const payload = request.postDataJSON();
        assert.equal(state.row, null);
        assert.equal(payload.storageId, "acceptance");
        assert.equal(payload.storageType, "minio");
        assert.equal(payload.isDefault ?? 0, 0);
        const config = JSON.parse(
          Buffer.from(payload.config, "base64").toString("utf8"),
        );
        const expected = syntheticStorageConfig("127.0.0.1:19000");
        assert.ok(
          Object.keys(config).length === Object.keys(expected).length &&
            Object.entries(expected).every(
              ([key, value]) => config[key] === value,
            ),
          "Create must send only exact synthetic fixture configuration",
        );
        state.stored = config;
        state.row = {
          storageId: payload.storageId,
          storageType: payload.storageType,
          name: payload.name,
          description: payload.description || "",
          isEnabled: 1,
          isDefault: 0,
        };
        state.writes++;
        return ok(publicRow());
      }
      if (method === "PUT" && path === "/storage/configs/acceptance") {
        const payload = request.postDataJSON();
        assert.equal(Object.hasOwn(payload, "isDefault"), false);
        assert.equal(Object.hasOwn(payload, "isEnabled"), false);
        if (payload.config) {
          const config = JSON.parse(
            Buffer.from(payload.config, "base64").toString("utf8"),
          );
          assert.equal(Object.hasOwn(config, "accessKey"), false);
          assert.equal(Object.hasOwn(config, "secretKey"), false);
        }
        state.row = {
          ...state.row,
          name: payload.name,
          description: payload.description,
        };
        state.writes++;
        return ok(publicRow());
      }
      if (method === "POST" && path === "/storage/configs/acceptance/default") {
        state.row.isDefault = 1;
        state.writes++;
        return ok({ id: "acceptance" });
      }
      assert.fail("Unexpected storage fixture operation");
    },
  };
}

export async function assertStorageFixtureUI({
  page,
  base,
  output,
  diagnostics,
  expectHttpError,
  setStage,
  setSensitiveFormOpen,
  protectSensitiveValue,
  storage,
}) {
  const responseFor = (method, path) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        new URL(response.url()).pathname === `/api/v1${path}`,
    );
  const envelope = async (response) => {
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.code, 200);
    return body.detail;
  };
  const steps = [];
  await runStorageSetup({
    page,
    base,
    output,
    diagnostics,
    responseFor,
    envelope,
    setStage,
    setSensitiveFormOpen,
    protectSensitiveValue,
    endpoint: "127.0.0.1:19000",
    record: async (step) => steps.push(step),
  });
  assert.equal(storage.state.writes, 3);
  assert.equal(steps.length, 4);

  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.getByTestId("storage-acceptance").boundingBox();
  assert.ok(
    bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390,
    "Storage card must fit the mobile viewport",
  );
  await assertStoragePageSafe(page, diagnostics, "127.0.0.1:19000");
  await page.screenshot({
    path: `${output}/storage-configured-mobile-fixture.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });

  setStage("storage-permissions");
  const card = page.getByTestId("storage-acceptance");
  await card
    .getByRole("button", {
      name: `Edit storage ${storageEditedName}`,
      exact: true,
    })
    .click();
  setSensitiveFormOpen(true);
  let dialog = page.getByRole("dialog", { name: "Edit storage", exact: true });
  await dialog.waitFor();
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Rejected metadata must not persist");
  storage.state.mode = "revoked-write";
  expectHttpError("/api/v1/storage/configs/acceptance", 403);
  const rejectedWrite = responseFor("PUT", "/storage/configs/acceptance");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  assert.equal((await rejectedWrite).status(), 403);
  await dialog.waitFor({ state: "hidden" });
  setSensitiveFormOpen(false);
  await page.getByText(/Storage access restricted/).waitFor();
  assert.equal(
    storage.state.writes,
    3,
    "Denied writes cannot silently persist metadata",
  );
  assert.equal(storage.state.rejectedWrites, 1);
  storage.state.mode = "normal";
  const reloaded = await storageResponseAfterReload(page);
  assert.equal((await envelope(reloaded))[0].name, storageEditedName);
  await card.waitFor();
  await assertStoragePageSafe(page, diagnostics, "127.0.0.1:19000");

  // Effective actions can become stale. The server's live GET 403 must remove
  // saved configuration from view and must not become a fabricated empty list.
  storage.state.mode = "revoked-read";
  expectHttpError("/api/v1/storage/configs", 403);
  const rejectedRead = await storageResponseAfterReload(page);
  assert.equal(rejectedRead.status(), 403);
  await page.getByText(/Storage access restricted/i).waitFor();
  assert.equal(await card.count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "New storage", exact: true })
      .count(),
    0,
  );
  await assertStoragePageSafe(page, diagnostics, "127.0.0.1:19000");
  await page.screenshot({
    path: `${output}/storage-revoked-access-fixture.png`,
    fullPage: true,
  });

  // Ordinary low-permission users do not get mutation controls or issue a list
  // request. The separate stale-capability case above proves the real 403 UI.
  storage.state.mode = "restricted";
  const readsBefore = storage.state.reads;
  await page.reload();
  await page.getByText(/Storage access restricted/i).waitFor();
  assert.equal(storage.state.reads, readsBefore);
  assert.equal(
    await page
      .getByRole("button", { name: "New storage", exact: true })
      .count(),
    0,
  );
  assert.equal(await card.count(), 0);
  assert.equal(storage.state.writes, 3);
  await assertStoragePageSafe(page, diagnostics, "127.0.0.1:19000");
  storage.state.mode = "normal";
  setStage("fixture-regression");
}
