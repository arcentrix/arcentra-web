import axios from 'axios'
import { toast } from '@/lib/toast'
import { ENV } from '@/constants/env'
import { isDev } from '@/lib/is'
import authStore from '@/store/auth'
import type { ApiClientErrorResponse, ApiClientResponse, RequestConfig } from './types'

export const client = axios.create({
  baseURL: ENV.API_CLIENT_URL || '/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 支持 cookie 认证，用于 OAuth2 登录后后端设置 cookie 的情况
})

// 请求拦截器 - 添加 Token
client.interceptors.request.use(
  async (config) => {
    const state = authStore.getState()
    const token = state.accessToken
    
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
    if (isDev()) console.warn('[RESPONSE ERROR]', data)

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
