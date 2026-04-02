import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Eye, EyeOff, KeyRound, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Apis } from '@/api'
import userStore from '@/store/user'
import authStore from '@/store/auth'
import { APP_LOGO } from '@/constants/assets'
import type { IdentityProvider } from '@/api/auth/types'

const providerIcons: Record<string, React.ReactNode> = {
  github: (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
      <path
        d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
        fill='currentColor'
      />
    </svg>
  ),
  google: (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
      <path
        d='M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z'
        fill='currentColor'
      />
    </svg>
  ),
  slack: (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
      <path
        d='M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z'
        fill='currentColor'
      />
    </svg>
  ),
  apple: (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
      <path
        d='M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'
        fill='currentColor'
      />
    </svg>
  ),
}

function getProviderIcon(name: string, providerType: string) {
  const key = name.toLowerCase()
  if (providerIcons[key]) return providerIcons[key]
  if (providerType === 'ldap') return <Network className='size-4' />
  return <KeyRound className='size-4' />
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [providers, setProviders] = useState<IdentityProvider[]>([])
  const { register, handleSubmit } = useForm()
  const navigate = useNavigate()

  useEffect(() => {
    Apis.auth.getAvailableProviders()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.priority - b.priority)
        setProviders(sorted)
      })
      .catch(() => {})
  }, [])

  const handleProviderLogin = (provider: IdentityProvider) => {
    try {
      setIsLoading(true)
      const providerName = provider.name
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('OAUTH_BACKEND_REDIRECTED'))
        .forEach((key) => sessionStorage.removeItem(key))
      sessionStorage.removeItem('OAUTH_INTENT')

      const redirectUri = `${window.location.origin}/auth/callback/${providerName}`
      const baseUrl = import.meta.env.VITE_API_CLIENT_URL || '/api/v1'
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      const authPath = provider.authUrl.replace(/^\/api\/v1/, '')
      const params = new URLSearchParams({ redirect_uri: redirectUri, redirectUri })
      const url = `${normalizedBase}${authPath}?${params.toString()}`

      sessionStorage.setItem('OAUTH_INTENT', JSON.stringify({ provider: providerName, ts: Date.now() }))
      window.location.href = url
    } catch (error) {
      toast.error((error as Error).message)
      setIsLoading(false)
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true)

    try {
      const response = await Apis.auth.login({
        username: data.username,
        password: data.password,
        authMethod: 'standard',
      })

      userStore.updateState((state) => {
        state.userinfo = response.userinfo
        state.role = response.role
      })
      authStore.setTokens(response.token)
      navigate('/')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  })

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className='flex flex-col items-center gap-2 text-center'>
            <a href='/' className='flex flex-col items-center gap-2 font-medium'>
              <div className='flex size-10 items-center justify-center rounded-md'>
                <img alt='Arcentra' src={APP_LOGO} className='size-8 object-contain' />
              </div>
              <span className='sr-only'>Arcentra</span>
            </a>
            <h1 className='text-xl font-bold'>Welcome to Arcentra</h1>
            <FieldDescription>
              Don&apos;t have an account?{' '}
              <a href='/register' className='underline underline-offset-4'>Sign up</a>
            </FieldDescription>
          </div>

          <Field>
            <FieldLabel htmlFor='username'>Email / Username</FieldLabel>
            <Input
              {...register('username', { required: true })}
              id='username'
              type='text'
              placeholder='m@example.com'
              autoCapitalize='none'
              autoComplete='username'
              autoCorrect='off'
              disabled={isLoading}
              required
            />
          </Field>

          <Field>
            <div className='flex items-center'>
              <FieldLabel htmlFor='password'>Password</FieldLabel>
              <a
                href='#'
                className='ml-auto text-sm underline-offset-4 hover:underline'
              >
                Forgot your password?
              </a>
            </div>
            <div className='relative'>
              <Input
                {...register('password', { required: true })}
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Enter your password'
                autoComplete='current-password'
                disabled={isLoading}
                required
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
          </Field>

          <Field>
            <Button type='submit' disabled={isLoading} className='w-full'>
              {isLoading ? <Icons.Spinner className='mr-2 h-4 w-4 animate-spin' /> : null}
              Login
            </Button>
          </Field>

          {providers.length > 0 && (
            <>
              <FieldSeparator>Or</FieldSeparator>
              <Field className={cn('grid gap-4', providers.length > 1 && 'sm:grid-cols-2')}>
                {providers.map((provider) => (
                  <Button
                    key={provider.name}
                    variant='outline'
                    type='button'
                    disabled={isLoading}
                    onClick={() => handleProviderLogin(provider)}
                  >
                    {getProviderIcon(provider.name, provider.providerType)}
                    {provider.name}
                  </Button>
                ))}
              </Field>
            </>
          )}
        </FieldGroup>
      </form>
      <FieldDescription className='px-6 text-center'>
        By clicking continue, you agree to our{' '}
        <a href='#' className='underline underline-offset-4'>Terms of Service</a> and{' '}
        <a href='#' className='underline underline-offset-4'>Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
