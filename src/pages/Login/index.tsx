import type { FC } from 'react'
import { APP_LOGO } from '@/constants/assets'
import { LoginForm } from '@/components/login-form'

interface LoginProps {}

const Login: FC<LoginProps> = () => {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='flex flex-col gap-4 p-6 md:p-10'>
        <div className='flex justify-center gap-2 md:justify-start'>
          <a href='/' className='flex items-center gap-2 font-medium'>
            <div className='bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md p-1'>
              <img alt='Arcentra' src={APP_LOGO} className='h-full w-full object-contain' />
            </div>
            Arcentra
          </a>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='w-full max-w-xs'>
            <LoginForm />
          </div>
        </div>
      </div>
      <div className='bg-muted relative hidden lg:block'>
        <div className='absolute inset-0 flex items-center justify-center p-10'>
          <div className='max-w-md space-y-4 text-center'>
            <blockquote className='space-y-2'>
              <p className='text-2xl font-semibold'>&ldquo;A Cloud-native CI/CD architecture hub and automation platform&rdquo;</p>
              <footer className='text-sm text-muted-foreground'>— Arcentra Team</footer>
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
