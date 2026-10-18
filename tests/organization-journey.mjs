/** Actual product APIs through the UI, using only disposable synthetic users/data. */
import assert from "node:assert/strict";
import { assertControlReachable } from "./artifact-controls.mjs";

export const organizationManagementStages = Object.freeze([
  "organization-create",
  "organization-edit",
  "organization-members",
  "organization-project-create",
  "project-members",
  "project-settings-edit",
  "project-settings-archive",
  "project-settings-restore",
  "organization-archive-conflict",
  "project-settings-rearchive",
  "organization-archive",
]);

export const organizationManagementSteps = Object.freeze([
  "organization-created",
  "organization-updated",
  "organization-member-added",
  "organization-role-updated",
  "organization-member-removed",
  "project-created",
  "project-member-added",
  "project-role-updated",
  "project-member-removed",
  "project-settings-updated",
  "project-archived",
  "project-restored",
  "organization-active-project-conflict",
  "project-rearchived",
  "organization-archived",
]);
export function organizationManagementEvidence(evidence) {
  if (!evidence) return {};
  assert.ok(Array.isArray(evidence.steps));
  assert.ok(
    evidence.steps.every((step) => organizationManagementSteps.includes(step)),
  );
  assert.equal(new Set(evidence.steps).size, evidence.steps.length);
  const summary = {
    journey: "organization-members-settings-v1",
    completed: organizationManagementSteps.every((step) =>
      evidence.steps.includes(step),
    ),
    steps: organizationManagementSteps.filter((step) =>
      evidence.steps.includes(step),
    ),
  };
  for (const key of ["orgId", "projectId"]) {
    if (evidence[key] !== undefined) {
      assert.match(evidence[key], /^[a-zA-Z0-9_-]{1,64}$/);
      summary[key] = evidence[key];
    }
  }
  if (summary.completed) {
    assert.ok(summary.orgId);
    assert.ok(summary.projectId);
  }
  return { organizationManagement: summary };
}

