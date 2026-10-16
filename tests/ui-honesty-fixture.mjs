/** Explicit simulated transport for the five read-only/unavailable UI routes. */
import assert from "node:assert/strict";
import {
  assertAgentSnapshot,
  assertHonestContent,
  assertMemberSnapshot,
  assertSettingsSnapshot,
  readAfter,
  runHonestyJourney,
} from "./ui-honesty-journey.mjs";

// These signatures come from AgentHealth and Build's existing AgentReadiness.
// Classify the immutable request, never the page's URL after navigation.
export function agentFixtureConsumer(request) {
  assert.equal(request.method(), "GET");
  const url = new URL(request.url());
  assert.equal(url.pathname, "/api/v1/agent");
  const pageSize = url.searchParams.get("pageSize");
  assert.ok(["20", "100"].includes(pageSize), "Unknown Agent fixture consumer");
  assert.deepEqual(
    [...url.searchParams].sort(),
    [
      ["pageNum", "1"],
      ["pageSize", pageSize],
    ],
    "Agent fixture pagination must match an exact known request",
  );
  return pageSize === "20" ? "dashboard-health" : "build-readiness";
}

export function honestyFixture(project) {
  const secondProject = {
    ...project,
    projectId: "project-2",
    orgId: "org-2",
    name: "isolated-service",
    displayName: "Isolated service",
    description: "Separate project metadata fixture",
    defaultBranch: "release",
  };
  const state = {
    active: false,
    settingsDenied: false,
    memberMode: "normal",
    memberPermission: true,
    agentDenied: false,
    agentPermission: true,
    memberReads: 0,
    agentReads: 0,
    permissionScopes: [],
  };
  const agents = {
    agents: [
      {
        agentId: "honesty-runner-1",
        agentName: "Recorded busy runner",
        status: 3,
        isEnabled: 1,
        os: "linux",
        arch: "amd64",
        version: "fixture-v1",
        lastHeartbeat: null,
      },
      {
        agentId: "honesty-runner-2",
        agentName: "Recorded disabled runner",
        status: 2,
        isEnabled: 0,
        os: "linux",
        arch: "arm64",
        version: "fixture-v2",
        lastHeartbeat: null,
      },
    ],
    // The deliberately different registered total catches accidental global
    // extrapolation of status counts from this two-row page.
    count: 37,
    pageNum: 1,
    pageSize: 20,
  };
  const memberships = (projectId) => ({
    list: [
      {
        projectId,
        userId:
          projectId === project.projectId
            ? "association-user-1"
            : "association-user-2",
      },
    ],
    total: 1,
  });
  return {
    state,
    project,
    secondProject,
    agents,
    memberships,
    async route(route) {
      if (!state.active) return false;
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/v1", "");
      const ok = async (detail) => {
        await route.fulfill({ json: { code: 200, detail } });
        return true;
      };
      const denied = async () => {
        await route.fulfill({
          status: 403,
          json: { code: 403, errMsg: "Synthetic read permission revoked" },
        });
        return true;
      };
      if (path === "/me/effective-actions") {
        const scopeType = url.searchParams.get("scopeType");
        const scopeId = url.searchParams.get("scopeId");
        if (scopeType === "project") {
          // Global Build uses useScopedPermission("project", undefined).
          // Its in-flight check must keep the original transport response too.
          if (!scopeId) return false;
          assert.ok(
            [project.projectId, secondProject.projectId].includes(scopeId),
          );
          state.permissionScopes.push({ scopeType, scopeId });
          // Preserve the existing admin fixture for PipelineWorkspace and
          // Members alike; only the explicit denial case changes permission.
          return state.memberPermission ? false : ok(["project:read"]);
        }
        if (scopeType === "platform") {
          assert.ok(
            !scopeId,
            "Platform fleet permission must not use a project scope",
          );
          state.permissionScopes.push({ scopeType });
          return state.agentPermission ? false : ok(["pipeline:read"]);
        }
        return false;
      }
      if (path === "/agent") {
        if (agentFixtureConsumer(request) === "build-readiness") return false;
        state.agentReads++;
        return state.agentDenied ? denied() : ok(agents);
      }
      for (const item of [project, secondProject]) {
        if (path === `/project/${item.projectId}`) {
          assert.equal(request.method(), "GET");
          return state.settingsDenied ? denied() : ok(item);
        }
        if (path === `/project/${item.projectId}/members`) {
          assert.equal(request.method(), "GET");
          state.memberReads++;
          if (state.memberMode === "denied") return denied();
          if (state.memberMode === "empty") return ok({ list: null, total: 0 });
          if (state.memberMode === "foreign")
            return ok(memberships("foreign-project"));
          return ok(memberships(item.projectId));
        }
      }
      return false;
    },
  };
}

