/**
 * Settings 配置项相关类型
 *
 * 后端响应结构：
 * GET /settings → SettingItem[]   （响应拦截器已 unwrap detail）
 * PUT /settings/:name body { value }
 */

export type SettingValue = Record<string, unknown>

export interface SettingItem {
  /** 配置项唯一标识，同时也是 PUT URL 的 path 参数 */
  name: string
  /** 配置项实际数据，结构因 name 而异 */
  value: SettingValue
}

export interface UpdateSettingRequest {
  value: SettingValue
}
