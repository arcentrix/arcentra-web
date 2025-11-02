import axios from 'axios'
import { toast } from '@/lib/toast'
import { ENV } from '@/constants/env'
import { isDev } from '@/lib/is'
import authStore from '@/store/auth'
import type { ApiClientErrorResponse, ApiClientResponse, RequestConfig } from './types'

export const client = axios.create({
  baseURL: ENV.API_CLIENT_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加 Token
client.interceptors.request.use(
  (config) => {
    const state = authStore.getState()
    const token = state.accessToken
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
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

    if (data.code === 200) return (data as ApiClientResponse).detail
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
