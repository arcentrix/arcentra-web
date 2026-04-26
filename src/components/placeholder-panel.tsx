import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlaceholderPanelProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function PlaceholderPanel({
  icon: Icon,
  title,
  description,
  className,
}: PlaceholderPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 px-6 py-16 text-center',
        className,
      )}
    >
      <div className='flex h-10 w-10 items-center justify-center rounded-md bg-background'>
        <Icon className='h-5 w-5 text-muted-foreground' />
      </div>
      <div>
        <div className='text-base font-medium text-foreground'>{title}</div>
        {description && (
          <div className='mt-1 max-w-md text-sm text-muted-foreground'>{description}</div>
        )}
      </div>
    </div>
  )
}
