import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import authStore from '@/store/auth'
import userStore from '@/store/user'
import storage from '@/lib/storage'
import { getCookie } from '@/lib/utils'
import { Apis } from '@/api'

interface AuthGuardProps {}

const AuthGuard: FC<AuthGuardProps> = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = authStore.useState()
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const pathname = location.pathname || window.location.pathname
      const isPublicPath = (path: string) =>
        path === '/login' || path === '/register' || path.startsWith('/auth/callback')
      if (isPublicPath(pathname)) {
        return
      }
      if (auth.initialized) {
        return
      }

      // 如果正在检查，避免重复请求
      if (isChecking) {
        return
      }

      setIsChecking(true)
      try {
        const currentPath = window.location.pathname
        if (isPublicPath(currentPath)) {
          return
        }
        // 首先尝试从 cookie 中读取 token（后端可能在 cookie 中设置了 token）
        const { getAllCookies } = await import('@/lib/utils')
        const allCookies = getAllCookies()
        
        // 调试：打印所有 cookie（仅在开发环境）
        if (import.meta.env.DEV) {
          console.log('All cookies:', allCookies)
        }
        
        // 尝试多种常见的 cookie 名称
        const possibleTokenNames = [
          'token',
          'access_token',
          'accessToken',
          'auth_token',
          'Authorization',
          'authorization',
          'jwt',
          'jwt_token',
          'bearer_token',
        ]
        
        let cookieToken: string | null = null
        for (const name of possibleTokenNames) {
          const token = getCookie(name) || allCookies[name]
          if (token) {
            cookieToken = token
            if (import.meta.env.DEV) {
              console.log(`Token found in cookie: ${name}`)
            }
            break
          }
        }
        
        // 如果没找到，尝试查找包含 'token' 或 'auth' 的 cookie
        if (!cookieToken) {
          for (const [name, value] of Object.entries(allCookies)) {
            const lowerName = name.toLowerCase()
            if ((lowerName.includes('token') || lowerName.includes('auth')) && value) {
              cookieToken = value
              if (import.meta.env.DEV) {
                console.log(`Token found in cookie (by pattern): ${name}`)
              }
              break
            }
          }
        }
        if (cookieToken) {
          // 如果从 cookie 中读取到 token，设置到 authStore
          const tokens = {
            accessToken: cookieToken,
            refreshToken: cookieToken, // 如果没有单独的 refreshToken，使用相同的 token
          }
          authStore.setTokens(tokens)
          
          if (import.meta.env.DEV) {
            console.log('Token set to authStore, accessToken length:', cookieToken.length)
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('No token found in cookies, available cookies:', Object.keys(allCookies))
          }
        }

        // 后端支持 Authorization header 和 cookie 二选一
        // 先直接尝试获取用户信息，后端会从 cookie 中读取 token
        let userInfo
        try {
          userInfo = await Apis.user.getUserInfo()
        } catch (userInfoError) {
          // 如果获取用户信息失败，可能是因为后端需要 token
          // 如果没有从 cookie 中读取到 token，尝试通过 refreshToken API 获取 token
          if (!cookieToken) {
            try {
              // 调用 refreshToken API，后端会从 cookie 中读取 token 并返回给前端
              const tokenResponse = await Apis.user.refreshToken()
              if (tokenResponse?.token) {
                // refreshToken 返回的是 { token: string }，需要转换为 AuthToken 格式
                const tokens = {
                  accessToken: tokenResponse.token,
                  refreshToken: tokenResponse.token, // 如果没有单独的 refreshToken，使用相同的 token
                }
                authStore.setTokens(tokens)
                
                if (import.meta.env.DEV) {
                  console.log('Token obtained from refreshToken API')
                }
                
                // 获取到 token 后，再次尝试获取用户信息
                userInfo = await Apis.user.getUserInfo()
              } else {
                throw userInfoError
              }
            } catch (tokenError) {
              if (import.meta.env.DEV) {
                console.log('Failed to get token from refreshToken API:', tokenError)
              }
              // 如果 refreshToken 也失败，抛出原始错误
              throw userInfoError
            }
          } else {
            throw userInfoError
          }
        }
        
        if (userInfo) {
          // 如果能够获取到用户信息，说明后端已经设置了认证信息
          
          // 如果还是没有 token，但能获取用户信息，说明后端使用 cookie 认证
          // 这种情况下，我们需要设置一个标记，表示认证已通过
          const currentAuthState = authStore.getState()
          if (!currentAuthState.accessToken) {
            if (import.meta.env.DEV) {
              console.log('User info exists but no token, backend uses cookie authentication')
            }
            // 设置一个标记，表示认证已通过
            // 后续请求会通过 cookie 自动发送，不需要 Authorization header
            authStore.updateState((state) => {
              state.initialized = true
            })
          }
          
          // 更新用户信息
          userStore.updateState((state) => {
            state.userinfo = userInfo
            // 如果 userInfo 中有 role，使用它；否则默认为 'user'
            state.role = (userInfo as any).role || 'user'
          })
          
          return
        }
      } catch (error) {
        // 无法获取用户信息，说明未认证，跳转到登录页
        console.log('User not authenticated, redirecting to login:', error)
      } finally {
        setIsChecking(false)
      }

      // 如果无法获取用户信息，跳转到登录页
      if (!auth.initialized) {
        storage.set('LOGIN_FALLBACK_URL', window.location.href)
        navigate('/login')
      }
    }

    checkAuth()
  }, [navigate, auth.initialized, isChecking, location.pathname])

  if (auth.initialized) return <Outlet />
  return null
}

export default AuthGuard
