import type { AxiosRequestConfig } from 'axios'

/**
 * API Request Config
 */
export type RequestConfig = AxiosRequestConfig & { silence?: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiClientResponse<T = any> {
  code: number
  msg: string
  detail: T
  timestamp?: number
}

export interface ApiClientErrorResponse {
  code: number
  errMsg: string
  path: string
  timestamp?: number
}
