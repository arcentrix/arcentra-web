import { toast as reactToastify, ToastOptions } from 'react-toastify'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface ToastContentProps {
  title: string
  description?: string | React.ReactNode
  icon: React.ReactNode
  iconClassName?: string
}

function ToastContent({ title, description, icon, iconClassName }: ToastContentProps) {
  return (
    <div className='flex items-center gap-3'>
      <div className={`flex-shrink-0 ${iconClassName || ''}`}>{icon}</div>
      <div className='flex-1'>
        <div className='font-medium leading-tight'>{title}</div>
        {description && (
          <div className='text-sm opacity-90 mt-1 leading-relaxed'>
            {typeof description === 'string' ? <p>{description}</p> : description}
          </div>
        )}
      </div>
    </div>
  )
}

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

export const toast = {
  success: (title: string, description?: string | React.ReactNode, options?: ToastOptions) => {
    reactToastify.success(
      <ToastContent
        icon={<CheckCircle2 className='h-5 w-5' />}
        iconClassName='text-primary'
        title={title}
        description={description}
      />,
      { ...defaultOptions, ...options }
    )
  },

  error: (title: string, description?: string | React.ReactNode, options?: ToastOptions) => {
    reactToastify.error(
      <ToastContent
        icon={<AlertCircle className='h-5 w-5' />}
        iconClassName='text-destructive'
        title={title}
        description={description}
      />,
      { ...defaultOptions, ...options }
    )
  },
}

