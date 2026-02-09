import { get, post, put } from '../client'
import type { UserInfo } from '@/models/user'

// 全局请求去重：确保 users/fetch 在同一时间只请求一次
let pendingUserInfoRequest: Promise<UserInfo> | null = null

// 获取当前用户信息
function fetchUserInfo() {
  // 如果已经有请求正在进行，直接返回该 Promise
  if (pendingUserInfoRequest) {
    return pendingUserInfoRequest
  }

  // 创建新的请求
  const requestPromise = get<UserInfo>('/users/fetch', { silence: true })
    .then((data) => {
      // 请求完成后，清除 pending 状态
      pendingUserInfoRequest = null
      return data
    })
    .catch((error) => {
      // 请求失败后，也要清除 pending 状态
      pendingUserInfoRequest = null
      throw error
    })

  // 将请求保存
  pendingUserInfoRequest = requestPromise
  return requestPromise
}

// 更新用户信息
function updateUserInfo(userId: string, data: { fullName?: string; email?: string; phone?: string; avatar?: string }) {
  return put<UserInfo>(`/users/${userId}`, data)
}

// 登出
function logout() {
  return post<{ msg: string }>('/users/logout', {}, { silence: true })
}

// 刷新 token
function refreshToken() {
  return post<{ token: string }>('/users/refresh', {}, { silence: true })
}

// 邀请用户
function inviteUser(data: { email: string; role?: string }) {
  return post('/users/invite', data, { silence: true })
}

// 上传头像
function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return post<{ url: string }>('/users/fetch/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export default {
  getUserInfo: fetchUserInfo,
  updateUserInfo,
  logout,
  refreshToken,
  inviteUser,
  uploadAvatar,
}

