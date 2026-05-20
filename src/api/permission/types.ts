export interface PermissionDictItem {
  permissionId: string;
  resourceType: string;
  action: string;
  scopeType: string;
  description?: string;
  isSystem: number;
}

export interface PermissionDictGroup {
  resourceType: string;
  permissions: PermissionDictItem[];
}

export interface PermissionDictResponse {
  permissions: PermissionDictItem[];
  groups: PermissionDictGroup[];
  count: number;
}

export interface CreatePermissionRequest {
  permissionId?: string;
  resourceType: string;
  action: string;
  scopeType?: string;
  description?: string;
}

export type UpdatePermissionRequest = Partial<CreatePermissionRequest>;
