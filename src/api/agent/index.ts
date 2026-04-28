/**
 * Agent API 客户端
 */

import {
  get,
  post,
  put,
  del,
  dedupeRequest,
  generateRequestKey,
} from "../client";
import type {
  Agent,
  UpdateAgentRequest,
  ListAgentsParams,
  ListAgentsResponse,
  CreateRegistrationTokenReq,
  CreateRegistrationTokenResp,
  ListRegistrationTokensParams,
  ListRegistrationTokensResponse,
} from "./types";

/**
 * 获取 Agent 列表
 */
export const listAgents = async (
  params?: ListAgentsParams,
): Promise<ListAgentsResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.pageNum) {
    queryParams.append("pageNum", params.pageNum.toString());
  }
  if (params?.pageSize) {
    queryParams.append("pageSize", params.pageSize.toString());
  }
  const queryString = queryParams.toString();
  const url = `/agent${queryString ? `?${queryString}` : ""}`;

  // 使用请求去重
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<ListAgentsResponse>(url));
};

// 全局请求去重：确保同一个 agentId 在同一时间只请求一次
const pendingAgentRequests = new Map<string, Promise<Agent>>();

/**
 * 根据 Agent ID 获取 Agent 详情
 * GET /api/v1/agent/:agentId
 * @param agentId Agent 的唯一标识（短ID，string类型）
 */
export const getAgentById = async (agentId: string): Promise<Agent> => {
  // 如果已经有相同的请求正在进行，直接返回该 Promise
  const pendingRequest = pendingAgentRequests.get(agentId);
  if (pendingRequest) {
    return pendingRequest;
  }

  // 创建新的请求
  const requestPromise = get<Agent>(`/agent/${agentId}`)
    .then((data) => {
      // 请求完成后，从 Map 中移除
      pendingAgentRequests.delete(agentId);
      return data;
    })
    .catch((error) => {
      // 请求失败后，也要从 Map 中移除
      pendingAgentRequests.delete(agentId);
      throw error;
    });

  // 将请求保存到 Map 中
  pendingAgentRequests.set(agentId, requestPromise);
  return requestPromise;
};

/**
 * 更新 Agent
 * PUT /api/v1/agent/:agentId
 * @param agentId Agent 的唯一标识（短ID，string类型）
 * @param data 更新数据（所有字段都是可选的）
 */
export const updateAgent = async (
  agentId: string,
  data: UpdateAgentRequest,
): Promise<Agent> => {
  return put<Agent>(`/agent/${agentId}`, data);
};

/**
 * 删除 Agent
 * DELETE /api/v1/agent/:agentId
 * @param agentId Agent 的唯一标识（短ID，string类型）
 */
export const deleteAgent = async (agentId: string): Promise<void> => {
  return del<void>(`/agent/${agentId}`);
};

/**
 * 获取 Agent 统计信息
 * GET /api/v1/agent/statistics
 */
export const getAgentStatistics = async (): Promise<{
  total: number;
  online: number;
  offline: number;
}> => {
  const url = "/agent/statistics";
  const key = generateRequestKey(url);
  return dedupeRequest(key, () =>
    get<{ total: number; online: number; offline: number }>(url),
  );
};

/**
 * 审批 Agent
 * PUT /api/v1/agent/:agentId/approve
 */
export const approveAgent = async (agentId: string): Promise<void> => {
  return put<void>(`/agent/${agentId}/approve`);
};

// ========== Registration Tokens ==========

/**
 * 创建 Registration Token
 * POST /api/v1/registration-tokens
 */
export const createRegistrationToken = async (
  data: CreateRegistrationTokenReq,
): Promise<CreateRegistrationTokenResp> => {
  return post<CreateRegistrationTokenResp>("/registration-tokens", data);
};

/**
 * 获取 Registration Token 列表
 * GET /api/v1/registration-tokens
 */
export const listRegistrationTokens = async (
  params?: ListRegistrationTokensParams,
): Promise<ListRegistrationTokensResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.pageNum) {
    queryParams.append("pageNum", params.pageNum.toString());
  }
  if (params?.pageSize) {
    queryParams.append("pageSize", params.pageSize.toString());
  }
  const queryString = queryParams.toString();
  const url = `/registration-tokens${queryString ? `?${queryString}` : ""}`;
  const key = generateRequestKey(url);
  return dedupeRequest(key, () => get<ListRegistrationTokensResponse>(url));
};

/**
 * 吊销 Registration Token
 * DELETE /api/v1/registration-tokens/:id
 */
export const revokeRegistrationToken = async (id: number): Promise<void> => {
  return del<void>(`/registration-tokens/${id}`);
};

export default {
  listAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  getAgentStatistics,
  approveAgent,
  createRegistrationToken,
  listRegistrationTokens,
  revokeRegistrationToken,
};
