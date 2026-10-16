/** Synthetic transport assertions only: never evidence of provider reads or execution. */
import assert from "node:assert/strict";

export function pollingFixture() {
  const initial = {
    supported: true,
    state: "disabled",
    revision: 0,
    selectedPipelines: [],
    blocker: "",
    scope: {
      provider: "gitlab",
      repository: "https://gitlab.example/team/api",
      stream: "merge_requests",
    },
    capabilities: { canBaseline: true, canEnable: false, canDisable: false },
  };
  let status = structuredClone(initial);
  let conflict = false;
  const writes = [];
  const candidates = Array.from({ length: 101 }, (_, index) => ({
    pipelineId: `polling-${index + 1}`,
    name: `Polling build ${index + 1}`,
    defaultBranch: "main",
    definitionPath: ".arcentra/pipeline.yaml",
    eligible: true,
    canEnable: index !== 1,
    blocker: index === 1 ? "insufficient_current_trigger_authority" : "",
  }));
  return {
    writes,
    get status() {
      return status;
    },
    makeConflict() {
      conflict = true;
    },
    async route(route) {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const root = "/api/v1/project/project-1/polling";
      if (!path.startsWith(root)) return false;
      const ok = (detail) => route.fulfill({ json: { code: 200, detail } });
      if (request.method() === "GET" && path === root) {
        await ok(status);
        return true;
      }
      if (request.method() === "GET" && path === `${root}/candidates`) {
        const pageNum = Number(url.searchParams.get("pageNum"));
        assert.equal(url.searchParams.get("pageSize"), "25");
        await ok({
          items: candidates.slice((pageNum - 1) * 25, pageNum * 25),
          total: candidates.length,
          pageNum,
          pageSize: 25,
        });
        return true;
      }
      assert.equal(request.method(), "POST");
      const action = path.slice(root.length + 1);
      const body = request.postDataJSON();
      writes.push({ action, body });
      assert.equal(body.expectedRevision, status.revision);
      if (conflict) {
        conflict = false;
        await route.fulfill({
          status: 409,
          json: {
            code: 409,
            errMsg:
              "polling state changed; refresh and review the current state",
          },
        });
        return true;
      }
      if (action === "baseline") {
        assert.deepEqual(Object.keys(body).sort(), [
          "acknowledgeDiscard",
          "expectedRevision",
        ]);
        assert.equal(body.acknowledgeDiscard, !!status.baselineId);
        status = {
          ...status,
          state: "baselined",
          revision: status.revision + 1,
          baselineId: `baseline-${status.revision + 1}`,
          baselineCompletedAt: "2026-10-16T12:00:00Z",
          baselineObservationCount: 7,
          capabilities: {
            canBaseline: true,
            canEnable: true,
            canDisable: true,
          },
        };
      } else if (action === "enable") {
        assert.deepEqual(Object.keys(body).sort(), [
          "baselineId",
          "expectedRevision",
          "pipelineIds",
        ]);
        assert.equal(body.baselineId, status.baselineId);
        assert.deepEqual(body.pipelineIds, ["polling-1", "polling-101"]);
        status = {
          ...status,
          state: "enabled",
          revision: status.revision + 1,
          selectedPipelines: candidates
            .filter((row) => body.pipelineIds.includes(row.pipelineId))
            .map(({ pipelineId, name }) => ({ pipelineId, name })),
          capabilities: {
            canBaseline: false,
            canEnable: false,
            canDisable: true,
          },
          lastCompletedAt: "2026-10-16T12:02:00Z",
          lastObservationCount: 1,
          lastTargetCount: 0,
          nextRetryAt: "2026-10-16T12:03:00Z",
        };
      } else if (action === "disable") {
        assert.deepEqual(Object.keys(body), ["expectedRevision"]);
        status = {
          ...status,
          state: "disabled",
          revision: status.revision + 1,
          capabilities: initial.capabilities,
        };
      } else assert.fail(`Unexpected polling operation: ${action}`);
      await ok(status);
      return true;
    },
  };
}

export async function assertPollingSetup({
  page,
  fixture,
  output,
  expectHttpError,
}) {
  const originalViewport = page.viewportSize();
  const refresh = page.getByRole("button", { name: "Refresh polling status" });
  await refresh.waitFor();
  await page
    .getByRole("button", { name: "Review baseline", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Select Polling build 1 for polling",
        exact: true,
      })
      .isEnabled(),
    false,
  );
  await refresh.click();
  await page
    .getByRole("button", { name: "Review baseline", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    fixture.writes.length,
    0,
    "Status, refresh and dismissal are read-only",
  );
  await page
    .getByRole("button", { name: "Review baseline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save baseline without runs" })
    .click();
  await page.getByText("Baseline ready", { exact: true }).waitFor();
  assert.deepEqual(
    fixture.writes.map((row) => row.action),
    ["baseline"],
  );
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Select Polling build 2 for polling",
        exact: true,
      })
      .isEnabled(),
    false,
  );
  await page
    .getByRole("checkbox", {
      name: "Select Polling build 1 for polling",
      exact: true,
    })
    .check();
  for (let index = 0; index < 4; index++) {
    await page.getByRole("button", { name: "Next candidate page" }).click();
    await page.getByText(`Page ${index + 2} of 5`, { exact: false }).waitFor();
  }
  await page
    .getByRole("checkbox", {
      name: "Select Polling build 101 for polling",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Review enable polling" }).click();
  const dialog = page.getByRole("dialog");
  assert.match(
    await dialog.innerText(),
    /Polling build 1[\s\S]*Polling build 101/,
  );
  assert.match(await dialog.innerText(), /Agent checkout SHA may differ/);
  await page.setViewportSize({ width: 390, height: 700 });
  await page
    .getByRole("button", { name: "Enable these pipelines" })
    .scrollIntoViewIfNeeded();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: `${output}/polling-enable-review-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enable these pipelines" }).click();
  await page.getByText("Enabled", { exact: true }).waitFor();
  await page
    .getByText(/Observation completed without a matching event\/ref target/)
    .waitFor();
  await refresh.click();
  await page.getByRole("button", { name: "Review disable polling" }).click();
  assert.match(
    await dialog.innerText(),
    /Runs already accepted are not cancelled/,
  );
  await page
    .getByRole("button", { name: "Disable polling", exact: true })
    .click();
  await page.getByText("Disabled", { exact: true }).waitFor();
  assert.deepEqual(
    fixture.writes.map((row) => row.action),
    ["baseline", "enable", "disable"],
  );
  await page
    .getByRole("button", { name: "Review replacement baseline" })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Save baseline without runs" })
      .isEnabled(),
    false,
  );
  await dialog.getByRole("checkbox").check();
  fixture.makeConflict();
  expectHttpError("/api/v1/project/project-1/polling/baseline", 409);
  await page
    .getByRole("button", { name: "Save baseline without runs" })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Polling state changed" })
    .waitFor();
  assert.equal(fixture.writes.length, 4);
  await refresh.click();
  await page
    .getByRole("button", { name: "Review replacement baseline" })
    .waitFor();
  assert.equal(
    fixture.writes.length,
    4,
    "Conflict refresh must not replay a mutation",
  );
  await page.screenshot({
    path: `${output}/polling-disabled-mobile.png`,
    fullPage: true,
  });
  if (originalViewport) await page.setViewportSize(originalViewport);
}
