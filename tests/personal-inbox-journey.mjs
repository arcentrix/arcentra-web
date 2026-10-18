/** Actual personal Inbox API/UI evidence only. Caller owns login, restart and final receipt publication. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";

export const personalInboxStages = Object.freeze([
  "personal-inbox-read",
  "personal-inbox-mark-read",
  "personal-inbox-reload",
  "personal-inbox-resume",
]);
export const personalInboxReadSteps = Object.freeze([
  "run-results-delivered",
  "failed-run-visible",
  "successful-run-visible",
  "successful-run-marked-read",
  "read-state-reloaded",
]);
export const personalInboxResumeSteps = Object.freeze([
  "same-requester-login",
  "persisted-read-entry",
  "persisted-unread-entry",
]);
const itemKeys = [
  "id",
  "kind",
  "status",
  "occurredAt",
  "deliveredAt",
  "readAt",
  "target",
  "availability",
];
const object = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) =>
  object(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const identity = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const instant = (value) => {
  if (typeof value !== "string" || value.length > 64) return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts || parts[0] !== value) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    Number.isFinite(Date.parse(value))
  );
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function fixture(failed, successful) {
  for (const row of [failed, successful])
    assert.ok(
      object(row) &&
        ["projectId", "pipelineId", "runId"].every((key) => identity(row[key])),
      "Inbox fixture identities must be bounded and independently verified",
    );
  assert.ok(
    failed.runId !== successful.runId &&
      failed.status === "failed" &&
      successful.status === "success",
    "Inbox fixtures require distinct verified failed and successful runs",
  );
}
export function validatePersonalInboxItem(item, expected, read) {
  assert.ok(
    exactKeys(item, itemKeys),
    "Inbox item requires the exact metadata projection",
  );
  assert.ok(
    identity(item.id) &&
      item.kind === "run_result" &&
      item.status === expected.status &&
      item.availability === "available",
    "Inbox item must be the exact available terminal fact",
  );
  assert.ok(
    exactKeys(item.target, ["type", "projectId", "pipelineId", "runId"]) &&
      item.target.type === "run" &&
      ["projectId", "pipelineId", "runId"].every(
        (key) =>
          identity(item.target[key]) && item.target[key] === expected[key],
      ),
    "Inbox source or scope does not match the verified run",
  );
  assert.ok(
    instant(item.occurredAt) &&
      instant(item.deliveredAt) &&
      (read ? instant(item.readAt) : item.readAt === null),
    "Inbox delivery/read timestamps are not valid evidence",
  );
  // Fixed property order makes comparisons independent of transport object ordering.
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    occurredAt: item.occurredAt,
    deliveredAt: item.deliveredAt,
    readAt: item.readAt,
    target: {
      type: "run",
      projectId: item.target.projectId,
      pipelineId: item.target.pipelineId,
      runId: item.target.runId,
    },
    availability: item.availability,
  };
}
export function personalInboxSnapshot(snapshot, failed, successful, read) {
  fixture(failed, successful);
  assert.ok(
    exactKeys(snapshot, ["list", "nextCursor", "scanIncomplete"]) &&
      Array.isArray(snapshot.list) &&
      snapshot.list.length <= 20 &&
      snapshot.nextCursor === null &&
      snapshot.scanIncomplete === false,
    "Inbox evidence requires one complete bounded snapshot",
  );
  assert.ok(
    snapshot.list.every(
      (row) => exactKeys(row, itemKeys) && identity(row.id),
    ) &&
      new Set(snapshot.list.map((row) => row.id)).size === snapshot.list.length,
    "Inbox snapshot contains invalid or duplicated delivery identities",
  );
  const find = (expected) => {
    const matches = snapshot.list.filter(
      (row) =>
        row.target?.runId === expected.runId && row.kind === "run_result",
    );
    assert.ok(
      matches.length === 1,
      "Inbox must contain exactly one delivery for the verified run",
    );
    return validatePersonalInboxItem(
      matches[0],
      expected,
      expected === successful && read,
    );
  };
  const readEntry = find(successful);
  const unreadEntry = find(failed);
  assert.ok(
    readEntry.id !== unreadEntry.id,
    "Inbox outcomes require distinct deliveries",
  );
  return { readEntry, unreadEntry };
}
export function validatePersonalInboxReceipt(
  value,
  { phase, actorId, failed, successful, previous },
) {
  fixture(failed, successful);
  assert.ok(
    identity(actorId) && ["read", "resume"].includes(phase),
    "Inbox receipt phase or requester is invalid",
  );
  assert.ok(
    exactKeys(value, [
      "journey",
      "phase",
      "completed",
      "steps",
      "userId",
      "readEntry",
      "unreadEntry",
    ]) &&
      value.journey === "personal-inbox-v1" &&
      value.phase === phase &&
      value.completed === true &&
      value.userId === actorId,
    "Inbox receipt is incomplete or belongs to another requester",
  );
  assert.ok(
    same(
      value.steps,
      phase === "read" ? personalInboxReadSteps : personalInboxResumeSteps,
    ),
    "Inbox receipt is missing required stages",
  );
  const readEntry = validatePersonalInboxItem(
    value.readEntry,
    successful,
    true,
  );
  const unreadEntry = validatePersonalInboxItem(
    value.unreadEntry,
    failed,
    false,
  );
  assert.ok(
    readEntry.id !== unreadEntry.id,
    "Inbox outcomes require distinct deliveries",
  );
  if (phase === "resume") {
    const prior = validatePersonalInboxReceipt(previous, {
      phase: "read",
      actorId,
      failed,
      successful,
    });
    assert.ok(
      same(readEntry, prior.readEntry) && same(unreadEntry, prior.unreadEntry),
      "Inbox restart changed persisted delivery/read metadata",
    );
  }
  return {
    journey: "personal-inbox-v1",
    phase,
    completed: true,
    steps: [...value.steps],
    userId: actorId,
    readEntry,
    unreadEntry,
  };
}
async function envelope(response, method, path, origin, noStore = true) {
  const url = new URL(response.url());
  assert.ok(
    response.request().method() === method &&
      url.origin === origin &&
      url.pathname === path &&
      response.status() === 200,
    "Inbox evidence response identity or HTTP status is invalid",
  );
  if (noStore)
    assert.ok(
      /\bno-store\b/i.test((await response.headerValue("cache-control")) ?? ""),
      "Inbox evidence responses must disable caching",
    );
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Inbox evidence response was not valid JSON");
  }
  assert.ok(
    object(body) && body.code === 200,
    "Inbox evidence requires a successful backend envelope",
  );
  return body.detail;
}
/** Observe only requests issued after the new main document commits, never a pre-reload refresh. */
export async function personalInboxResponseAfterNavigation(
  page,
  origin,
  navigate,
) {
  const mainFrame = page.mainFrame();
  const requests = new Set();
  let committed = false;
  const onNavigation = (frame) => {
    if (frame === mainFrame) committed = true;
  };
  const onRequest = (request) => {
    const url = new URL(request.url());
    if (
      committed &&
      request.frame() === mainFrame &&
      request.method() === "GET" &&
      url.origin === origin &&
      url.pathname === "/api/v1/inbox" &&
      url.searchParams.get("filter") === "all" &&
      url.searchParams.get("limit") === "20" &&
      !url.searchParams.has("cursor")
    )
      requests.add(request);
  };
  page.on("framenavigated", onNavigation);
  page.on("request", onRequest);
  try {
    const response = page.waitForResponse(
      (value) => requests.has(value.request()),
      { timeout: 30_000 },
    );
    void response.catch(() => {});
    const [result] = await Promise.all([response, navigate()]);
    return envelope(result, "GET", "/api/v1/inbox", origin);
  } finally {
    page.off("framenavigated", onNavigation);
    page.off("request", onRequest);
  }
}
export async function assertPersonalInboxRunVisible(page, item, read) {
  const row = page.locator(
    `[data-inbox-id="${item.id}"][data-inbox-read="${read ? "true" : "false"}"]`,
  );
  await row.waitFor({ state: "visible" });
  assert.ok(
    (await row.count()) === 1,
    "Inbox UI must identify one exact delivery",
  );
  const title = item.status === "failed" ? "Run failed" : "Run succeeded";
  assert.ok(
    (await row.getByRole("heading", { name: title, exact: true }).count()) ===
      1,
    "Inbox UI title must show the exact verified terminal outcome",
  );
  const time = row.locator("time");
  await time.waitFor({ state: "visible" });
  assert.ok(
    (await time.count()) === 1 &&
      (await time.getAttribute("datetime")) === item.occurredAt,
    "Inbox UI time must show the exact verified occurrence timestamp",
  );
  const expected = `/projects/${encodeURIComponent(item.target.projectId)}/pipelines?${new URLSearchParams({ pipeline: item.target.pipelineId, run: item.target.runId })}`;
  assert.ok(
    (await row
      .getByRole("link", { name: "View run", exact: true })
      .getAttribute("href")) === expected,
    "Inbox UI link must bind the exact verified run",
  );
  assert.ok(
    (await row
      .getByRole("button", { name: "Mark read", exact: true })
      .count()) === (read ? 0 : 1),
    "Inbox UI read control must reflect authoritative state",
  );
  return row;
}
/** profileResponse must be the real GET /users/fetch captured during caller-owned login in this phase. */
export async function runPersonalInboxJourney({
  page,
  base,
  phase,
  actorId,
  failed,
  successful,
  previous,
  profileResponse,
  setStage,
}) {
  fixture(failed, successful);
  assert.ok(
    identity(actorId) && ["read", "resume"].includes(phase),
    "Inbox journey requires an explicit phase and verified requester",
  );
  const origin = new URL(base).origin;
  assert.ok(
    new URL(base).hostname === "127.0.0.1" &&
      ["http:", "https:"].includes(new URL(base).protocol),
    "Inbox browser journey requires the numeric loopback harness",
  );
  assert.ok(
    profileResponse?.request().frame() === page.mainFrame(),
    "Inbox login proof must belong to this browser main frame",
  );
  const profile = await envelope(
    profileResponse,
    "GET",
    "/api/v1/users/fetch",
    origin,
    false,
  );
  assert.ok(
    object(profile) && profile.userId === actorId,
    "Inbox login profile does not match the independently verified requester",
  );
  if (phase === "resume")
    validatePersonalInboxReceipt(previous, {
      phase: "read",
      actorId,
      failed,
      successful,
    });
  let allowedReadPath = null;
  let writes = 0;
  let unexpectedWrite = false;
  const observe = (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || !url.pathname.startsWith("/api/")) return;
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return;
    if (
      request.method() === "POST" &&
      request.frame() === page.mainFrame() &&
      url.pathname === allowedReadPath &&
      !url.search &&
      request.postData() === "{}"
    )
      writes++;
    else unexpectedWrite = true;
  };
  page.on("request", observe);
  try {
    setStage(
      phase === "read" ? "personal-inbox-read" : "personal-inbox-resume",
    );
    const initial = await personalInboxResponseAfterNavigation(
      page,
      origin,
      () => page.goto(`${origin}/inbox?filter=all`),
    );
    const before = personalInboxSnapshot(
      initial,
      failed,
      successful,
      phase === "resume",
    );
    await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor();
    await assertPersonalInboxRunVisible(page, before.unreadEntry, false);
    const successRow = await assertPersonalInboxRunVisible(
      page,
      before.readEntry,
      phase === "resume",
    );
    let final = before;
    if (phase === "read") {
      assert.ok(
        writes === 0 && !unexpectedWrite,
        "Viewing Inbox must not mutate state",
      );
      setStage("personal-inbox-mark-read");
      allowedReadPath = `/api/v1/inbox/${before.readEntry.id}/read`;
      const pending = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.request().frame() === page.mainFrame() &&
          new URL(response.url()).origin === origin &&
          new URL(response.url()).pathname === allowedReadPath,
        { timeout: 30_000 },
      );
      void pending.catch(() => {});
      const button = successRow.getByRole("button", {
        name: "Mark read",
        exact: true,
      });
      await assertControlReachable(button);
      const [response] = await Promise.all([pending, button.click()]);
      const read = await envelope(response, "POST", allowedReadPath, origin);
      assert.ok(
        exactKeys(read, ["id", "readAt"]) &&
          read.id === before.readEntry.id &&
          instant(read.readAt),
        "Explicit read must confirm only the selected delivery",
      );
      await assertPersonalInboxRunVisible(
        page,
        { ...before.readEntry, readAt: read.readAt },
        true,
      );
      setStage("personal-inbox-reload");
      const reloaded = await personalInboxResponseAfterNavigation(
        page,
        origin,
        () => page.reload(),
      );
      final = personalInboxSnapshot(reloaded, failed, successful, true);
      assert.ok(
        same(final.readEntry, { ...before.readEntry, readAt: read.readAt }) &&
          same(final.unreadEntry, before.unreadEntry),
        "Reload must preserve delivery identities/timestamps and only the explicit read change",
      );
      await assertPersonalInboxRunVisible(page, final.readEntry, true);
      await assertPersonalInboxRunVisible(page, final.unreadEntry, false);
    }
    assert.ok(
      !unexpectedWrite && writes === (phase === "read" ? 1 : 0),
      "Inbox journey issued an unexpected or repeated mutation",
    );
    return validatePersonalInboxReceipt(
      {
        journey: "personal-inbox-v1",
        phase,
        completed: true,
        steps: [
          ...(phase === "read"
            ? personalInboxReadSteps
            : personalInboxResumeSteps),
        ],
        userId: actorId,
        ...final,
      },
      { phase, actorId, failed, successful, previous },
    );
  } finally {
    page.off("request", observe);
  }
}
