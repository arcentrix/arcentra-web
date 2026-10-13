import type { AuthToken } from "@/models/auth";
import type { UserRole } from "@/models/user";

export type AuthMethod = "standard" | "ldap" | "oauth2" | "oidc";

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
  authMethod?: AuthMethod;
}

export interface LoginResponse {
  token: AuthToken;
  role: UserRole | UserRole[];
  initialRoutes?: string[];
}

export interface LDAPLoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
}

export interface RegisterResponse {
  message?: string;
}

export interface IdentityProvider {
  name: string;
  providerType: string;
  description: string;
  priority: number;
  authUrl: string;
  loginMode: string;
}
