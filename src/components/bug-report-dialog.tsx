import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import { ENV } from '@/constants/env'
import { Apis } from '@/api'
import { Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface BugReportFormData {
  title: string
  description: string
}

export function BugReportDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<BugReportFormData>({
    defaultValues: {
      title: '',
      description: '',
    },
  })

  const description = watch('description')
  const descriptionLength = description?.length || 0

  const onSubmit = handleSubmit(async (data) => {
    // 验证
    if (data.title.length < 5) {
      toast.error('Invalid title', 'Bug title must be at least 5 characters.')
      return
    }
    if (data.title.length > 100) {
      toast.error('Invalid title', 'Bug title must be at most 100 characters.')
      return
    }
    if (data.description.length < 20) {
      toast.error('Invalid description', 'Description must be at least 20 characters.')
      return
    }
    if (data.description.length > 500) {
      toast.error('Invalid description', 'Description must be at most 500 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      // 尝试通过后端 API 创建 GitHub issue
      try {
        const response = await Apis.github.createIssue({
          title: data.title,
          description: data.description,
        })

        // 成功后跳转到已创建的 issue
        window.open(response.issueUrl, '_blank', 'noopener,noreferrer')

        toast.success(
          'Bug report created',
          `Issue #${response.issueNumber} has been created successfully.`
        )
        setIsOpen(false)
        reset()
      } catch (apiError) {
        // 如果后端 API 不可用（404），使用 GitHub URL 跳转方式
        console.warn('Backend API not available, using GitHub URL redirect:', apiError)
        
        const issueTitle = encodeURIComponent(`[Bug] ${data.title}`)
        const issueBody = encodeURIComponent(
          `## Bug Description\n\n${data.description}\n\n---\n\n**Reported via Arcade Platform**\n- Browser: ${navigator.userAgent}\n- Timestamp: ${new Date().toISOString()}`
        )
        const githubUrl = `https://github.com/${ENV.GITHUB_REPO}/issues/new?title=${issueTitle}&body=${issueBody}&labels=bug`

        // 打开 GitHub 创建 issue 页面
        window.open(githubUrl, '_blank', 'noopener,noreferrer')

        toast.success('Opening GitHub', 'Redirecting to GitHub to create your issue.')
        setIsOpen(false)
        reset()
      }
    } catch (error) {
      toast.error('Failed to create bug report', (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type='button'
          className='flex h-7 w-full items-center gap-2.5 overflow-hidden rounded-md px-1.5 text-xs ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 cursor-pointer'
        >
          <Bug className='h-4 w-4 shrink-0 translate-x-0.5 text-muted-foreground' />
          <span className='line-clamp-1 font-medium text-muted-foreground'>Report a Bug</span>
        </button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[500px]'>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Bug Report</DialogTitle>
            <DialogDescription>
              Help us improve by reporting bugs you encounter.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor='title'>Bug Title</FieldLabel>
                <Input
                  id='title'
                  {...register('title', {
                    required: 'Title is required',
                    minLength: { value: 5, message: 'Title must be at least 5 characters' },
                    maxLength: { value: 100, message: 'Title must be at most 100 characters' },
                  })}
                  placeholder='Login button not working on mobile'
                  autoComplete='off'
                  disabled={isSubmitting}
                />
                {errors.title && (
                  <FieldDescription className='text-destructive text-sm'>
                    {errors.title.message}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor='description'>Description</FieldLabel>
                <div className='relative'>
                  <textarea
                    id='description'
                    {...register('description', {
                      required: 'Description is required',
                      minLength: { value: 20, message: 'Description must be at least 20 characters' },
                      maxLength: { value: 500, message: 'Description must be at most 500 characters' },
                    })}
                    placeholder="I'm having an issue with the login button on mobile..."
                    rows={6}
                    className='flex min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isSubmitting}
                  />
                  <div className='absolute bottom-2 right-2 text-xs text-muted-foreground tabular-nums'>
                    {descriptionLength}/500
                  </div>
                </div>
                <FieldDescription>
                  Include steps to reproduce, expected behavior, and what actually happened.
                </FieldDescription>
                {errors.description && (
                  <FieldDescription className='text-destructive text-sm'>
                    {errors.description.message}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline' type='button' disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting && <Icons.Spinner className='mr-2 h-4 w-4 animate-spin' />}
              {isSubmitting ? 'Creating...' : 'Create Issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

