import type { FC } from 'react'
import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import authStore from '@/store/auth'
import storage from '@/lib/storage'

interface AuthGuardProps {}

const AuthGuard: FC<AuthGuardProps> = () => {
  const navigate = useNavigate()
  const auth = authStore.useState()

  useEffect(() => {
    if (!auth.initialized) {
      storage.set('LOGIN_FALLBACK_URL', window.location.href)
      navigate('/login')
    }
  }, [navigate, auth.initialized])

  if (auth.initialized) return <Outlet />
  return null
}

export default AuthGuard
