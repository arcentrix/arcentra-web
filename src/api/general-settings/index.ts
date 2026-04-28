/**
 * Settings 配置项 API
 */

import { get, put, dedupeRequest, generateRequestKey } from "../client";
import type { SettingItem, UpdateSettingRequest } from "./types";

/**
 * 获取全部配置项（拦截器已经把 detail 解出来）
 * GET /settings → SettingItem[]
 */
export async function listSettings(): Promise<SettingItem[]> {
  const url = "/settings";
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<SettingItem[]>(url));
}

/**
 * 获取单个配置项
 * GET /settings/:name
 */
export async function getSetting(name: string): Promise<SettingItem> {
  const url = `/settings/${encodeURIComponent(name)}`;
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<SettingItem>(url));
}

/**
 * 更新配置项
 * PUT /settings/:name body { value }
 */
export async function updateSetting(
  name: string,
  data: UpdateSettingRequest,
): Promise<SettingItem> {
  return await put<SettingItem>(`/settings/${encodeURIComponent(name)}`, data);
}