export async function runOrganizationJourney({
  page,
  base,
  output,
  config,
  diagnostics,
  responseFor,
  envelope,
  expectHttpError,
  setStage,
  evidence,
}) {
  assert.ok(config.organizationJourney && config.memberUserId);
  const mark = (step) => {
    assert.ok(organizationManagementSteps.includes(step));
    evidence.steps.push(step);
  };
  const write = async (method, path, click) => {
    const response = responseFor(method, path);
    const [result] = await Promise.all([response, click()]);
    return envelope(result);
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const mobile = async (name) => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (name.endsWith("-members")) {
      const heading = page.getByRole("heading", {
        name: "Members",
        exact: true,
      });
      await heading.scrollIntoViewIfNeeded();
      assert.equal(
        await heading.evaluate((node) => node.scrollWidth <= node.clientWidth),
        true,
        "Member heading must remain readable on mobile",
      );
      await button("Refresh members").click();
      await button("Add member").waitFor();
    }
    await page.screenshot({
      path: `${output}/organization-${name}-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
  };
  const countWrites = (path) =>
    diagnostics.requests.filter(
      (request) =>
        request.method === "POST" && request.path === `/api/v1${path}`,
    ).length;
  setStage("organization-create");
  await page.goto(`${base}/organizations`);
  await button("Create organization").waitFor();
  const before = countWrites("/organization");
  await button("Create organization").click();
  await button("Cancel").click();
  assert.equal(countWrites("/organization"), before);
  await button("Create organization").click();
  const name = `browser-org-${Date.now()}`;
  await page.getByLabel("Organization name", { exact: true }).fill(name);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic organization workspace");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Disposable browser membership acceptance");
  await assertControlReachable(button("Create organization"));
  const org = await write("POST", "/organization", () =>
    button("Create organization").click(),
  );
  assert.equal(org.name, name);
  assert.equal(org.isMember, true);
  assert.ok(org.canUpdate && org.canManageMembers && org.canArchive);
  evidence.orgId = org.orgId;
  mark("organization-created");
  const orgPath = `/organizations/${encodeURIComponent(org.orgId)}`;
  const orgAPI = `/organization/${encodeURIComponent(org.orgId)}`;
  await page.waitForURL((url) => url.pathname === orgPath);
  await page
    .getByRole("heading", { name: org.displayName, exact: true })
    .waitFor();
  setStage("organization-edit");
  await button("Edit organization").click();
  assert.equal(
    await page
      .getByLabel("Organization name", { exact: true })
      .getAttribute("readonly"),
    "",
  );
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Updated synthetic organization");
  const updatedOrg = await write("PUT", orgAPI, () =>
    button("Save organization").click(),
  );
  assert.equal(updatedOrg.name, org.name);
  assert.equal(updatedOrg.displayName, "Updated synthetic organization");
  assert.ok(updatedOrg.version > org.version);
  mark("organization-updated");
  await page
    .getByRole("heading", { name: updatedOrg.displayName, exact: true })
    .waitFor();
  await mobile("details");

  async function members(kind, api, role) {
    const label =
      kind === "organization" ? "Organization members" : "Project members";
    const originalCount = Number(
      (await page.getByText(/^\d+ recorded memberships$/).innerText()).split(
        " ",
      )[0],
    );
    await button("Add member").waitFor();
    await button("Add member").click();
    await page.getByLabel("User ID", { exact: true }).fill(config.memberUserId);
    await page
      .getByLabel("Role", { exact: true })
      .selectOption(kind === "organization" ? "org_member" : "project_guest");
    const added = await write("POST", `${api}/members`, () =>
      button("Save membership").click(),
    );
    assert.equal(added.userId, config.memberUserId);
    assert.equal(
      added.roleId,
      kind === "organization" ? "org_member" : "project_guest",
    );
    mark(`${kind}-member-added`);
    const list = page.getByRole("list", { name: label });
    await list.getByText(config.memberUserId, { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: `Edit role for ${config.memberUserId}`,
        exact: true,
      })
      .click();
    await page.getByLabel("Role", { exact: true }).selectOption(role);
    const updated = await write(
      "PUT",
      `${api}/members/${encodeURIComponent(config.memberUserId)}`,
      () => button("Save membership").click(),
    );
    assert.equal(updated.roleId, role);
    assert.ok(updated.version > added.version);
    mark(`${kind}-role-updated`);
    await list.getByText(config.memberUserId, { exact: true }).waitFor();
    await mobile(`${kind}-members`);
    await page
      .getByRole("button", {
        name: `Remove ${config.memberUserId}`,
        exact: true,
      })
      .click();
    await page
      .getByText(/Separate grants can continue to provide access/)
      .waitFor();
    await write(
      "DELETE",
      `${api}/members/${encodeURIComponent(config.memberUserId)}`,
      () => button("Remove membership").click(),
    );
    await page
      .getByText("Membership removed. Other grants may still provide access.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByText(`${originalCount} recorded memberships`, { exact: true })
      .waitFor();
    assert.equal(
      await list.getByText(config.memberUserId, { exact: true }).count(),
      0,
    );
    mark(`${kind}-member-removed`);
  }
  setStage("organization-members");
  await members("organization", orgAPI, "org_admin");

  setStage("organization-project-create");
  await page.goto(`${base}/projects`);
  await button("New project").click();
  const projectName = `member-project-${Date.now()}`;
  await page.getByLabel("Organization ID", { exact: true }).fill(org.orgId);
  await page.getByLabel("Project name", { exact: true }).fill(projectName);
  await page
    .getByLabel("Repository URL", { exact: true })
    .fill(config.repository);
  await page.getByLabel("Default branch", { exact: true }).fill(config.branch);
  const project = await write("POST", "/project/", () =>
    button("Create project").click(),
  );
  assert.equal(project.orgId, org.orgId);
  evidence.projectId = project.projectId;
  mark("project-created");
  const projectPath = `/projects/${encodeURIComponent(project.projectId)}`;
  const projectAPI = `/project/${encodeURIComponent(project.projectId)}`;
  await page.waitForURL((url) => url.pathname === `${projectPath}/pipelines`);
  await page.getByRole("tab", { name: "Members", exact: true }).click();
  setStage("project-members");
  await members("project", projectAPI, "project_developer");
  setStage("project-settings-edit");
  const settingsRead = responseFor("GET", `${projectAPI}/settings`);
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  const original = await envelope(await settingsRead);
  await button("Edit settings").click();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Updated scoped project");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic edited project metadata");
  await page
    .getByLabel("Tags (comma-separated)", { exact: true })
    .fill("browser,synthetic");
  await page.getByLabel("Language", { exact: true }).fill("Go");
  await page.getByLabel("Framework", { exact: true }).fill("stdlib");
  await page
    .getByLabel("Visibility metadata", { exact: true })
    .selectOption("1");
  const edited = await write("PATCH", `${projectAPI}/settings`, () =>
    button("Save changes").click(),
  );
  assert.equal(edited.displayName, "Updated scoped project");
  assert.equal(edited.tags, "browser,synthetic");
  assert.equal(edited.visibility, 1);
  assert.equal(edited.orgId, org.orgId);
  assert.equal(edited.name, projectName);
  assert.notEqual(edited.version, original.version);
  mark("project-settings-updated");
  await page
    .locator('dl[aria-label="Project details"]')
    .getByText("Updated scoped project", { exact: true })
    .waitFor();
  await mobile("project-settings");
  async function lifecycle(mode, step) {
    await button(
      mode === "archive" ? "Archive project" : "Restore project",
    ).click();
    await page
      .getByLabel(`Type ${projectName} to confirm`, { exact: true })
      .fill(projectName);
    const value = await write("POST", `${projectAPI}/settings/${mode}`, () =>
      button(
        mode === "archive" ? "Confirm archive" : "Confirm restore",
      ).click(),
    );
    assert.equal(value.projectId, project.projectId);
    assert.equal(value.canRestore, mode === "archive");
    assert.equal(value.canArchive, mode === "restore");
    await button(
      mode === "archive" ? "Restore project" : "Archive project",
    ).waitFor();
    mark(step);
  }
  setStage("project-settings-archive");
  await lifecycle("archive", "project-archived");
  setStage("project-settings-restore");
  await lifecycle("restore", "project-restored");
  setStage("organization-archive-conflict");
  await page.goto(`${base}${orgPath}`);
  await button("Archive organization").click();
  await page.getByLabel(`Type ${name} to confirm`, { exact: true }).fill(name);
  expectHttpError(`/api/v1${orgAPI}`, 409);
  const conflict = responseFor("DELETE", orgAPI);
  await button("Confirm archive").click();
  assert.equal((await conflict).status(), 409);
  await page
    .getByRole("alert")
    .getByText(/Archive active projects first/)
    .waitFor();
  await button("Cancel").click();
  mark("organization-active-project-conflict");
  setStage("project-settings-rearchive");
  await page.goto(`${base}${projectPath}/settings`);
  await lifecycle("archive", "project-rearchived");
  setStage("organization-archive");
  await page.goto(`${base}${orgPath}`);
  await button("Archive organization").click();
  await page.getByLabel(`Type ${name} to confirm`, { exact: true }).fill(name);
  const directoryRead = responseFor("GET", "/organization");
  await write("DELETE", orgAPI, () => button("Confirm archive").click());
  const remaining = await envelope(await directoryRead);
  assert.equal(
    remaining.list.some((item) => item.orgId === org.orgId),
    false,
  );
  await page.waitForURL((url) => url.pathname === "/organizations");
  await button("Refresh organizations").waitFor();
  await page
    .getByText(`${remaining.total} organizations`, { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: updatedOrg.displayName, exact: true })
      .count(),
    0,
  );
  mark("organization-archived");
  return organizationManagementEvidence(evidence).organizationManagement;
}
