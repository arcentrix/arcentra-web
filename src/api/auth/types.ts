import type { AuthToken } from '@/models/auth'
import type { UserInfo, UserRole } from '@/models/user'

export type AuthMethod = 'standard' | 'ldap' | 'oauth2' | 'oidc'

export interface LoginRequest {
  email?: string
  username?: string
  password: string
  authMethod?: AuthMethod
}

export interface LoginResponse {
  userinfo: UserInfo
  token: AuthToken
  role: UserRole
}

export interface LDAPLoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
}

export interface RegisterResponse {
  message?: string
}
