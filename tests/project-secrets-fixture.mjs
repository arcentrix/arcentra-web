import assert from "node:assert/strict";
import {
  assertProjectSecretsPageSafe,
  runProjectSecretsJourney,
} from "./project-secrets-journey.mjs";
export const syntheticProjectSecretValues = [
  "synthetic-ci-secret-fixtureInitial001",
  "synthetic-ci-secret-fixtureRotated002",
];
export function projectSecretsFixture(projectId = "project-1") {
  const state = {
    active: false,
    mode: "normal",
    rows: [],
    stored: new Map(),
    reads: 0,
    writes: 0,
    rejectedWrites: 0,
  };
  const endpoint = `/project/${projectId}/secrets`;
  const capabilities = () => ({
    canWrite: state.mode !== "readonly",
    canDisable: state.mode !== "readonly",
    projectActive: state.mode !== "inactive",
    encryptionConfigured: state.mode !== "missing-key",
  });
  const metadata = (row) => {
    const cap = capabilities();
    return {
      ...row,
      canUpdate: !!(cap.canWrite && cap.projectActive && row.isEnabled),
      canRotate: !!(
        cap.canWrite &&
        cap.projectActive &&
        cap.encryptionConfigured &&
        row.isEnabled
      ),
      canDisable: !!(cap.canDisable && cap.projectActive && row.isEnabled),
    };
  };
  return {
    state,
    endpoint,
    async route(route) {
      if (!state.active) return false;
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/v1", "");
      if (!path.startsWith(endpoint)) return false;
      assert.equal(
        url.search,
        "",
        "Secret APIs have no value-bearing URL parameters",
      );
      const method = request.method();
      const reply = async (detail) => {
        await route.fulfill({ json: { code: 200, detail } });
        return true;
      };
      const reject = async (status) => {
        if (method !== "GET") state.rejectedWrites++;
        await route.fulfill({
          status,
          json: {
            code: status,
            errMsg: `synthetic rejection ${syntheticProjectSecretValues[0]}`,
          },
        });
        return true;
      };
      if (method === "GET" && path === endpoint) {
        state.reads++;
        if (state.mode === "denied-read") return reject(403);
        if (state.mode === "error-read") return reject(503);
        const cap = capabilities();
        return reply({
          projectId,
          list: state.rows.map(metadata),
          total: state.rows.length,
          ...cap,
          canCreate:
            cap.canWrite &&
            cap.projectActive &&
            cap.encryptionConfigured &&
            state.rows.length < 1000,
        });
      }
      assert.ok(
        ["POST", "PATCH"].includes(method),
        "No secret value retrieval or deletion route exists",
      );
      const body = request.postDataJSON();
      if (state.mode === "revoked-write") return reject(403);
      if (state.mode === "conflict") return reject(409);
      assert.equal(
        state.mode,
        "normal",
        "Blocked controls must not send requests",
      );
      if (path === endpoint && method === "POST") {
        assert.deepEqual(
          Object.keys(body).sort(),
          ["name", "secretType", "description", "value"].sort(),
        );
        assert.ok(["CI_BUILD_TOKEN", "CI_DISABLED_TOKEN"].includes(body.name));
        assert.ok(
          syntheticProjectSecretValues.includes(body.value),
          "Only synthetic values may be written",
        );
        assert.equal(body.secretType, "token");
        assert.ok(!state.rows.some((row) => row.name === body.name));
        const row = {
          projectId,
          secretId: `synthetic-secret-${state.rows.length + 1}`,
          name: body.name,
          secretType: body.secretType,
          description: body.description,
          version: "opaque-v1",
          isEnabled: 1,
          configured: true,
          createdAt: "2026-10-18T00:00:00Z",
          updatedAt: "2026-10-18T00:00:00Z",
        };
        state.rows.push(row);
        state.stored.set(row.secretId, body.value);
        state.writes++;
        return reply(metadata(row));
      }
      const match = path
        .slice(endpoint.length)
        .match(/^\/([A-Za-z0-9_-]+)(?:\/(rotate|disable))?$/);
      assert.ok(match, "Exact scoped operation required");
      const row = state.rows.find((item) => item.secretId === match[1]);
      assert.ok(row);
      assert.equal(
        body.version,
        row.version,
        "Mutations must use the exact current opaque version",
      );
      assert.equal(row.isEnabled, 1);
      if (method === "PATCH" && !match[2]) {
        assert.deepEqual(Object.keys(body).sort(), ["description", "version"]);
        const previous = state.stored.get(row.secretId);
        row.description = body.description;
        assert.ok(
          state.stored.get(row.secretId) === previous,
          "Metadata edits preserve stored value",
        );
      } else if (method === "POST" && match[2] === "rotate") {
        assert.deepEqual(Object.keys(body).sort(), ["value", "version"]);
        assert.ok(
          body.value === syntheticProjectSecretValues[1],
          "Rotation must submit the distinct synthetic value",
        );
        state.stored.set(row.secretId, body.value);
      } else if (method === "POST" && match[2] === "disable") {
        assert.deepEqual(Object.keys(body), ["version"]);
        row.isEnabled = 0;
      } else assert.fail("Unsupported project secret operation");
      row.version = `opaque-v${Number(row.version.slice(8)) + 1}`;
      row.updatedAt = "2026-10-18T00:01:00Z";
      state.writes++;
      return reply(metadata(row));
    },
  };
}
export async function assertProjectSecretsFixtureUI({
  page,
  base,
  output,
  diagnostics,
  expectHttpError,
  setStage,
  setSensitiveFormOpen,
  protectSensitiveValue,
  secrets,
  project,
}) {
  secrets.state.active = true;
  for (const value of syntheticProjectSecretValues)
    protectSensitiveValue(value);
  const responseFor = (method, path) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        new URL(response.url()).pathname === `/api/v1${path}`,
    );
  const envelope = async (response) => {
    assert.equal(response.status(), 200);
    const result = await response.json();
    assert.equal(result.code, 200);
    return result.detail;
  };
  const config = {
    projectSecretsJourney: true,
    secretInitialValue: syntheticProjectSecretValues[0],
    secretRotatedValue: syntheticProjectSecretValues[1],
  };
  const evidence = { steps: [] };
  await runProjectSecretsJourney({
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
  });
  assert.equal(secrets.state.writes, 5);
  assert.ok(
    secrets.state.stored.get(evidence.activeSecretId) ===
      syntheticProjectSecretValues[1],
  );
  setStage("fixture-regression");
  const button = (name) => page.getByRole("button", { name, exact: true });
  const refresh = async () => {
    const response = responseFor("GET", secrets.endpoint);
    await button("Refresh secrets").click();
    await envelope(await response);
    await page
      .getByRole("heading", { name: "CI_BUILD_TOKEN", exact: true })
      .waitFor();
  };
  for (const mode of ["missing-key", "readonly", "inactive"]) {
    secrets.state.mode = mode;
    await refresh();
    assert.equal(await button("Create secret").isDisabled(), true);
    assert.equal(await button("Rotate CI_BUILD_TOKEN").isDisabled(), true);
    if (mode === "missing-key") {
      await page.getByText(/server encryption key is unavailable/).waitFor();
      assert.equal(
        await button("Edit metadata for CI_BUILD_TOKEN").isDisabled(),
        false,
      );
    } else if (mode === "readonly")
      await page.getByText(/Current access requires secret:write/).waitFor();
    else
      await page.getByText(/project or its organization is inactive/).waitFor();
  }
  secrets.state.mode = "normal";
  await refresh();
  for (const [mode, status] of [
    ["conflict", 409],
    ["revoked-write", 403],
  ]) {
    await button("Rotate CI_BUILD_TOKEN").click();
    setSensitiveFormOpen(true);
    await page
      .getByLabel("New secret value", { exact: true })
      .fill(syntheticProjectSecretValues[1]);
    await page.getByRole("checkbox").check();
    secrets.state.mode = mode;
    const path = `${secrets.endpoint}/${evidence.activeSecretId}/rotate`;
    expectHttpError(`/api/v1${path}`, status);
    const rejected = responseFor("POST", path);
    await button("Rotate secret").click();
    assert.equal((await rejected).status(), status);
    await page.getByRole("alert").waitFor();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    setSensitiveFormOpen(false);
    assert.equal(
      await page
        .getByRole("heading", { name: "CI_BUILD_TOKEN", exact: true })
        .count(),
      0,
    );
    await assertProjectSecretsPageSafe(
      page,
      diagnostics,
      syntheticProjectSecretValues,
    );
    secrets.state.mode = "normal";
    await button("Check secret access again").click();
    await page
      .getByRole("heading", { name: "CI_BUILD_TOKEN", exact: true })
      .waitFor();
    await button("Rotate CI_BUILD_TOKEN").click();
    assert.equal(
      await page.getByLabel("New secret value", { exact: true }).inputValue(),
      "",
    );
    await button("Cancel").click();
  }
  secrets.state.mode = "denied-read";
  expectHttpError(`/api/v1${secrets.endpoint}`, 403);
  await button("Refresh secrets").click();
  await page.getByText("Secret access restricted", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "CI_BUILD_TOKEN", exact: true })
      .count(),
    0,
  );
  assert.equal(await button("Create secret").count(), 0);
  await assertProjectSecretsPageSafe(
    page,
    diagnostics,
    syntheticProjectSecretValues,
  );
  assert.equal(secrets.state.writes, 5);
  assert.equal(secrets.state.rejectedWrites, 2);
}
