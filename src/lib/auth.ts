import { Apis } from '@/api'
import authStore from '@/store/auth'
import userStore from '@/store/user'

/**
 * 清除本地认证数据
 * 不调用后端接口，用于 token 过期或强制登出
 */
export function clearLocalAuth() {
  userStore.clearUserinfo()
  authStore.clearTokens()
}

/**
 * 全局登出函数
 * 必须等待后端成功响应（code === 200）后才清除本地数据
 */
export async function logout() {
  try {
    // 调用后端登出接口，axios 拦截器会检查 code === 200
    // 如果 code !== 200，会抛出异常
    await Apis.user.logout()
  } finally {
    // 为避免注销失败导致前端卡死，始终清除本地状态
    clearLocalAuth()
  }
}

/**
 * 检查用户是否已登录
 */
export function isAuthenticated(): boolean {
  const authState = authStore.getState()
  return authState.initialized && !!authState.accessToken
}

/**
 * 获取当前用户的 token
 */
export function getAuthToken(): string | null {
  const authState = authStore.getState()
  return authState.accessToken || null
}

