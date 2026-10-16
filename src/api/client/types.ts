import type { AxiosRequestConfig } from "axios";

/**
 * API Request Config
 */
export type RequestConfig = AxiosRequestConfig & {
  silence?: boolean;
  /** Never retain or expose response diagnostics or request bodies for secrets. */
  sensitive?: boolean;
};

export interface ApiClientResponse<T = any> {
  code: number;
  msg: string;
  detail: T;
  timestamp?: number;
}

export interface ApiClientErrorResponse {
  code: number;
  errMsg: string;
  path: string;
  timestamp?: number;
}
