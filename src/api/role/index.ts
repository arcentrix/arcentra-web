import {
  get,
  post,
  put,
  del,
  dedupeRequest,
  generateRequestKey,
} from "../client";
import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  RoleListResponse,
} from "./types";

/**
 * 获取角色列表（带分页）
 * GET /api/v1/role?pageNum=1&pageSize=10
 */
export const listRoles = async (
  pageNum?: number,
  pageSize?: number,
  scope?: string,
): Promise<RoleListResponse> => {
  const params = new URLSearchParams();
  if (pageNum) params.append("pageNum", pageNum.toString());
  if (pageSize) params.append("pageSize", pageSize.toString());
  if (scope) params.append("scope", scope);
  const url = params.toString() ? `/role?${params.toString()}` : "/role";

  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<RoleListResponse>(url));
};

/**
 * 获取单个角色详情
 * GET /api/v1/role/:roleId
 */
export const getRole = async (roleId: string): Promise<Role> => {
  const url = `/role/${roleId}`;
  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<Role>(url));
};

/**
 * 创建角色
 * POST /api/v1/role
 * Content-Type: application/json
 */
export const createRole = async (data: CreateRoleRequest): Promise<Role> => {
  return post<Role>("/role", data);
};

/**
 * 更新角色
 * PUT /api/v1/role/:roleId
 * Content-Type: application/json
 */
export const updateRole = async (
  roleId: string,
  data: UpdateRoleRequest,
): Promise<Role> => {
  return put<Role>(`/role/${roleId}`, data);
};

/**
 * 删除角色
 * DELETE /api/v1/role/:roleId
 */
export const deleteRole = async (roleId: string): Promise<void> => {
  await del(`/role/${roleId}`);
};

/**
 * 切换角色启用状态
 * PUT /api/v1/role/:roleId/toggle
 */
export const toggleRole = async (roleId: string): Promise<Role> => {
  return put<Role>(`/role/${roleId}/toggle`);
};

/**
 * 获取角色权限列表
 * GET /api/v1/role/:roleId/permissions
 */
export const getRolePermissions = async (roleId: string): Promise<string[]> => {
  const url = `/role/${roleId}/permissions`;
  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<string[]>(url));
};

/**
 * 更新角色权限列表
 * PUT /api/v1/role/:roleId/permissions
 */
export const updateRolePermissions = async (
  roleId: string,
  permissions: string[],
): Promise<Role> => {
  return put<Role>(`/role/${roleId}/permissions`, { permissions });
};

export default {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  toggleRole,
  getRolePermissions,
  updateRolePermissions,
};
