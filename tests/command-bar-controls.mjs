import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";

const expectedActions = [
  "Organizations",
  "Open command palette",
  "Inbox",
  "Create new",
];

/** Check the complete action inventory, not just a count that permits substitutions. */
export async function assertCommandBarActions(page) {
  const header = page.getByRole("banner");
  const names = await header
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  const themeAction = names.find((name) =>
    /^Switch to (light|dark) theme$/.test(name),
  );
  assert.deepEqual(
    [...names].sort(),
    [...expectedActions, themeAction].sort(),
    "Every command-bar action must be present exactly once",
  );
  for (const name of names) {
    // This checks visible bounds, nine pointer targets, enabled state, and
    // Playwright click actionability without navigating away or changing theme.
    await assertControlReachable(
      header.getByRole("button", { name, exact: true }),
    );
  }
}
