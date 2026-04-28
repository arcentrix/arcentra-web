/**
 * Plugin API 客户端
 */

import { get, dedupeRequest, generateRequestKey } from "../client";
import type {
  Plugin,
  PluginListResponse,
  PluginVersionsResponse,
} from "./types";

/**
 * 获取插件列表
 * GET /api/v1/plugins?pluginId=<pluginId>
 */
export const listPlugins = async (
  pluginId?: string,
): Promise<PluginListResponse> => {
  const params = new URLSearchParams();
  if (pluginId) {
    params.append("pluginId", pluginId);
  }
  const queryString = params.toString();
  const url = `/plugins${queryString ? `?${queryString}` : ""}`;

  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<PluginListResponse>(url));
};

/**
 * 获取指定插件的所有版本
 * GET /api/v1/plugins/:pluginId
 */
export const getPluginVersions = async (
  pluginId: string,
): Promise<PluginVersionsResponse> => {
  const url = `/plugins/${pluginId}`;
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<PluginVersionsResponse>(url));
};

/**
 * 获取指定插件指定版本的详情
 * GET /api/v1/plugins/:pluginId/versions/:version
 */
export const getPluginVersion = async (
  pluginId: string,
  version: string,
): Promise<Plugin> => {
  const url = `/plugins/${pluginId}/versions/${version}`;
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<Plugin>(url));
};

export default {
  listPlugins,
  getPluginVersions,
  getPluginVersion,
};
