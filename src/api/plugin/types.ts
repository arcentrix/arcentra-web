/**
 * Plugin API 类型定义
 */

// 插件类型枚举
export type PluginType =
  | "source"
  | "build"
  | "test"
  | "deploy"
  | "security"
  | "notify"
  | "approval"
  | "storage"
  | "analytics"
  | "integration"
  | "custom";

// 插件数据模型
export interface Plugin {
  id: number;
  pluginId: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  pluginType: PluginType;
  repository?: string;
}

// 插件列表响应
export interface PluginListResponse {
  plugins: Plugin[];
  count: number;
}

// 插件版本列表响应
export interface PluginVersionsResponse {
  pluginId: string;
  versions: Plugin[];
  count: number;
}
