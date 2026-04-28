/**
 * 组织相关的 API 接口
 * TODO: 等待后端 API 实现后集成
 */

import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationListResponse,
} from "./types";

/**
 * 获取用户的所有组织
 * TODO: 实现 API 调用
 */
export async function getOrganizations(): Promise<OrganizationListResponse> {
  // TODO: 调用后端 API
  throw new Error("API not implemented yet");
}

/**
 * 根据 ID 获取组织详情
 * TODO: 实现 API 调用
 */
export async function getOrganization(_id: string): Promise<Organization> {
  // TODO: 调用后端 API
  throw new Error("API not implemented yet");
}

/**
 * 创建新组织
 * TODO: 实现 API 调用
 */
export async function createOrganization(
  _data: CreateOrganizationRequest,
): Promise<Organization> {
  // TODO: 调用后端 API
  throw new Error("API not implemented yet");
}

/**
 * 更新组织信息
 * TODO: 实现 API 调用
 */
export async function updateOrganization(
  _id: string,
  _data: UpdateOrganizationRequest,
): Promise<Organization> {
  // TODO: 调用后端 API
  throw new Error("API not implemented yet");
}

/**
 * 删除组织
 * TODO: 实现 API 调用
 */
export async function deleteOrganization(_id: string): Promise<void> {
  // TODO: 调用后端 API
  throw new Error("API not implemented yet");
}
