import { get, post } from "../client";
export interface Project {
  projectId: string;
  orgId: string;
  name: string;
  displayName: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  status: number;
  isEnabled: number;
  totalPipelines: number;
  totalBuilds: number;
  successBuilds: number;
  failedBuilds: number;
}
export interface CreateProjectInput {
  orgId: string;
  name: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
}
export const listProjects = (
  params: { name?: string; pageNum?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) =>
  get<{
    list: Project[] | null;
    total: number;
    pageNum: number;
    pageSize: number;
  }>("/project/", {
    params: { pageNum: 1, pageSize: 20, ...params },
    signal,
    silence: true,
  });
export const getProject = (projectId: string, signal?: AbortSignal) =>
  get<Project>(`/project/${encodeURIComponent(projectId)}`, {
    signal,
    silence: true,
  });
export const createProject = (data: CreateProjectInput) =>
  post<Project>(
    "/project/",
    {
      ...data,
      repoType: "git",
      authType: 0,
      triggerMode: 1,
      visibility: 0,
      accessLevel: "team",
    },
    { silence: true },
  );

/** A stored association only; the endpoint does not return current role grants. */
export interface ProjectMemberAssociation {
  projectId: string;
  userId: string;
}

/** Read the existing project-scoped endpoint without enriching from global users. */
export async function listProjectMembers(
  projectId: string,
  signal?: AbortSignal,
): Promise<{ list: ProjectMemberAssociation[]; total: number }> {
  if (!projectId.trim()) throw new Error("A project ID is required.");
  const response = await get<unknown>(
    `/project/${encodeURIComponent(projectId)}/members`,
    { signal, silence: true },
  );
  const invalid = () =>
    new Error("Project member associations could not be verified.");
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw invalid();
  }
  const { list, total } = response as Record<string, unknown>;
  if (
    (list !== null && !Array.isArray(list)) ||
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0
  ) {
    throw invalid();
  }
  const rows: unknown[] = list === null ? [] : list;
  if (total !== rows.length) throw invalid();
  const users = new Set<string>();
  const associations = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw invalid();
    const member = row as Record<string, unknown>;
    if (
      member.projectId !== projectId ||
      typeof member.userId !== "string" ||
      !member.userId.trim() ||
      users.has(member.userId)
    ) {
      throw invalid();
    }
    users.add(member.userId);
    return { projectId, userId: member.userId };
  });
  return { list: associations, total };
}
