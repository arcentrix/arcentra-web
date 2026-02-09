import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { AlertCircle } from 'lucide-react'
import { Apis } from '@/api'
import userStore from '@/store/user'
import authStore from '@/store/auth'
import { Icons } from '@/components/ui/icons'

export function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const { type } = useParams<{ type: 'oauth2' | 'oidc' }>()
  const [error, setError] = useState<string>('')
  const hasHandledRef = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search)
      if (hasHandledRef.current) {
        return
      }
      hasHandledRef.current = true
      try {
        // 从 URL 获取授权码
        const code = params.get('code')
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')
        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        if (!code) {
          throw new Error('Authorization code not found')
        }

        // 调用统一的回调处理 API
        if (!type) {
          throw new Error('Provider type not specified')
        }

        const state = params.get('state') || 'no-state'
        const backendRedirectKey = `OAUTH_BACKEND_REDIRECTED:${state}`
        if (!sessionStorage.getItem(backendRedirectKey)) {
          sessionStorage.setItem(backendRedirectKey, `${Date.now()}`)
          const redirectUrl = `/api/v1/identity/callback/${type}?${params.toString()}`
          window.location.href = redirectUrl
          return
        }

        const userInfo = await Apis.user.getUserInfo()
        userStore.updateState((state) => {
          state.userinfo = userInfo
          state.role = (userInfo as any).role || 'user'
        })
        authStore.updateState((state) => {
          state.initialized = true
        })
        toast.success('Login successful!', 'Welcome back to Arcentra.')
        navigate('/')
      } catch (error) {
        const errorMessage = (error as Error).message
        setError(errorMessage)
        toast.error(errorMessage)
        
        // 3 秒后跳转回登录页
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    }

    handleCallback()
  }, [location, navigate, type])

  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='mx-auto h-12 w-12 text-destructive mb-4' />
          <h1 className='text-2xl font-bold mb-2'>Authentication Failed</h1>
          <p className='text-muted-foreground mb-4'>{error}</p>
          <p className='text-sm text-muted-foreground'>Redirecting to login page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='text-center'>
        <Icons.Spinner className='mx-auto h-12 w-12 animate-spin mb-4' />
        <h1 className='text-2xl font-bold mb-2'>Authenticating...</h1>
        <p className='text-muted-foreground'>Please wait while we complete your login.</p>
      </div>
    </div>
  )
}

