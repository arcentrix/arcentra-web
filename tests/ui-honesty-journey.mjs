/** Shared read-only UI assertions. Actual acceptance supplies real GET responses. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";

export const honestyChecks = Object.freeze([
  "project-settings-match-scoped-response",
  "member-associations-match-scoped-response",
  "secrets-inventory-matches-scoped-response",
  "inbox-history-explicitly-unavailable",
  "dashboard-agent-page-matches-response",
  "readonly-navigation-and-mobile-layout",
]);

export function memberRows(snapshot, projectId) {
  assert.ok(snapshot && typeof snapshot === "object");
  assert.ok(Array.isArray(snapshot.list) || snapshot.list === null);
  const rows = snapshot.list ?? [];
  assert.equal(snapshot.total, rows.length);
  const users = new Set();
  return rows.map((row) => {
    assert.equal(
      row.projectId,
      projectId,
      "Member must belong to routed project",
    );
    assert.equal(typeof row.userId, "string");
    assert.ok(row.userId.trim());
    assert.equal(users.has(row.userId), false, "Member IDs must be unique");
    users.add(row.userId);
    return [row.userId, row.projectId];
  });
}

export function agentPageSummary(snapshot) {
  assert.ok(Array.isArray(snapshot.agents));
  assert.ok(
    Number.isSafeInteger(snapshot.count) &&
      snapshot.count >= snapshot.agents.length,
  );
  const rows = snapshot.agents;
  const available = rows.filter(
    (row) => row.isEnabled === 1 && [1, 4].includes(row.status),
  ).length;
  const busy = rows.filter(
    (row) => row.isEnabled === 1 && row.status === 3,
  ).length;
  const offline = rows.filter((row) => row.status === 2).length;
  const disabled = rows.filter((row) => row.isEnabled === 0).length;
  return [
    `${snapshot.count} registered agents · ${rows.length} loaded on this page`,
    `${available} available · ${busy} busy · ${offline} offline · ${disabled} disabled on this page`,
  ];
}

const shown = (value) =>
  typeof value === "string" && value.trim() ? value : "Not provided";
export function projectDetailRows(project, projectId) {
  assert.equal(
    project.projectId,
    projectId,
    "Settings response must match routed project",
  );
  // Both acceptance transports use a public, non-credentialed repository URL.
  const repository = new URL(project.repoUrl);
  assert.equal(repository.username, "");
  assert.equal(repository.password, "");
  assert.equal(repository.search, "");
  assert.equal(repository.hash, "");
  return [
    ["Project ID", projectId],
    ["Scope ID", shown(project.orgId)],
    ["Project name", shown(project.name)],
    ["Display name", shown(project.displayName)],
    ["Description", shown(project.description)],
    [
      "Linked repository",
      `${repository.protocol}//${repository.host}${repository.pathname}`,
    ],
    ["Default branch", shown(project.defaultBranch)],
  ];
}

const removedClaims =
  /John Doe|Jane Smith|Bob Johnson|Alice Brown|Charlie Wilson|Diana Prince|john@example\.com|jane@example\.com|mark\.weber|ml-inference|STRIPE_SECRET|runner-29|j\.park|API_KEY|DATABASE_URL|SECRET_TOKEN|AWS_ACCESS_KEY|GITHUB_TOKEN|SLACK_WEBHOOK|All caught up|No notifications|No secrets match|0 keys|\b\d+\s+(?:unread|notifications|keys)\b|all envs|undone within 7 days|github\.com\/arcentrix\/project|cluster · running|94\.2%|8m 42s|2\.4h|MTTR|Queue Length|capacity available|Healthy/;

export async function assertNoInventedClaims(scope) {
  assert.doesNotMatch(await scope.innerText(), removedClaims);
}

export async function assertHonestContent(scope) {
  await assertNoInventedClaims(scope);
  assert.equal(
    await scope
      .getByRole("button", {
        name: /^(Save|Archive|Delete|Add|Remove|Mark|Approve|Decline|Recover|Restore)\b/i,
      })
      .count(),
    0,
  );
}

export async function assertSettingsSnapshot(
  page,
  project,
  projectId,
  settings,
) {
  await page
    .getByRole("heading", { name: "Project settings", exact: true })
    .waitFor();
  const details = page.locator('dl[aria-label="Project details"]');
  await details.waitFor();
  assert.deepEqual(
    await details
      .locator(":scope > div")
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.querySelector("dt").textContent,
          row.querySelector("dd").textContent,
        ]),
      ),
    projectDetailRows(project, projectId),
  );
  await page
    .getByText(
      "Review project details, edit supported metadata, or archive and restore this project when your current permissions allow it.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await details.getByRole("textbox").count(), 0);
  assert.equal(settings.projectId, projectId);
  await page.locator('dl[aria-label="Project metadata"]').waitFor();
  for (const [name, allowed] of [
    ["Edit settings", settings.canUpdate],
    ["Archive project", settings.canArchive],
    ["Restore project", settings.canRestore],
  ]) {
    assert.equal(typeof allowed, "boolean");
    assert.equal(
      await page.getByRole("button", { name, exact: true }).count(),
      allowed ? 1 : 0,
    );
  }
  await assertNoInventedClaims(page.locator("body"));
}

export async function assertMemberSnapshot(page, snapshot, projectId) {
  const rows = memberRows(snapshot, projectId);
  await page
    .getByText(`${rows.length} recorded memberships`, { exact: true })
    .waitFor();
  await page
    .getByText(
      /Other direct, team, or inherited grants may still provide access/,
    )
    .waitFor();
  assert.equal(typeof snapshot.canManageMembers, "boolean");
  assert.equal(typeof snapshot.canAssignOwner, "boolean");
  assert.ok(Array.isArray(snapshot.assignableRoleIds));
  assert.equal(
    new Set(snapshot.assignableRoleIds).size,
    snapshot.assignableRoleIds.length,
  );
  for (const role of snapshot.assignableRoleIds)
    assert.ok(
      [
        "project_owner",
        "project_maintainer",
        "project_developer",
        "project_reporter",
        "project_guest",
      ].includes(role),
    );
  const list = page.getByRole("list", { name: "Project members" });
  if (rows.length) {
    await list.waitFor();
    const expected = snapshot.list.map((member) => {
      assert.equal(typeof member.username, "string");
      assert.equal(typeof member.displayName, "string");
      assert.ok(
        [
          "",
          "project_owner",
          "project_maintainer",
          "project_developer",
          "project_reporter",
          "project_guest",
        ].includes(member.roleId),
      );
      assert.ok(Number.isSafeInteger(member.version) && member.version >= 1);
      assert.equal(typeof member.hasOtherAccess, "boolean");
      assert.equal(typeof member.isProtectedOwner, "boolean");
      const role = member.roleId
        ? member.roleId
            .replace(/^project_/, "")
            .replace(/^./, (letter) => letter.toUpperCase())
        : "No managed role";
      return [
        member.displayName || member.username || "Member",
        member.userId,
        role,
        ...(member.isProtectedOwner ? ["Protected owner"] : []),
        ...(member.hasOtherAccess
          ? ["Other direct or inherited grants may remain"]
          : []),
      ];
    });
    assert.deepEqual(
      await list
        .locator(":scope > li")
        .evaluateAll((items) =>
          items.map((item) =>
            [...item.querySelectorAll(":scope > div:first-child > p")].map(
              (p) => p.textContent,
            ),
          ),
        ),
      expected,
    );
    for (const member of snapshot.list)
      for (const label of [
        `Edit role for ${member.userId}`,
        `Remove ${member.userId}`,
      ])
        assert.equal(
          await list.getByRole("button", { name: label, exact: true }).count(),
          snapshot.canManageMembers &&
            !member.isProtectedOwner &&
            (!member.roleId.endsWith("_owner") || snapshot.canAssignOwner) &&
            (!label.startsWith("Edit role") ||
              snapshot.assignableRoleIds.length > 0)
            ? 1
            : 0,
        );
  } else {
    assert.equal(await list.count(), 0);
    await page
      .getByText(
        "No memberships are recorded for this scope. Other grants may still provide access.",
        { exact: true },
      )
      .waitFor();
  }
  assert.equal(
    await page.getByRole("button", { name: "Add member", exact: true }).count(),
    snapshot.canManageMembers && snapshot.assignableRoleIds.length > 0 ? 1 : 0,
  );
  await assertNoInventedClaims(page.locator("body"));
}

export async function assertAgentSnapshot(page, snapshot) {
  assert.equal(snapshot.pageNum, 1);
  assert.equal(snapshot.pageSize, 20);
  await page
    .getByRole("heading", { name: "Control Plane", exact: true })
    .waitFor();
  for (const text of agentPageSummary(snapshot))
    await page.getByText(text, { exact: true }).waitFor();
  const table = page.getByRole("table", { name: "Agent health" });
  if (snapshot.agents.length) {
    await table.waitFor();
    assert.equal(
      await table.locator("tbody tr").count(),
      snapshot.agents.length,
    );
    assert.deepEqual(
      await table.locator("tbody tr td:first-child p").allTextContents(),
      snapshot.agents.map((agent) => agent.agentId),
    );
    assert.deepEqual(
      await table.locator("tbody tr td:first-child a").allTextContents(),
      snapshot.agents.map((agent) => agent.agentName || agent.agentId),
    );
    const expectedCells = await page.evaluate(
      (agents) =>
        agents.map((agent) => [
          { 0: "unknown", 1: "online", 2: "offline", 3: "busy", 4: "idle" }[
            agent.status
          ] ?? "unknown",
          agent.isEnabled === 1
            ? "Enabled"
            : agent.isEnabled === 0
              ? "Disabled"
              : "Unknown",
          agent.lastHeartbeat &&
          !Number.isNaN(new Date(agent.lastHeartbeat).getTime())
            ? new Date(agent.lastHeartbeat).toLocaleString()
            : "Not reported",
          `${agent.os || "—"} / ${agent.arch || "—"}`,
          agent.version || "—",
        ]),
      snapshot.agents,
    );
    assert.deepEqual(
      await table
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) =>
            [...row.querySelectorAll("td")]
              .slice(1)
              .map((cell) => cell.textContent),
          ),
        ),
      expectedCells,
    );
  } else {
    await page
      .getByText("No registered agents yet.", { exact: true })
      .waitFor();
    assert.equal(await table.count(), 0);
  }
  for (const [name, href] of [
    ["Open Build", "/build"],
    ["Open Deploy", "/deploy"],
    ["Open Observe", "/observe"],
    ["View projects", "/projects"],
  ]) {
    assert.equal(
      await page
        .getByRole("navigation", { name: "Workspace tools" })
        .getByRole("link", { name, exact: true })
        .getAttribute("href"),
      href,
    );
  }
  await assertHonestContent(page.locator("body"));
}

export async function assertSecretSnapshot(page, snapshot, projectId) {
  assert.equal(snapshot.projectId, projectId);
  assert.ok(Array.isArray(snapshot.list) || snapshot.list === null);
  assert.equal(snapshot.total, (snapshot.list ?? []).length);
  await page
    .getByRole("heading", { name: "Project secrets", exact: true })
    .waitFor();
  await page
    .getByText(
      `${snapshot.total} recorded ${snapshot.total === 1 ? "secret" : "secrets"}`,
      { exact: true },
    )
    .waitFor();
  if (!snapshot.total)
    await page
      .getByText("No secrets are recorded for this project.", { exact: true })
      .waitFor();
  for (const row of snapshot.list ?? []) {
    assert.equal(row.projectId, projectId);
    assert.equal(Object.hasOwn(row, "value"), false);
    assert.equal(Object.hasOwn(row, "encryptedValue"), false);
    await page.getByRole("heading", { name: row.name, exact: true }).waitFor();
  }
  assert.equal(await page.getByRole("dialog").count(), 0);
  await assertHonestContent(page.locator("body"));
}

/** Inbox has real unread counts and explicit read controls; legacy placeholder bans do not apply. */
export async function assertPersonalInboxContent(scope) {
  const fabricated =
    /mark\.weber|ml-inference|STRIPE_SECRET|runner-29|j\.park|API_KEY|DATABASE_URL|SECRET_TOKEN|AWS_ACCESS_KEY|GITHUB_TOKEN|SLACK_WEBHOOK|All caught up|No notifications|Inbox is not connected/;
  assert.ok(
    !fabricated.test(await scope.innerText()),
    "Inbox must not display fabricated or sensitive placeholder content",
  );
  assert.equal(
    await scope
      .getByRole("button", {
        name: /^(Approve|Reject|Retry|Deploy|Send|Mark all|Delete)\b/i,
      })
      .count(),
    0,
  );
}

