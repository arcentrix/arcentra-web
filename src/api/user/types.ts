import type { UserInfo as BaseUserInfo } from '@/models/user'

// 扩展基础 UserInfo 类型
export interface UserInfo extends BaseUserInfo {
  id?: string
  name?: string
  role?: string
  createdAt?: string
  updatedAt?: string
}

