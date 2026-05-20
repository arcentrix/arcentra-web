export type PolicyScopeType = "platform" | "org" | "project" | "pipeline";

export interface ApprovalPolicy {
  id?: number;
  policyId: string;
  scopeType: PolicyScopeType;
  scopeId: string;
  name: string;
  matchRule: Record<string, unknown> | unknown[];
  approverRule: Record<string, unknown> | unknown[];
  minApprovals: number;
  mode: "any" | "serial" | "parallel";
  timeoutSeconds: number;
  enabled: number;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateApprovalPolicyRequest {
  policyId?: string;
  scopeType: PolicyScopeType;
  scopeId?: string;
  name: string;
  matchRule?: Record<string, unknown> | unknown[];
  approverRule?: Record<string, unknown> | unknown[];
  minApprovals?: number;
  mode?: ApprovalPolicy["mode"];
  timeoutSeconds?: number;
  enabled?: number;
  description?: string;
}

export type UpdateApprovalPolicyRequest = Partial<CreateApprovalPolicyRequest>;

export interface ApprovalPolicyListResponse {
  policies: ApprovalPolicy[];
  count: number;
}