/** Refresh and consume both actual endpoint bodies before checking displayed state. */
export async function assertPersonalInboxShell(page) {
  await page
    .getByRole("heading", { name: "Personal inbox", exact: true })
    .waitFor();
  await page
    .getByText(/Historical and automatic runs are not backfilled/)
    .waitFor();
  await page.getByText(/Email and chat delivery are not supported/).waitFor();
  await page.getByRole("group", { name: "Inbox filter" }).waitFor();
  const requests = new Set();
  const origin = new URL(page.url()).origin;
  const observe = (request) => {
    const url = new URL(request.url());
    if (
      request.method() === "GET" &&
      request.frame() === page.mainFrame() &&
      url.origin === origin &&
      ["/api/v1/inbox", "/api/v1/inbox/unread-count"].includes(url.pathname)
    )
      requests.add(request);
  };
  page.on("request", observe);
  let snapshot, count;
  try {
    const pending = ["/api/v1/inbox", "/api/v1/inbox/unread-count"].map(
      (path) =>
        page
          .waitForResponse(
            (response) =>
              requests.has(response.request()) &&
              new URL(response.url()).pathname === path,
            { timeout: 30_000 },
          )
          .then(async (response) => {
            assert.ok(
              response.status() === 200,
              "Inbox refresh must return actual successful endpoint responses",
            );
            let body;
            try {
              body = await response.json();
            } catch {
              throw new Error("Inbox refresh must return a valid envelope");
            }
            assert.ok(
              body?.code === 200,
              "Inbox refresh envelope must succeed",
            );
            return body.detail;
          }),
    );
    pending.forEach((promise) => {
      void promise.catch(() => {});
    });
    [snapshot, count] = await Promise.all([
      ...pending,
      page.getByRole("button", { name: "Refresh", exact: true }).click(),
    ]);
  } finally {
    page.off("request", observe);
  }
  assert.ok(
    Array.isArray(snapshot?.list) && snapshot.list.length <= 20,
    "Inbox page must return a bounded real list",
  );
  const ids = snapshot.list.map((row) => row.id);
  assert.ok(
    ids.every(
      (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id),
    ) && new Set(ids).size === ids.length,
    "Inbox returned invalid or duplicate delivery identities",
  );
  assert.ok(
    Number.isSafeInteger(count?.count) &&
      count.count >= 0 &&
      count.count <= 99 &&
      typeof count.capped === "boolean" &&
      typeof count.incomplete === "boolean" &&
      (!count.capped || count.count === 99),
    "Inbox count must use the real bounded count contract",
  );
  const label =
    count.incomplete && count.count === 0
      ? "Unread count unavailable"
      : count.capped
        ? "99+ unread"
        : count.incomplete
          ? `At least ${count.count} unread`
          : `${count.count} unread`;
  await page.getByText(label, { exact: true }).waitFor();
  await page
    .getByText("Loading inbox…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    (expected) =>
      JSON.stringify(
        [...document.querySelectorAll("[data-inbox-id]")].map((row) => ({
          id: row.getAttribute("data-inbox-id"),
          read: row.getAttribute("data-inbox-read"),
        })),
      ) === JSON.stringify(expected),
    snapshot.list.map((row) => ({
      id: row.id,
      read: row.readAt === null ? "false" : "true",
    })),
  );
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "Inbox refresh must not leave an error state",
  );
  await assertPersonalInboxContent(page.locator("body"));
}

