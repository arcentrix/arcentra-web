import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Apis } from '@/api'

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<'form'>) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)
  const { register, handleSubmit } = useForm()
  const navigate = useNavigate()

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true)

    // 验证密码匹配
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match')
      setIsLoading(false)
      return
    }

    // 验证密码长度
    if (data.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    try {
      // 使用 email 前缀作为 username
      const username = data.email.split('@')[0]
      
      await Apis.auth.register({
        username: username,
        email: data.email,
        password: data.password,
      })
      toast.success('Registration successful!', 'Please login to continue.')
      navigate('/login')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  })

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className='flex flex-col items-center gap-1 text-center'>
          <h1 className='text-2xl font-bold'>Create your account</h1>
          <p className='text-muted-foreground text-sm text-balance'>
            Fill in the form below to create your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor='name'>Full Name</FieldLabel>
          <Input
            {...register('name', { required: true })}
            id='name'
            type='text'
            placeholder='John Doe'
            disabled={isLoading}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='email'>Email</FieldLabel>
          <Input
            {...register('email', { required: true })}
            id='email'
            type='email'
            placeholder='m@example.com'
            autoComplete='email'
            disabled={isLoading}
            required
          />
          <FieldDescription>
            We&apos;ll use this to contact you. We will not share your email with anyone else.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor='password'>Password</FieldLabel>
          <div className='relative'>
            <Input
              {...register('password', { required: true, minLength: 8 })}
              id='password'
              type={showPassword ? 'text' : 'password'}
              autoComplete='new-password'
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
          <FieldDescription>
            Must be at least 8 characters long.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor='confirm-password'>Confirm Password</FieldLabel>
          <div className='relative'>
            <Input
              {...register('confirmPassword', { required: true })}
              id='confirm-password'
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete='new-password'
              disabled={isLoading}
              required
              className='pr-10'
            />
            <button
              type='button'
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              disabled={isLoading}
            >
              {showConfirmPassword ? (
                <EyeOff className='h-4 w-4' />
              ) : (
                <Eye className='h-4 w-4' />
              )}
            </button>
          </div>
          <FieldDescription>Please confirm your password.</FieldDescription>
        </Field>
        <Field>
          <Button type='submit' disabled={isLoading} className='w-full'>
            {isLoading ? <Icons.Spinner className='mr-2 h-4 w-4 animate-spin' /> : null}
            Create Account
          </Button>
        </Field>
        <Field>
          <FieldDescription className='text-center'>
            Already have an account?{' '}
            <a href='/login' className='underline underline-offset-4'>
              Sign in
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}

