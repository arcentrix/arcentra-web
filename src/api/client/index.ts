import axios from 'axios'
import { toast } from '@/lib/toast'
import { ENV } from '@/constants/env'
import { isDev } from '@/lib/is'
import authStore from '@/store/auth'
import type { ApiClientErrorResponse, ApiClientResponse, RequestConfig } from './types'

/**
 * 规范化 baseURL
 * 
 * 支持两种使用模式：
 * 1. 直接请求后端：设置完整 URL（如 https://localhost:8080/api/v1/）
 *    或域名+路径（如 localhost:8080/api/v1/，会自动添加 https://）
 * 2. 通过代理请求：设置相对路径（如 /api/v1），请求会发送到当前域名，由 Nginx/Vercel 代理到后端
 * 
 * @param url 环境变量 VITE_API_CLIENT_URL 的值
 * @returns 规范化后的 baseURL
 */
function normalizeBaseURL(url: string | undefined): string {
  if (!url) {
    return '/api/v1'
  }
  
  // 如果已经包含协议（http:// 或 https://），说明是完整 URL，直接返回
  // 模式：直接请求后端
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // 如果是相对路径（以 / 开头），说明要通过代理，直接返回
  // 模式：通过代理请求
  if (url.startsWith('/')) {
    return url
  }
  
  // 否则是域名+路径格式（如 localhost:8080/api/v1/），自动添加 https:// 协议
  // 模式：直接请求后端
  return `https://${url}`
}

export const client = axios.create({
  baseURL: normalizeBaseURL(ENV.API_CLIENT_URL),
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 支持 cookie 认证，用于 OAuth2 登录后后端设置 cookie 的情况
})

let hasLoggedClientBaseUrl = false

// 请求拦截器 - 添加 Token
client.interceptors.request.use(
  async (config) => {
    const state = authStore.getState()
    const token = state.accessToken
    if (!hasLoggedClientBaseUrl) {
      hasLoggedClientBaseUrl = true
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/ecab8bd1-0f3c-403b-93c7-5ea1e58d10da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H10',location:'api/client/index.ts:58',message:'api client base url',data:{baseURL:client.defaults.baseURL,requestUrl:config.url||'',origin:window.location.origin,withCredentials:client.defaults.withCredentials},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
    
    // 后端支持 Authorization header 和 cookie 二选一
    // 如果有 token，使用 Authorization header
    // 如果没有 token，不添加 Authorization header，让后端从 cookie 中读取
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 如果没有 token，不添加 Authorization header
    // cookie 会自动通过 withCredentials: true 发送到后端
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 响应拦截器
client.interceptors.response.use(
  (response) => {
    const data: ApiClientResponse | ApiClientErrorResponse = response.data

    if (data.code === 200) {
      // 支持 detail 和 data 两种字段名
      const apiResponse = data as ApiClientResponse
      return apiResponse.detail !== undefined ? apiResponse.detail : (response.data as any).data
    }
    if (isDev()) {
      const pathname = window.location.pathname || ''
      const isPublicRoute = pathname === '/login' || pathname === '/register' || pathname.startsWith('/auth/callback')
      const errMsg = (data as ApiClientErrorResponse).errMsg || ''
      const suppress = isPublicRoute && (data.code === 4405 || errMsg.includes('Token cannot be empty') || errMsg.includes('Invalid token'))
      if (!suppress) {
        console.warn('[RESPONSE ERROR]', data)
      }
    }

    // Token 相关错误，自动登出并跳转
    if (data.code === 4401 || data.code === 4403 || data.code === 4406) {
      // 使用动态导入避免循环依赖
      import('@/lib/auth').then(({ clearLocalAuth }) => {
        clearLocalAuth()
        window.location.href = '/login'
      })
      return Promise.reject(new Error('Session expired, please login again'))
    }

    if (!(response.config as RequestConfig).silence) {
      toast.error((data as ApiClientErrorResponse).errMsg)
    }

    return Promise.reject(new Error((data as ApiClientErrorResponse).errMsg))
  },
  (error) => {
    // 处理网络错误或其他 axios 错误
    if (error.response?.status === 401 || error.response?.status === 403) {
      // 使用动态导入避免循环依赖
      import('@/lib/auth').then(({ clearLocalAuth }) => {
        clearLocalAuth()
        window.location.href = '/login'
      })
    }
    return Promise.reject(error as Error)
  },
)

/**
 * 请求去重工具
 * 确保相同的请求在同一时间只执行一次
 */

// 存储正在进行的请求
const pendingRequests = new Map<string, Promise<any>>()

/**
 * 生成请求的唯一标识
 * @param url 请求 URL
 * @param params 请求参数（可选）
 * @returns 唯一标识字符串
 */
export function generateRequestKey(url: string, params?: any): string {
  if (!params) {
    return url
  }
  
  // 将参数序列化为字符串
  const paramsStr = typeof params === 'object' 
    ? JSON.stringify(params, Object.keys(params).sort())
    : String(params)
  
  return `${url}?${paramsStr}`
}

/**
 * 创建带去重功能的请求函数
 * @param key 请求的唯一标识（通常是 URL + 参数）
 * @param requestFn 实际的请求函数
 * @returns Promise
 */
export function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // 如果已经有相同的请求正在进行，直接返回该 Promise
  const pendingRequest = pendingRequests.get(key)
  if (pendingRequest) {
    return pendingRequest as Promise<T>
  }

  // 创建新的请求
  const requestPromise = requestFn()
    .then((data) => {
      // 请求完成后，从 Map 中移除
      pendingRequests.delete(key)
      return data
    })
    .catch((error) => {
      // 请求失败后，也要从 Map 中移除
      pendingRequests.delete(key)
      throw error
    })

  // 将请求保存到 Map 中
  pendingRequests.set(key, requestPromise)
  return requestPromise
}

export function get<T = unknown>(url: string, config?: RequestConfig) {
  return client.get<unknown, T>(url, config)
}

export function post<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig) {
  return client.post<unknown, T>(url, data, config)
}

export function put<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig) {
  return client.put<unknown, T>(url, data, config)
}

export function del<T = unknown>(url: string, config?: RequestConfig) {
  return client.delete<unknown, T>(url, config)
}
