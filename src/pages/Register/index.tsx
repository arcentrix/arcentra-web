import type { FC } from 'react'
import LOGO from '@/assets/logo.png'
import { RegisterForm } from '@/components/register-form'

interface RegisterProps {}

const Register: FC<RegisterProps> = () => {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='flex flex-col gap-4 p-6 md:p-10'>
        <div className='flex justify-center gap-2 md:justify-start'>
          <a href='/' className='flex items-center gap-2 font-medium'>
            <div className='bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md p-1'>
              <img alt='Arcade' src={LOGO} className='h-full w-full object-contain' />
            </div>
            Arcade
          </a>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='w-full max-w-xs'>
            <RegisterForm />
          </div>
        </div>
      </div>
      <div className='bg-muted relative hidden lg:block'>
        <img
          src='/placeholder.svg'
          alt='Register'
          className='absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale'
        />
      </div>
    </div>
  )
}

export default Register

