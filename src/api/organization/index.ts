import { del, get, post, put } from "../client";
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationListResponse,
} from "./types";
export * from "./types";

const invalid = () => new Error("Organization data could not be verified.");
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function organization(value: unknown, id?: string): Organization {
  const row = record(value);
  if (
    typeof row.orgId !== "string" ||
    !row.orgId.trim() ||
    (id && row.orgId !== id) ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    !Number.isSafeInteger(row.version) ||
    Number(row.version) < 1
  )
    throw invalid();
  for (const key of [
    "displayName",
    "description",
    "website",
    "email",
    "ownerUserId",
    "createdAt",
    "updatedAt",
  ])
    if (typeof row[key] !== "string") throw invalid();
  for (const key of ["status", "isEnabled"])
    if (typeof row[key] !== "number") throw invalid();
  for (const key of ["isMember", "canUpdate", "canManageMembers", "canArchive"])
    if (typeof row[key] !== "boolean") throw invalid();
  return Object.fromEntries(
    [
      "orgId",
      "name",
      "displayName",
      "description",
      "website",
      "email",
      "ownerUserId",
      "status",
      "isEnabled",
      "version",
      "createdAt",
      "updatedAt",
      "isMember",
      "canUpdate",
      "canManageMembers",
      "canArchive",
    ].map((key) => [key, row[key]]),
  ) as unknown as Organization;
}
const path = (id: string) => {
  if (!id.trim()) throw new Error("An organization ID is required.");
  return `/organization/${encodeURIComponent(id)}`;
};
export async function getOrganizations(
  params: { name?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<OrganizationListResponse> {
  const response = record(
    await get<unknown>("/organization", {
      params: { page: 1, pageSize: 20, ...params },
      signal,
      silence: true,
      redactErrors: true,
    }),
  );
  if (
    (response.list !== null && !Array.isArray(response.list)) ||
    !Number.isSafeInteger(response.total) ||
    Number(response.total) < 0 ||
    !Number.isSafeInteger(response.page) ||
    Number(response.page) < 1 ||
    !Number.isSafeInteger(response.pageSize) ||
    Number(response.pageSize) < 1 ||
    Number(response.pageSize) > 100 ||
    typeof response.canCreate !== "boolean"
  )
    throw invalid();
  const list = ((response.list ?? []) as unknown[]).map((row) =>
    organization(row),
  );
  if (
    new Set(list.map((row) => row.orgId)).size !== list.length ||
    list.length > Number(response.total)
  )
    throw invalid();
  return {
    list,
    total: Number(response.total),
    page: Number(response.page),
    pageSize: Number(response.pageSize),
    canCreate: response.canCreate,
  };
}
export async function getOrganization(id: string, signal?: AbortSignal) {
  return organization(
    await get<unknown>(path(id), { signal, silence: true, redactErrors: true }),
    id,
  );
}
export async function createOrganization(data: CreateOrganizationRequest) {
  return organization(
    await post<unknown>("/organization", data, {
      silence: true,
      redactErrors: true,
    }),
  );
}
export async function updateOrganization(
  id: string,
  data: UpdateOrganizationRequest,
) {
  return organization(
    await put<unknown>(path(id), data, { silence: true, redactErrors: true }),
    id,
  );
}
/** Versioned archive. This never adopts or creates a legacy permission scope. */
export async function deleteOrganization(id: string, version: number) {
  await del(path(id), { data: { version }, silence: true, redactErrors: true });
}
