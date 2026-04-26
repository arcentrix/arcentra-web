import { useEffect, type FC } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileLock2, KeyRound, Plus, Shield, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SecureOverview from './Overview'
import SecureIdentity from './Identity'
import SecureSecrets from './Secrets'
import SecurePolicies from './Policies'
import SecureAudit from './Audit'

type SecureTab = 'overview' | 'identity' | 'secrets' | 'policies' | 'audit'

const VALID_TABS: SecureTab[] = ['overview', 'identity', 'secrets', 'policies', 'audit']

function isSecureTab(value: string | null): value is SecureTab {
  return !!value && (VALID_TABS as string[]).includes(value)
}

const Secure: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: SecureTab = isSecureTab(rawTab) ? rawTab : 'overview'

  // strip invalid tab params from URL
  useEffect(() => {
    if (rawTab && !isSecureTab(rawTab)) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }
  }, [rawTab, searchParams, setSearchParams])

  const onTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    setSearchParams(params, { replace: true })
  }

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h2 className='flex items-center gap-3 text-3xl font-bold tracking-tight'>
            <Shield className='h-8 w-8 text-emerald-500' />
            Secure
          </h2>
          <p className='mt-1 max-w-2xl text-muted-foreground'>
            Control identity, secrets, policies and audit trails across this workspace.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='outline' className='gap-1.5'>
            <UserPlus className='h-4 w-4' />
            Invite Member
          </Button>
          <Button size='sm' variant='outline' className='gap-1.5'>
            <KeyRound className='h-4 w-4' />
            Create Secret
          </Button>
          <Button size='sm' className='gap-1.5'>
            <FileLock2 className='h-4 w-4' />
            <Plus className='h-3.5 w-3.5' />
            New Policy
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className='w-full'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='identity'>Identity</TabsTrigger>
          <TabsTrigger value='secrets'>Secrets</TabsTrigger>
          <TabsTrigger value='policies'>Policies</TabsTrigger>
          <TabsTrigger value='audit'>Audit</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-6'>
          <SecureOverview onNavigate={(t) => onTabChange(t)} />
        </TabsContent>
        <TabsContent value='identity' className='mt-6'>
          <SecureIdentity />
        </TabsContent>
        <TabsContent value='secrets' className='mt-6'>
          <SecureSecrets />
        </TabsContent>
        <TabsContent value='policies' className='mt-6'>
          <SecurePolicies />
        </TabsContent>
        <TabsContent value='audit' className='mt-6'>
          <SecureAudit />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Secure
