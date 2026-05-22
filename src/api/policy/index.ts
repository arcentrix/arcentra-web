import { del, get, post, put } from "../client";
import type {
  ApprovalPolicy,
  ApprovalPolicyListResponse,
  CreateApprovalPolicyRequest,
  PolicyScopeType,
  UpdateApprovalPolicyRequest,
} from "./types";

function toQuery(scopeType: PolicyScopeType, scopeId?: string) {
  const params = new URLSearchParams();
  params.append("scopeType", scopeType);
  if (scopeId) params.append("scopeId", scopeId);
  return params.toString();
}

export async function listApprovalPolicies(
  scopeType: PolicyScopeType,
  scopeId?: string,
): Promise<ApprovalPolicyListResponse> {
  const url = `/approval-policies?${toQuery(scopeType, scopeId)}`;
  return get<ApprovalPolicyListResponse>(url);
}

export async function getApprovalPolicy(
  policyId: string,
): Promise<ApprovalPolicy> {
  return get<ApprovalPolicy>(`/approval-policies/${policyId}`);
}

export async function createApprovalPolicy(
  data: CreateApprovalPolicyRequest,
): Promise<ApprovalPolicy> {
  return post<ApprovalPolicy>("/approval-policies", data);
}

export async function updateApprovalPolicy(
  policyId: string,
  data: UpdateApprovalPolicyRequest,
): Promise<ApprovalPolicy> {
  return put<ApprovalPolicy>(`/approval-policies/${policyId}`, data);
}

export async function deleteApprovalPolicy(policyId: string): Promise<void> {
  await del(`/approval-policies/${policyId}`);
}

export default {
  listApprovalPolicies,
  getApprovalPolicy,
  createApprovalPolicy,
  updateApprovalPolicy,
  deleteApprovalPolicy,
};
