import { get, post, put, dedupeRequest, generateRequestKey } from "../client";
import type {
  User,
  UpdateUserRequest,
  InviteUserRequest,
  UserListResponse,
} from "./types";

/**
 * 获取用户列表（带分页和筛选）
 */
export const listUsers = async (
  page?: number,
  pageSize?: number,
  filters?: {
    search?: string;
    status?: string;
  },
): Promise<UserListResponse> => {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (pageSize) params.append("pageSize", pageSize.toString());
  if (filters?.search) params.append("search", filters.search);
  if (filters?.status) params.append("status", filters.status);
  const url = params.toString() ? `/users?${params.toString()}` : "/users";

  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<UserListResponse>(url));
};

/**
 * 按角色获取用户列表
 */
export const listUsersByRole = async (
  roleId: string,
  page?: number,
  pageSize?: number,
): Promise<UserListResponse> => {
  const params = new URLSearchParams();
  params.append("roleId", roleId);
  if (page) params.append("page", page.toString());
  if (pageSize) params.append("pageSize", pageSize.toString());
  const url = `/users/by-role?${params.toString()}`;

  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<UserListResponse>(url));
};

/**
 * 更新用户信息
 */
export const updateUser = async (
  userId: string,
  data: UpdateUserRequest,
): Promise<User> => {
  return put<User>(`/users/${userId}`, data);
};

/**
 * 邀请用户
 */
export const inviteUser = async (data: InviteUserRequest): Promise<void> => {
  await post("/users/invite", data);
};

/**
 * 重置当前用户密码
 */
export const resetPassword = async (
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  await put("/users/me/password", {
    oldPassword: btoa(oldPassword),
    newPassword: btoa(newPassword),
  });
};

/**
 * 管理员重置用户密码
 */
export const resetUserPassword = async (
  userId: string,
  newPassword: string,
): Promise<void> => {
  await put(`/users/${userId}/password`, {
    password: btoa(newPassword),
  });
};

export default {
  listUsers,
  listUsersByRole,
  updateUser,
  inviteUser,
  resetPassword,
  resetUserPassword,
};
