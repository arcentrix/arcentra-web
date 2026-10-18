import { get, patch, post } from "../client";

export const projectSecretLimit = 1000;
const validUnicode = (value: string) =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(
    new TextEncoder().encode(value),
  ) === value;
export const validSecretDescription = (value: string) =>
  !value.includes("\0") && [...value].length <= 4096 && validUnicode(value);
export const secretTypes = ["password", "token", "ssh_key", "env"] as const;
export type SecretType = (typeof secretTypes)[number];
export interface ProjectSecret {
  secretId: string;
  projectId: string;
  name: string;
  secretType: SecretType;
  description: string;
  version: string;
  isEnabled: 0 | 1;
  configured: boolean;
  createdAt: string;
  updatedAt: string;
  canUpdate: boolean;
  canRotate: boolean;
  canDisable: boolean;
}
export interface ProjectSecretList {
  projectId: string;
  list: ProjectSecret[];
  total: number;
  canCreate: boolean;
  canWrite: boolean;
  canDisable: boolean;
  projectActive: boolean;
  encryptionConfigured: boolean;
}
export interface CreateProjectSecret {
  name: string;
  secretType: SecretType;
  description: string;
  value: string;
}
const privateRequest = { silence: true, redactErrors: true };
const invalid = () =>
  new Error("Project secret metadata could not be verified.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
const path = (projectId: string, secretId?: string) => {
  if (!projectId.trim() || (secretId !== undefined && !secretId.trim()))
    throw invalid();
  return `/project/${encodeURIComponent(projectId)}/secrets${secretId === undefined ? "" : `/${encodeURIComponent(secretId)}`}`;
};
const metadataFields = [
  "secretId",
  "projectId",
  "name",
  "secretType",
  "description",
  "version",
  "isEnabled",
  "configured",
  "createdAt",
  "updatedAt",
  "canUpdate",
  "canRotate",
  "canDisable",
];
/** Strict metadata projection: never retain any value, ciphertext, mask, or extra response fields. */
function metadata(
  value: unknown,
  projectId: string,
  secretId?: string,
): ProjectSecret {
  const row = object(value);
  if (Object.keys(row).some((key) => !metadataFields.includes(key)))
    throw invalid();
  if (
    row.projectId !== projectId ||
    typeof row.secretId !== "string" ||
    !row.secretId.trim() ||
    (secretId !== undefined && row.secretId !== secretId) ||
    typeof row.name !== "string" ||
    !validSecretName(row.name) ||
    !secretTypes.includes(row.secretType as SecretType) ||
    typeof row.description !== "string" ||
    !validSecretDescription(row.description) ||
    typeof row.version !== "string" ||
    !row.version.trim() ||
    (row.isEnabled !== 0 && row.isEnabled !== 1)
  )
    throw invalid();
  for (const key of ["configured", "canUpdate", "canRotate", "canDisable"])
    if (typeof row[key] !== "boolean") throw invalid();
  for (const key of ["createdAt", "updatedAt"])
    if (
      typeof row[key] !== "string" ||
      !Number.isFinite(Date.parse(row[key] as string))
    )
      throw invalid();
  if (row.isEnabled === 0 && (row.canUpdate || row.canRotate || row.canDisable))
    throw invalid();
  return Object.fromEntries(
    metadataFields.map((key) => [key, row[key]]),
  ) as unknown as ProjectSecret;
}
export const validSecretName = (name: string) =>
  /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name);
