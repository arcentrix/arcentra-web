export type ProviderType = "oauth" | "ldap" | "oidc" | "saml";

export interface IdentityProviderConfig {
  [key: string]: any;
}

export interface IdentityProvider {
  id: number;
  name: string;
  providerType: ProviderType; // 后端使用驼峰命名
  config: IdentityProviderConfig;
  description?: string;
  priority: number;
  isEnabled: number; // 后端返回 0/1
  createdAt: string; // 后端使用驼峰命名
  updatedAt: string; // 后端使用驼峰命名
}

export interface CreateIdentityProviderRequest {
  name: string;
  provider_type: ProviderType;
  config: IdentityProviderConfig;
  description?: string;
  priority?: number;
  is_enabled?: boolean;
}

export interface UpdateIdentityProviderRequest {
  name?: string;
  provider_type?: ProviderType;
  config?: IdentityProviderConfig;
  description?: string;
  priority?: number;
  is_enabled?: boolean;
}

// 后端直接返回数组
export type IdentityProviderListResponse = IdentityProvider[];
