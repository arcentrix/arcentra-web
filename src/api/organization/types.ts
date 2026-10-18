/** Real organization records returned by the scoped directory. */
export interface Organization {
  orgId: string;
  name: string;
  displayName: string;
  description: string;
  website: string;
  email: string;
  ownerUserId: string;
  status: number;
  isEnabled: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  isMember: boolean;
  canUpdate: boolean;
  canManageMembers: boolean;
  canArchive: boolean;
}
export interface CreateOrganizationRequest {
  name: string;
  displayName: string;
  description: string;
  website: string;
  email: string;
}
export interface UpdateOrganizationRequest extends Omit<
  CreateOrganizationRequest,
  "name"
> {
  version: number;
}
export interface OrganizationListResponse {
  list: Organization[];
  total: number;
  page: number;
  pageSize: number;
  canCreate: boolean;
}
