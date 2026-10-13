import assert from "node:assert/strict";

/** Check actual pointer targets, including partially obscured button edges. */
export async function assertControlReachable(control) {
  await control.scrollIntoViewIfNeeded();
  const state = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const launcher = document.querySelector('[aria-label="Open Copilot"]');
    const floating = launcher?.getBoundingClientRect();
    const overlapsLauncher =
      launcher !== element &&
      floating &&
      rect.left < floating.right &&
      rect.right > floating.left &&
      rect.top < floating.bottom &&
      rect.bottom > floating.top;
    const hits = [0.25, 0.5, 0.75].flatMap((x) =>
      [0.25, 0.5, 0.75].map((y) =>
        element.contains(
          document.elementFromPoint(
            rect.left + rect.width * x,
            rect.top + rect.height * y,
          ),
        ),
      ),
    );
    return {
      label: element.getAttribute("aria-label") || element.textContent.trim(),
      insideViewport:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.top >= 0 &&
        rect.bottom <= innerHeight,
      overlapsLauncher: !!overlapsLauncher,
      pointerHits: hits.every(Boolean),
    };
  });
  assert.equal(state.insideViewport, true, `${state.label} must fit on screen`);
  assert.equal(
    state.overlapsLauncher,
    false,
    `${state.label} must not overlap Copilot`,
  );
  assert.equal(
    state.pointerHits,
    true,
    `${state.label} must receive pointer input at its center and edges`,
  );
  // Playwright also checks enabled state and event reception without force.
  await control.click({ trial: true });
}

export async function assertArtifactControlLayout(page, runId) {
  const layout = await page
    .getByRole("table", { name: "Project artifacts" })
    .evaluate((table, expectedRunId) => {
      const content = document.querySelector("main");
      const main = content.getBoundingClientRect();
      const launcher = document
        .querySelector('[aria-label="Open Copilot"]')
        .getBoundingClientRect();
      const link = [
        ...table.querySelectorAll("tbody tr td:nth-child(2) a"),
      ].find((element) => element.textContent === expectedRunId);
      const range = document.createRange();
      range.selectNodeContents(link);
      return {
        pageFits:
          document.documentElement.scrollWidth <= innerWidth &&
          content.scrollWidth <= content.clientWidth,
        mobile: innerWidth < 640,
        reservedRow:
          main.bottom <= launcher.top && launcher.bottom <= innerHeight,
        runIdLines: range.getClientRects().length,
        fullRunId: link.textContent === expectedRunId,
      };
    }, runId);
  assert.equal(
    layout.pageFits,
    true,
    "Only the artifact table may scroll sideways",
  );
  if (layout.mobile)
    assert.equal(
      layout.reservedRow,
      true,
      "The mobile Copilot row must remain outside the content scrollport",
    );
  assert.equal(layout.fullRunId, true, "The full run ID must be retained");
  assert.equal(
    layout.runIdLines,
    1,
    "A run ID must remain readable on one line",
  );
}
