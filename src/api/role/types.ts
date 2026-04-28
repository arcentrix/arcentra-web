export type RoleScope = "project" | "team" | "org";

export interface Role {
  id: number;
  roleId: string;
  name: string;
  displayName?: string;
  description?: string;
  scope: RoleScope;
  orgId?: string;
  isBuiltin: number; // 0: custom, 1: built-in
  isEnabled: number; // 0: disabled, 1: enabled
  priority: number;
  permissions?: string[]; // JSON 数组
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  roleId: string; // 角色唯一标识
  name: string;
  displayName?: string;
  description?: string;
  scope?: RoleScope;
  orgId?: string;
  priority?: number;
  permissions?: string[];
  isEnabled?: number; // 0: disabled, 1: enabled
}

export interface UpdateRoleRequest {
  name?: string;
  displayName?: string;
  description?: string;
  scope?: RoleScope;
  priority?: number;
  permissions?: string[];
  isEnabled?: number;
}

export interface RoleListResponse {
  count?: number;
  pageNum: number;
  pageSize: number;
  roles: Role[];
  total: number;
}
