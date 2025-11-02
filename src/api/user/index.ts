import { get, post, put } from '../client'
import type { UserInfo } from '@/models/user'

// 获取用户信息
function getUserInfo() {
  return get<UserInfo>('/user/getUserInfo', { silence: true })
}

// 更新用户信息
function updateUserInfo(data: { nickname?: string; email?: string; phone?: string; avatar?: string }) {
  return put<UserInfo>('/user/updateUserInfo', data)
}

// 登出
function logout() {
  return post<{ msg: string }>('/user/logout', {})
}

// 刷新 token
function refreshToken() {
  return get<{ token: string }>('/user/refresh', { silence: true })
}

// 邀请用户
function inviteUser(data: { email: string; role?: string }) {
  return post('/user/invite', data, { silence: true })
}

// 上传头像
function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return post<{ url: string }>('/user/uploadAvatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export default {
  getUserInfo,
  updateUserInfo,
  logout,
  refreshToken,
  inviteUser,
  uploadAvatar,
}

