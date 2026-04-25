import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NotFound: FC = () => {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-6'>
      <div className='text-center space-y-2'>
        <h1 className='text-7xl font-bold tracking-tighter text-primary'>404</h1>
        <h2 className='text-xl font-semibold text-foreground'>Page not found</h2>
        <p className='text-sm text-muted-foreground max-w-sm'>
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button asChild variant='outline'>
        <Link to='/'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  )
}

export default NotFound
