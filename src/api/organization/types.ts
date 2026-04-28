/**
 * 组织相关的类型定义
 */

/**
 * 组织计划类型
 */
export type OrganizationPlan = "Free" | "Startup" | "Enterprise";

/**
 * 组织信息
 */
export interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  plan: OrganizationPlan;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

/**
 * 创建组织的请求参数
 */
export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  logo?: string;
}

/**
 * 更新组织的请求参数
 */
export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  logo?: string;
  plan?: OrganizationPlan;
}

/**
 * 组织列表响应
 */
export interface OrganizationListResponse {
  organizations: Organization[];
  total: number;
}