export function validSecretValue(value: string): boolean {
  const bytes = new TextEncoder().encode(value);
  if (
    !bytes.length ||
    bytes.length > 65536 ||
    value.includes("\0") ||
    !validUnicode(value)
  )
    return false;
  // Go's unicode.IsSpace matches Unicode White_Space, rather than JavaScript trim's BOM behavior.
  const normalized = value
    .replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "")
    .toLowerCase();
  if (
    !normalized ||
    [
      "redacted",
      "[redacted]",
      "<redacted>",
      "configured",
      "[configured]",
    ].includes(normalized)
  )
    return false;
  if (normalized.replace(/^[*\[\]<>_ ]+|[*\[\]<>_ ]+$/g, "") === "masked")
    return false;
  return !/^[*•● ]*$/.test(normalized);
}
export async function listProjectSecrets(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectSecretList> {
  const data = object(
    await get<unknown>(path(projectId), { ...privateRequest, signal }),
  );
  if (
    data.projectId !== projectId ||
    (data.list !== null && !Array.isArray(data.list)) ||
    !Number.isSafeInteger(data.total) ||
    Number(data.total) < 0 ||
    Number(data.total) > projectSecretLimit ||
    typeof data.canCreate !== "boolean"
  )
    throw invalid();
  for (const key of [
    "canWrite",
    "canDisable",
    "projectActive",
    "encryptionConfigured",
  ])
    if (typeof data[key] !== "boolean") throw invalid();
  if (
    data.canCreate !==
    (data.canWrite &&
      data.projectActive &&
      data.encryptionConfigured &&
      Number(data.total) < projectSecretLimit)
  )
    throw invalid();
  const list = ((data.list ?? []) as unknown[]).map((row) =>
    metadata(row, projectId),
  );
  if (
    list.length !== data.total ||
    new Set(list.map((row) => row.secretId)).size !== list.length ||
    new Set(list.map((row) => row.name)).size !== list.length
  )
    throw invalid();
  for (const row of list) {
    const enabled = row.isEnabled === 1 && data.projectActive;
    if (
      row.canUpdate !== !!(enabled && data.canWrite) ||
      row.canRotate !==
        !!(enabled && data.canWrite && data.encryptionConfigured) ||
      row.canDisable !== !!(enabled && data.canDisable)
    )
      throw invalid();
  }
  return {
    projectId,
    list,
    total: list.length,
    canCreate: data.canCreate,
    canWrite: data.canWrite as boolean,
    canDisable: data.canDisable as boolean,
    projectActive: data.projectActive as boolean,
    encryptionConfigured: data.encryptionConfigured as boolean,
  };
}
function versionBody(version: string) {
  if (typeof version !== "string" || !version.trim()) throw invalid();
  return { version };
}
export async function createProjectSecret(
  projectId: string,
  input: CreateProjectSecret,
) {
  if (
    !validSecretName(input.name) ||
    !secretTypes.includes(input.secretType) ||
    !validSecretValue(input.value) ||
    !validSecretDescription(input.description)
  )
    throw new Error("Check the secret fields and enter a new value.");
  const row = metadata(
    await post<unknown>(
      path(projectId),
      {
        name: input.name,
        secretType: input.secretType,
        description: input.description,
        value: input.value,
      },
      privateRequest,
    ),
    projectId,
  );
  if (
    row.name !== input.name ||
    row.secretType !== input.secretType ||
    row.isEnabled !== 1 ||
    !row.configured
  )
    throw invalid();
  return row;
}
export async function updateProjectSecret(
  projectId: string,
  secretId: string,
  input: { version: string; description: string },
) {
  if (
    typeof input.description !== "string" ||
    !validSecretDescription(input.description)
  )
    throw invalid();
  const row = metadata(
    await patch<unknown>(
      path(projectId, secretId),
      { ...versionBody(input.version), description: input.description },
      privateRequest,
    ),
    projectId,
    secretId,
  );
  if (row.version === input.version || row.description !== input.description)
    throw invalid();
  return row;
}
export async function rotateProjectSecret(
  projectId: string,
  secretId: string,
  input: { version: string; value: string },
) {
  if (!validSecretValue(input.value))
    throw new Error("Enter a new secret value.");
  const row = metadata(
    await post<unknown>(
      `${path(projectId, secretId)}/rotate`,
      { ...versionBody(input.version), value: input.value },
      privateRequest,
    ),
    projectId,
    secretId,
  );
  if (row.version === input.version || row.isEnabled !== 1 || !row.configured)
    throw invalid();
  return row;
}
export async function disableProjectSecret(
  projectId: string,
  secretId: string,
  version: string,
) {
  const row = metadata(
    await post<unknown>(
      `${path(projectId, secretId)}/disable`,
      versionBody(version),
      privateRequest,
    ),
    projectId,
    secretId,
  );
  if (row.isEnabled !== 0 || row.version === version) throw invalid();
  return row;
}
