import { useMemo, useState, type FC } from 'react'
import { Download, KeyRound, ScrollText, Search, ShieldAlert, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlaceholderPanel } from '@/components/placeholder-panel'

interface AuditEvent {
  id: string
  actor: string
  action: string
  resource: string
  time: string
  severity: 'info' | 'warning' | 'critical'
}

const EVENTS: AuditEvent[] = [
  {
    id: 'a1',
    actor: 'root',
    action: 'role.update',
    resource: 'user:alice → admin',
    time: '2m ago',
    severity: 'warning',
  },
  {
    id: 'a2',
    actor: 'ci-bot',
    action: 'secret.access',
    resource: 'secret:DOCKER_TOKEN',
    time: '12m ago',
    severity: 'info',
  },
  {
    id: 'a3',
    actor: 'pipeline-23',
    action: 'deployment.create',
    resource: 'env:production',
    time: '38m ago',
    severity: 'info',
  },
  {
    id: 'a4',
    actor: 'agent-03',
    action: 'token.register',
    resource: 'token:runner-build-*',
    time: '1h ago',
    severity: 'info',
  },
  {
    id: 'a5',
    actor: 'agent-07',
    action: 'auth.mfa_failed',
    resource: 'mfa:3 attempts',
    time: '2h ago',
    severity: 'critical',
  },
  {
    id: 'a6',
    actor: 'eva',
    action: 'policy.update',
    resource: 'policy:approval-prod',
    time: '5h ago',
    severity: 'info',
  },
]

function severityBadge(severity: AuditEvent['severity']) {
  if (severity === 'critical')
    return (
      <Badge variant='critical' className='gap-1'>
        <ShieldAlert className='h-3 w-3' />
        Critical
      </Badge>
    )
  if (severity === 'warning')
    return (
      <Badge variant='warning' className='gap-1'>
        <ShieldAlert className='h-3 w-3' />
        Warning
      </Badge>
    )
  return <Badge variant='secondary'>Info</Badge>
}

const SecureAudit: FC = () => {
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<string>('all')

  const filtered = useMemo(() => {
    return EVENTS.filter((e) => {
      const matchQuery =
        !query.trim() ||
        [e.actor, e.action, e.resource].some((v) =>
          v.toLowerCase().includes(query.toLowerCase()),
        )
      const matchSeverity = severity === 'all' || e.severity === severity
      return matchQuery && matchSeverity
    })
  }, [query, severity])

  return (
    <Tabs defaultValue='events' className='w-full'>
      <TabsList>
        <TabsTrigger value='events'>Events</TabsTrigger>
        <TabsTrigger value='permissions'>Permission Changes</TabsTrigger>
        <TabsTrigger value='secret-access'>Secret Access</TabsTrigger>
        <TabsTrigger value='token-usage'>Token Usage</TabsTrigger>
      </TabsList>

      <TabsContent value='events' className='mt-4 space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative flex-1 min-w-[240px] max-w-md'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Filter actor, action or resource…'
              className='pl-8'
            />
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='Severity' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All severities</SelectItem>
              <SelectItem value='info'>Info</SelectItem>
              <SelectItem value='warning'>Warning</SelectItem>
              <SelectItem value='critical'>Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline' size='sm' className='ml-auto gap-1.5'>
            <Download className='h-4 w-4' />
            Export
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className='font-medium'>{event.actor}</TableCell>
                  <TableCell>
                    <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>{event.action}</code>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{event.resource}</TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{event.time}</TableCell>
                  <TableCell>{severityBadge(event.severity)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='py-8 text-center text-sm text-muted-foreground'>
                    No events match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value='permissions' className='mt-4'>
        <PlaceholderPanel
          icon={UserCog}
          title='Permission changes'
          description='Track every role, team and policy assignment change over time.'
        />
      </TabsContent>

      <TabsContent value='secret-access' className='mt-4'>
        <PlaceholderPanel
          icon={KeyRound}
          title='Secret access log'
          description='See who or what accessed which secret, with full source context.'
        />
      </TabsContent>

      <TabsContent value='token-usage' className='mt-4'>
        <PlaceholderPanel
          icon={ScrollText}
          title='Token usage'
          description='Per-token usage with rate limits, scopes and last seen timestamps.'
        />
      </TabsContent>
    </Tabs>
  )
}

export default SecureAudit
