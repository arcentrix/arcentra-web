/** Shared read-only UI assertions. Actual acceptance supplies real GET responses. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";

export const honestyChecks = Object.freeze([
  "project-settings-match-scoped-response",
  "member-associations-match-scoped-response",
  "secrets-inventory-explicitly-unavailable",
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

export async function assertHonestContent(scope) {
  assert.doesNotMatch(await scope.innerText(), removedClaims);
  assert.equal(
    await scope
      .getByRole("button", {
        name: /^(Save|Archive|Delete|Add|Remove|Mark|Approve|Decline|Recover|Restore)\b/i,
      })
      .count(),
    0,
  );
}

export async function assertSettingsSnapshot(page, project, projectId) {
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
      "Read-only project details. Editing, archiving, and deleting projects are not connected in this view.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await details.getByRole("textbox").count(), 0);
  await assertHonestContent(page.locator("body"));
}

export async function assertMemberSnapshot(page, snapshot, projectId) {
  const rows = memberRows(snapshot, projectId);
  await page
    .getByText(`${rows.length} recorded associations`, { exact: true })
    .waitFor();
  await page
    .getByText(
      /These stored associations do not establish a user's current roles or effective permissions/,
    )
    .waitFor();
  await page
    .getByText(
      "Adding, editing, and removing members are unavailable from this page.",
      { exact: true },
    )
    .waitFor();
  const table = page.getByRole("table", {
    name: "Project member associations",
  });
  if (rows.length) {
    await table.waitFor();
    assert.deepEqual(await table.locator("thead th").allTextContents(), [
      "User ID",
      "Project ID",
    ]);
    assert.deepEqual(
      await table
        .locator("tbody tr")
        .evaluateAll((elements) =>
          elements.map((row) =>
            [...row.querySelectorAll("td")].map((cell) => cell.textContent),
          ),
        ),
      rows,
    );
  } else {
    assert.equal(await table.count(), 0);
    await page
      .getByText(
        "No member associations are recorded for this project. Access may still be granted through role grants.",
        { exact: true },
      )
      .waitFor();
  }
  await assertHonestContent(page.locator("body"));
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

export async function assertUnavailableSecrets(page) {
  await page
    .getByRole("heading", { name: "Project secrets", exact: true })
    .waitFor();
  await page
    .getByText("Project secret management is not connected.", { exact: true })
    .waitFor();
  await page
    .getByText(/No secret inventory has been loaded for this project/)
    .waitFor();
  assert.equal(await page.getByRole("table").count(), 0);
  assert.equal(await page.getByRole("textbox").count(), 0);
  await assertHonestContent(page.locator("body"));
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
}) {
  const start = diagnostics.requests.length;
  const projectId = project.projectId;
  const path = `/projects/${encodeURIComponent(projectId)}`;
  const detail = await readAfter(
    page,
    `/project/${encodeURIComponent(projectId)}`,
    () => page.getByRole("tab", { name: "Settings", exact: true }).click(),
    envelope,
  );
  assert.equal(detail.name, project.name);
  assert.equal(detail.displayName, project.displayName);
  assert.equal(detail.description, project.description);
  assert.equal(detail.orgId, project.orgId);
  assert.equal(detail.repoUrl, project.repoUrl);
  assert.equal(detail.defaultBranch, project.defaultBranch);
  await assertSettingsSnapshot(page, detail, projectId);
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
  await page.getByRole("tab", { name: "Secrets", exact: true }).click();
  await assertUnavailableSecrets(page);
  await honestyMobileScreenshot(
    page,
    output,
    "secrets",
    page.getByRole("tab", { name: "Settings", exact: true }),
  );
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await assertUnavailableInbox(page);
  await honestyMobileScreenshot(
    page,
    output,
    "inbox",
    page.getByRole("link", { name: "Open Build", exact: true }),
  );
  await page.goBack();
  await assertUnavailableSecrets(page);
  await page.goForward();
  await assertUnavailableInbox(page);

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
      /\/(?:secrets|notifications)(?:\/|$)|\/users\/$/.test(request.path),
    ).length,
    0,
    "Unavailable inventory must not query platform secrets, notifications, or global users",
  );
  return honestyChecks;
}
