import {
  get,
  post,
  put,
  del,
  dedupeRequest,
  generateRequestKey,
} from "../client";
import type {
  IdentityProvider,
  CreateIdentityProviderRequest,
  UpdateIdentityProviderRequest,
} from "./types";

/**
 * 获取 Identity 提供者列表
 */
export const listIdentityProviders = async (
  type?: string,
): Promise<IdentityProvider[]> => {
  const url = type ? `/identity/providers?type=${type}` : "/identity/providers";

  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<IdentityProvider[]>(url));
};

/**
 * 获取所有 provider 类型
 */
export const listProviderTypes = async (): Promise<string[]> => {
  return get<string[]>("/identity/providers/types");
};

/**
 * 获取单个 Identity 提供者详情
 */
export const getIdentityProvider = async (
  name: string,
): Promise<IdentityProvider> => {
  const url = `/identity/providers/${name}`;
  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<IdentityProvider>(url));
};

/**
 * 创建 Identity 提供者
 */
export const createIdentityProvider = async (
  data: CreateIdentityProviderRequest,
): Promise<IdentityProvider> => {
  return post<IdentityProvider>("/identity/providers", data);
};

/**
 * 更新 Identity 提供者
 */
export const updateIdentityProvider = async (
  name: string,
  data: UpdateIdentityProviderRequest,
): Promise<IdentityProvider> => {
  return put<IdentityProvider>(`/identity/providers/${name}`, data);
};

/**
 * 删除 Identity 提供者
 */
export const deleteIdentityProvider = async (name: string): Promise<void> => {
  await del(`/identity/providers/${name}`);
};

/**
 * 切换 Identity 提供者启用状态
 */
export const toggleIdentityProvider = async (
  name: string,
  enabled: boolean,
): Promise<IdentityProvider> => {
  return put<IdentityProvider>(`/identity/providers/${name}/toggle`, {
    is_enabled: enabled,
  });
};

export default {
  listIdentityProviders,
  listProviderTypes,
  getIdentityProvider,
  createIdentityProvider,
  updateIdentityProvider,
  deleteIdentityProvider,
  toggleIdentityProvider,
};
