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