export async function assertHonestyFixtureUI({
  page,
  base,
  output,
  diagnostics,
  expectHttpError,
  setStage,
  honesty,
}) {
  setStage("fixture-regression");
  honesty.state.active = true;
  const envelope = async (response) => {
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.code, 200);
    return body.detail;
  };
  const denied = async (response) => {
    assert.equal(response.status(), 403);
    const body = await response.json();
    assert.equal(body.code, 403);
  };
  const { project, secondProject, state } = honesty;
  const path = `/projects/${project.projectId}`;
  const start = diagnostics.requests.length;
  await page.goto(`${base}${path}/pipelines`);
  await page
    .getByRole("button", { name: "New pipeline", exact: true })
    .waitFor();
  assert.equal(
    (
      await runHonestyJourney({
        page,
        base,
        output,
        diagnostics,
        project,
        envelope,
      })
    ).length,
    6,
  );

  // Settings refresh hides its own snapshot on 403; the surrounding project
  // header has a separate resource and is not a global revocation mechanism.
  const settings = await readAfter(
    page,
    `/project/${project.projectId}`,
    () => page.getByRole("tab", { name: "Settings", exact: true }).click(),
    envelope,
  );
  await assertSettingsSnapshot(page, settings, project.projectId);
  expectHttpError(`/api/v1/project/${project.projectId}`, 403);
  state.settingsDenied = true;
  await readAfter(
    page,
    `/project/${project.projectId}`,
    () => page.getByRole("button", { name: "Refresh settings" }).click(),
    denied,
  );
  await page
    .getByRole("heading", { name: "Project settings access restricted" })
    .waitFor();
  assert.equal(
    await page.locator('dl[aria-label="Project details"]').count(),
    0,
  );
  state.settingsDenied = false;
  const restored = await readAfter(
    page,
    `/project/${project.projectId}`,
    () => page.getByRole("button", { name: "Refresh settings" }).click(),
    envelope,
  );
  await assertSettingsSnapshot(page, restored, project.projectId);

  // Route identity changes must display only the second project's details.
  const secondSettings = await readAfter(
    page,
    `/project/${secondProject.projectId}`,
    () => page.goto(`${base}/projects/${secondProject.projectId}/settings`),
    envelope,
  );
  await assertSettingsSnapshot(page, secondSettings, secondProject.projectId);
  assert.doesNotMatch(
    await page.locator('dl[aria-label="Project details"]').innerText(),
    /Core API build pipeline|project-1|org-1/,
  );
  const secondMembers = await readAfter(
    page,
    `/project/${secondProject.projectId}/members`,
    () => page.getByRole("tab", { name: "Members", exact: true }).click(),
    envelope,
  );
  await assertMemberSnapshot(page, secondMembers, secondProject.projectId);
  assert.equal(
    await page.getByText("association-user-1", { exact: true }).count(),
    0,
  );
  const members = await readAfter(
    page,
    `/project/${project.projectId}/members`,
    () => page.goto(`${base}${path}/members`),
    envelope,
  );
  await assertMemberSnapshot(page, members, project.projectId);

  expectHttpError(`/api/v1/project/${project.projectId}/members`, 403);
  state.memberMode = "denied";
  await readAfter(
    page,
    `/project/${project.projectId}/members`,
    () => page.getByRole("button", { name: "Refresh members" }).click(),
    denied,
  );
  await page
    .getByRole("heading", { name: "Member associations access restricted" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: "Project member associations" })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("association-user-1", { exact: true }).count(),
    0,
  );
  state.memberMode = "normal";
  const reloaded = await readAfter(
    page,
    `/project/${project.projectId}/members`,
    () => page.getByRole("button", { name: "Refresh members" }).click(),
    envelope,
  );
  await assertMemberSnapshot(page, reloaded, project.projectId);

  state.memberPermission = false;
  const beforeRestrictedMembers = state.memberReads;
  await page.getByRole("button", { name: "Refresh members" }).click();
  await page
    .getByRole("heading", { name: "Members access restricted" })
    .waitFor();
  assert.equal(
    state.memberReads,
    beforeRestrictedMembers,
    "Project read alone must not fetch members",
  );
  assert.equal(
    await page
      .getByRole("table", { name: "Project member associations" })
      .count(),
    0,
  );
  state.memberPermission = true;
  state.memberMode = "empty";
  const empty = await readAfter(
    page,
    `/project/${project.projectId}/members`,
    () => page.getByRole("button", { name: "Refresh members" }).click(),
    envelope,
  );
  await assertMemberSnapshot(page, empty, project.projectId);
  state.memberMode = "foreign";
  await readAfter(
    page,
    `/project/${project.projectId}/members`,
    () => page.getByRole("button", { name: "Refresh members" }).click(),
    envelope,
  );
  await page
    .getByRole("heading", { name: "Member associations unavailable" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: "Project member associations" })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("foreign-project", { exact: true }).count(),
    0,
  );
  state.memberMode = "normal";

  const agents = await readAfter(
    page,
    "/agent",
    () => page.goto(`${base}/`),
    envelope,
    { pageNum: "1", pageSize: "20" },
  );
  await assertAgentSnapshot(page, agents);
  expectHttpError("/api/v1/agent", 403);
  state.agentDenied = true;
  await readAfter(
    page,
    "/agent",
    () => page.getByRole("button", { name: "Refresh snapshot" }).click(),
    denied,
    { pageNum: "1", pageSize: "20" },
  );
  await page
    .getByRole("heading", { name: "Agent health access restricted" })
    .waitFor();
  assert.equal(
    await page.getByRole("table", { name: "Agent health" }).count(),
    0,
  );
  assert.equal(await page.getByText(/registered agents ·/).count(), 0);
  state.agentDenied = false;
  const restoredAgents = await readAfter(
    page,
    "/agent",
    () => page.getByRole("button", { name: "Refresh snapshot" }).click(),
    envelope,
    { pageNum: "1", pageSize: "20" },
  );
  await assertAgentSnapshot(page, restoredAgents);
  state.agentPermission = false;
  const beforeRestrictedAgents = state.agentReads;
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await page
    .getByText(/Agent health requires platform agent:read permission/)
    .waitFor();
  assert.equal(
    state.agentReads,
    beforeRestrictedAgents,
    "Pipeline permission alone must not fetch fleet data",
  );
  assert.equal(
    await page.getByRole("table", { name: "Agent health" }).count(),
    0,
  );
  assert.equal(await page.getByText(/registered agents ·/).count(), 0);
  await assertHonestContent(page.locator("body"));
  for (const projectId of [project.projectId, secondProject.projectId])
    assert.ok(
      state.permissionScopes.some(
        (scope) => scope.scopeType === "project" && scope.scopeId === projectId,
      ),
    );
  assert.ok(
    state.permissionScopes.some((scope) => scope.scopeType === "platform"),
  );
  assert.equal(
    diagnostics.requests
      .slice(start)
      .filter((request) => !["GET", "HEAD", "OPTIONS"].includes(request.method))
      .length,
    0,
    "All honesty and denial checks remain read only",
  );
  state.active = false;
}
