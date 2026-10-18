import { del, get, post, put } from "../client";
export type MemberScope = "org" | "project";
export interface ScopedMember {
  userId: string;
  username: string;
  displayName: string;
  roleId: string;
  version: number;
  hasOtherAccess: boolean;
  isProtectedOwner: boolean;
  orgId?: string;
  projectId?: string;
}
export interface MemberList {
  list: ScopedMember[];
  total: number;
  canManageMembers: boolean;
  canAssignOwner: boolean;
  assignableRoleIds: string[];
}
export const memberRoles = {
  org: ["org_owner", "org_admin", "org_member"],
  project: [
    "project_owner",
    "project_maintainer",
    "project_developer",
    "project_reporter",
    "project_guest",
  ],
} as const;
export const roleLabel = (role: string) =>
  role
    ? role
        .replace(/^(org|project)_/, "")
        .replace(/^./, (letter) => letter.toUpperCase())
    : "No managed role";
const path = (scope: MemberScope, id: string) => {
  if (!id.trim()) throw new Error("A scope ID is required.");
  return `/${scope === "org" ? "organization" : "project"}/${encodeURIComponent(id)}/members`;
};
export async function listScopedMembers(
  scope: MemberScope,
  id: string,
  signal?: AbortSignal,
): Promise<MemberList> {
  const invalid = () => new Error("Scoped members could not be verified.");
  const value = await get<unknown>(path(scope, id), {
    signal,
    silence: true,
    redactErrors: true,
  });
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  const data = value as Record<string, unknown>;
  if (
    (data.list !== null && !Array.isArray(data.list)) ||
    !Number.isSafeInteger(data.total) ||
    typeof data.canManageMembers !== "boolean" ||
    typeof data.canAssignOwner !== "boolean" ||
    !Array.isArray(data.assignableRoleIds) ||
    data.assignableRoleIds.some(
      (role) =>
        typeof role !== "string" ||
        !(memberRoles[scope] as readonly string[]).includes(role),
    ) ||
    new Set(data.assignableRoleIds).size !== data.assignableRoleIds.length ||
    (!data.canAssignOwner &&
      data.assignableRoleIds.some((role) => String(role).endsWith("_owner")))
  )
    throw invalid();
  const rows = (data.list ?? []) as unknown[];
  if (data.total !== rows.length) throw invalid();
  const ids = new Set<string>();
  const field = scope === "org" ? "orgId" : "projectId";
  const list = rows.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw invalid();
    const row = value as Record<string, unknown>;
    if (
      row[field] !== id ||
      typeof row.userId !== "string" ||
      !row.userId.trim() ||
      ids.has(row.userId) ||
      typeof row.username !== "string" ||
      typeof row.displayName !== "string" ||
      typeof row.roleId !== "string" ||
      (row.roleId !== "" &&
        !(memberRoles[scope] as readonly string[]).includes(row.roleId)) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      typeof row.hasOtherAccess !== "boolean" ||
      typeof row.isProtectedOwner !== "boolean"
    )
      throw invalid();
    ids.add(row.userId);
    return {
      [field]: id,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      roleId: row.roleId,
      version: Number(row.version),
      hasOtherAccess: row.hasOtherAccess,
      isProtectedOwner: row.isProtectedOwner,
    } as ScopedMember;
  });
  return {
    list,
    total: rows.length,
    canManageMembers: data.canManageMembers,
    canAssignOwner: data.canAssignOwner,
    assignableRoleIds: data.assignableRoleIds as string[],
  };
}
export const addScopedMember = (
  scope: MemberScope,
  id: string,
  data: { userId: string; roleId: string },
) => post(path(scope, id), data, { silence: true, redactErrors: true });
export const updateScopedMember = (
  scope: MemberScope,
  id: string,
  userId: string,
  data: { roleId: string; version: number },
) =>
  put(`${path(scope, id)}/${encodeURIComponent(userId)}`, data, {
    silence: true,
    redactErrors: true,
  });
export const removeScopedMember = (
  scope: MemberScope,
  id: string,
  userId: string,
  version: number,
) =>
  del(`${path(scope, id)}/${encodeURIComponent(userId)}`, {
    data: { version },
    silence: true,
    redactErrors: true,
  });
