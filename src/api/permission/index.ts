import { dedupeRequest, del, generateRequestKey, get, post, put } from "../client";
import type {
  CreatePermissionRequest,
  PermissionDictItem,
  PermissionDictResponse,
  UpdatePermissionRequest,
} from "./types";

export async function listPermissions(): Promise<PermissionDictResponse> {
  const url = "/permissions";
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<PermissionDictResponse>(url));
}

export async function getPermission(
  permissionId: string,
): Promise<PermissionDictItem> {
  return get<PermissionDictItem>(
    `/permissions/${encodeURIComponent(permissionId)}`,
  );
}

export async function createPermission(
  data: CreatePermissionRequest,
): Promise<PermissionDictItem> {
  return post<PermissionDictItem>("/permissions", data);
}

export async function updatePermission(
  permissionId: string,
  data: UpdatePermissionRequest,
): Promise<PermissionDictItem> {
  return put<PermissionDictItem>(
    `/permissions/${encodeURIComponent(permissionId)}`,
    data,
  );
}

export async function deletePermission(permissionId: string): Promise<void> {
  await del(`/permissions/${encodeURIComponent(permissionId)}`);
}

export default {
  listPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
};
