import { get, patch, post } from "../client";
export interface ProjectSettings {
  projectId: string;
  orgId: string;
  name: string;
  displayName: string;
  description: string;
  defaultBranch: string;
  tags: string;
  language: string;
  framework: string;
  visibility: number;
  status: number;
  isEnabled: number;
  version: string;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
}
export type ProjectSettingsDraft = Pick<
  ProjectSettings,
  | "displayName"
  | "description"
  | "defaultBranch"
  | "tags"
  | "language"
  | "framework"
  | "visibility"
>;
const path = (id: string) => {
  if (!id.trim()) throw new Error("A project ID is required.");
  return `/project/${encodeURIComponent(id)}/settings`;
};
function settings(value: unknown, projectId: string): ProjectSettings {
  const invalid = () => new Error("Project settings could not be verified.");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  const row = value as Record<string, unknown>;
  if (
    row.projectId !== projectId ||
    typeof row.version !== "string" ||
    !row.version
  )
    throw invalid();
  for (const key of [
    "orgId",
    "name",
    "displayName",
    "description",
    "defaultBranch",
    "tags",
    "language",
    "framework",
  ])
    if (typeof row[key] !== "string") throw invalid();
  for (const key of ["canUpdate", "canArchive", "canRestore"])
    if (typeof row[key] !== "boolean") throw invalid();
  for (const key of ["visibility", "status", "isEnabled"])
    if (typeof row[key] !== "number") throw invalid();
  if (![0, 1, 2].includes(Number(row.visibility))) throw invalid();
  return Object.fromEntries(
    [
      "projectId",
      "orgId",
      "name",
      "displayName",
      "description",
      "defaultBranch",
      "tags",
      "language",
      "framework",
      "visibility",
      "status",
      "isEnabled",
      "version",
      "canUpdate",
      "canArchive",
      "canRestore",
    ].map((key) => [key, row[key]]),
  ) as unknown as ProjectSettings;
}
export const getProjectSettings = async (id: string, signal?: AbortSignal) =>
  settings(
    await get(path(id), { signal, silence: true, redactErrors: true }),
    id,
  );
export const updateProjectSettings = async (
  id: string,
  data: ProjectSettingsDraft & { version: string },
) =>
  settings(
    await patch(path(id), data, { silence: true, redactErrors: true }),
    id,
  );
export const archiveProject = async (id: string, version: string) =>
  settings(
    await post(
      `${path(id)}/archive`,
      { version },
      { silence: true, redactErrors: true },
    ),
    id,
  );
export const restoreProject = async (id: string, version: string) =>
  settings(
    await post(
      `${path(id)}/restore`,
      { version },
      { silence: true, redactErrors: true },
    ),
    id,
  );
