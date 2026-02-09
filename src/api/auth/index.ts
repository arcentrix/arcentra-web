import { post } from '../client'
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RegisterResponse,
  LDAPLoginRequest
} from './types'

function login(data: LoginRequest) {
  return post<LoginResponse>(
    '/users/login',
    {
      ...data,
      password: btoa(data.password),
    },
    { silence: true },
  )
}

function loginWithLDAP(provider: string, data: LDAPLoginRequest) {
  return post<LoginResponse>(
    `/identity/ldap/login/${provider}`,
    {
      ...data,
      password: btoa(data.password),
    },
    { silence: true },
  )
}

// OAuth2/OIDC 授权 - 直接构建授权 URL 并跳转
function getAuthorizeUrl(provider: string, redirectUri: string) {
  // 构建授权 URL，后端会处理重定向
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
  })
  // 兼容不同后端参数命名
  params.append('redirectUri', redirectUri)
  const baseUrl = import.meta.env.VITE_API_CLIENT_URL || '/api/v1'
  return `${baseUrl}/identity/authorize/${provider}?${params.toString()}`
}

// 处理回调 - 由 AuthCallback 页面调用
async function handleCallback(provider: string, code: string, state?: string) {
  const params = new URLSearchParams({ code })
  if (state) params.append('state', state)
  const apiBase = import.meta.env.VITE_API_CLIENT_URL || '/api/v1'
  const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase
  const url = `${normalizedBase}/identity/callback/${provider}?${params.toString()}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const contentType = response.headers.get('content-type') || ''
    if (response.status >= 300 && response.status < 400) {
      throw new Error('OAuth callback redirected')
    }

    if (!contentType.includes('application/json')) {
      throw new Error('OAuth callback returned non-JSON response')
    }

    const json = await response.json()
    if (json?.code && json.code !== 200) {
      throw new Error(json.errMsg || 'OAuth callback failed')
    }
    return json?.detail !== undefined ? json.detail : json?.data ?? json
  } catch (error) {
    throw error
  }
}

function register(data: RegisterRequest) {
  return post<RegisterResponse>(
    '/users/register',
    {
      ...data,
      password: btoa(data.password),
    },
    { silence: true },
  )
}

export default {
  login,
  loginWithLDAP,
  getAuthorizeUrl,
  handleCallback,
  register,
}