export async function assertUnavailableInbox(page) {
  await page
    .getByRole("heading", { name: "Inbox is not connected", exact: true })
    .waitFor();
  await page
    .getByText(/This does not indicate whether you have pending approvals/)
    .waitFor();
  for (const [name, href] of [
    ["Open Build", "/build"],
    ["Open Deploy", "/deploy"],
  ]) {
    assert.equal(
      await page
        .getByRole("navigation", { name: "Approval workflows" })
        .getByRole("link", { name, exact: true })
        .getAttribute("href"),
      href,
    );
  }
  assert.equal(await page.getByRole("table").count(), 0);
  assert.equal(await page.getByRole("tab").count(), 0);
  await assertHonestContent(page.locator("body"));
}

export async function honestyMobileScreenshot(page, output, label, control) {
  await page.setViewportSize({ width: 390, height: 844 });
  if (control) await assertControlReachable(control);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Honesty page must fit mobile viewport",
  );
  await page.screenshot({
    path: `${output}/honesty-${label}-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
}

/** Read the whole body before any later navigation can discard its resource. */
export async function readAfter(page, path, action, envelope, query = {}) {
  const pending = page
    .waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          response.request().method() === "GET" &&
          url.pathname === `/api/v1${path}` &&
          Object.entries(query).every(
            ([key, value]) => url.searchParams.get(key) === value,
          )
        );
      },
      { timeout: 30_000 },
    )
    .then(envelope);
  const [detail] = await Promise.all([pending, action()]);
  return detail;
}

export async function runHonestyJourney({
  page,
  base,
  output,
  project,
  envelope,
  diagnostics,
  personalInbox = false,
}) {
  const checkInbox = personalInbox
    ? assertPersonalInboxShell
    : assertUnavailableInbox;
  const start = diagnostics.requests.length;
  const projectId = project.projectId;
  const path = `/projects/${encodeURIComponent(projectId)}`;
  let narrowSettings;
  const detail = await readAfter(
    page,
    `/project/${encodeURIComponent(projectId)}`,
    async () => {
      narrowSettings = await readAfter(
        page,
        `/project/${encodeURIComponent(projectId)}/settings`,
        () => page.getByRole("tab", { name: "Settings", exact: true }).click(),
        envelope,
      );
    },
    envelope,
  );
  assert.equal(detail.name, project.name);
  assert.equal(detail.displayName, project.displayName);
  assert.equal(detail.description, project.description);
  assert.equal(detail.orgId, project.orgId);
  assert.equal(detail.repoUrl, project.repoUrl);
  assert.equal(detail.defaultBranch, project.defaultBranch);
  await assertSettingsSnapshot(page, detail, projectId, narrowSettings);
  await honestyMobileScreenshot(
    page,
    output,
    "settings",
    page.getByRole("button", { name: "Refresh settings" }),
  );

  const members = await readAfter(
    page,
    `/project/${encodeURIComponent(projectId)}/members`,
    () => page.getByRole("tab", { name: "Members", exact: true }).click(),
    envelope,
  );
  await assertMemberSnapshot(page, members, projectId);
  await honestyMobileScreenshot(
    page,
    output,
    "members",
    page.getByRole("button", { name: "Refresh members" }),
  );
  const secrets = await readAfter(
    page,
    `/project/${encodeURIComponent(projectId)}/secrets`,
    () => page.getByRole("tab", { name: "Secrets", exact: true }).click(),
    envelope,
  );
  await assertSecretSnapshot(page, secrets, projectId);
  await honestyMobileScreenshot(
    page,
    output,
    "secrets",
    page.getByRole("tab", { name: "Settings", exact: true }),
  );
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await checkInbox(page);
  await honestyMobileScreenshot(
    page,
    output,
    "inbox",
    personalInbox
      ? page.getByRole("button", { name: "Refresh", exact: true })
      : page.getByRole("link", { name: "Open Build", exact: true }),
  );
  await page.goBack();
  await assertSecretSnapshot(page, secrets, projectId);
  await page.goForward();
  await checkInbox(page);

  const agents = await readAfter(
    page,
    "/agent",
    () => page.goto(`${base}/`),
    envelope,
    { pageNum: "1", pageSize: "20" },
  );
  await assertAgentSnapshot(page, agents);
  await honestyMobileScreenshot(
    page,
    output,
    "dashboard",
    page.getByRole("button", { name: "Refresh snapshot" }),
  );
  await page.getByRole("link", { name: "View projects", exact: true }).click();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await page.goto(`${base}${path}/pipelines`);
  await page
    .getByRole("button", { name: "New pipeline", exact: true })
    .waitFor();
  const reads = diagnostics.requests.slice(start);
  assert.equal(
    reads.filter(
      (request) => !["GET", "HEAD", "OPTIONS"].includes(request.method),
    ).length,
    0,
    "Honesty navigation must not mutate state",
  );
  assert.equal(
    reads.filter((request) =>
      /^\/api\/v1\/secrets(?:\/|$)|\/notifications(?:\/|$)|\/users\/$/.test(
        request.path,
      ),
    ).length,
    0,
    "Unavailable inventory must not query platform secrets, notifications, or global users",
  );
  return personalInbox
    ? honestyChecks.map((check) =>
        check === "inbox-history-explicitly-unavailable"
          ? "personal-inbox-shell-scoped-transport"
          : check,
      )
    : honestyChecks;
}
