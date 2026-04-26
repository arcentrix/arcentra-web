import type { FC } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileLock2,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Users2,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'success' | 'warning' | 'critical' | 'info'
}

const TONE_RING: Record<NonNullable<MetricCardProps['tone']>, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  critical: 'text-rose-500',
  info: 'text-sky-500',
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'info' }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <Icon className={cn('h-4 w-4', TONE_RING[tone])} />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
      </CardContent>
    </Card>
  )
}

interface EntryCardProps {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  tone: 'emerald' | 'sky' | 'amber' | 'violet'
  meta?: string
}

const TONE_BG: Record<EntryCardProps['tone'], string> = {
  emerald: 'bg-emerald-500/10 text-emerald-500',
  sky: 'bg-sky-500/10 text-sky-500',
  amber: 'bg-amber-500/10 text-amber-500',
  violet: 'bg-violet-500/10 text-violet-500',
}

function EntryCard({ icon: Icon, title, description, onClick, tone, meta }: EntryCardProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='group flex items-start gap-4 rounded-lg border bg-card p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm cursor-pointer'
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          TONE_BG[tone],
        )}
      >
        <Icon className='h-5 w-5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <h3 className='text-base font-semibold'>{title}</h3>
          <ArrowUpRight className='h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground' />
        </div>
        <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>{description}</p>
        {meta && (
          <div className='mt-3 text-xs text-muted-foreground'>{meta}</div>
        )}
      </div>
    </button>
  )
}

const RECENT_EVENTS: Array<{
  id: string
  actor: string
  action: string
  target: string
  time: string
  severity: 'info' | 'warning' | 'critical'
}> = [
  {
    id: 'e1',
    actor: 'root',
    action: 'changed role of',
    target: 'alice → admin',
    time: '2m ago',
    severity: 'warning',
  },
  {
    id: 'e2',
    actor: 'ci-bot',
    action: 'accessed secret',
    target: 'DOCKER_TOKEN',
    time: '12m ago',
    severity: 'info',
  },
  {
    id: 'e3',
    actor: 'pipeline-23',
    action: 'deployed to',
    target: 'production',
    time: '38m ago',
    severity: 'info',
  },
  {
    id: 'e4',
    actor: 'agent-03',
    action: 'registered new runner token',
    target: 'scope: build:*',
    time: '1h ago',
    severity: 'info',
  },
  {
    id: 'e5',
    actor: 'agent-07',
    action: 'failed MFA challenge',
    target: '3 attempts',
    time: '2h ago',
    severity: 'critical',
  },
]

const RISK_QUEUE: Array<{
  id: string
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high'
}> = [
  {
    id: 'r1',
    title: 'GCP Credentials secret expires in 5 days',
    detail: 'Consumed by 3 pipelines · auto-rotation off',
    severity: 'high',
  },
  {
    id: 'r2',
    title: 'Production deploy policy missing approval rule',
    detail: 'Affecting `web-app` and `api-service`',
    severity: 'medium',
  },
  {
    id: 'r3',
    title: '2 admin users do not have MFA enabled',
    detail: 'alice@arcentra.io · bob@arcentra.io',
    severity: 'medium',
  },
]

function severityBadge(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'critical':
      return (
        <Badge variant='critical' className='gap-1'>
          <ShieldAlert className='h-3 w-3' />
          Critical
        </Badge>
      )
    case 'warning':
      return (
        <Badge variant='warning' className='gap-1'>
          <ShieldAlert className='h-3 w-3' />
          Warning
        </Badge>
      )
    default:
      return (
        <Badge variant='secondary' className='gap-1'>
          <CheckCircle2 className='h-3 w-3' />
          Info
        </Badge>
      )
  }
}

function riskBadge(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return <Badge variant='critical'>High</Badge>
  if (severity === 'medium') return <Badge variant='warning'>Medium</Badge>
  return <Badge variant='info'>Low</Badge>
}

interface SecureOverviewProps {
  onNavigate: (tab: 'identity' | 'secrets' | 'policies' | 'audit') => void
}

const SecureOverview: FC<SecureOverviewProps> = ({ onNavigate }) => {
  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          label='Security Score'
          value='92 / 100'
          hint='2 points above last week'
          icon={ShieldCheck}
          tone='success'
        />
        <MetricCard
          label='Active Members'
          value='18'
          hint='2 invited · 16 with MFA'
          icon={Users2}
          tone='info'
        />
        <MetricCard
          label='Expiring Tokens'
          value='3'
          hint='in next 7 days'
          icon={Clock}
          tone='warning'
        />
        <MetricCard
          label='Policy Alerts'
          value='2'
          hint='Open warnings'
          icon={ShieldAlert}
          tone='critical'
        />
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <EntryCard
          icon={Users2}
          title='Identity & Access'
          description='Manage users, teams, roles, service accounts and tokens.'
          tone='sky'
          meta='18 users · 4 teams · 9 roles'
          onClick={() => onNavigate('identity')}
        />
        <EntryCard
          icon={KeyRound}
          title='Secrets Vault'
          description='Workspace secrets, providers, sync status and rotation schedule.'
          tone='amber'
          meta='14 secrets · 2 providers · 1 due for rotation'
          onClick={() => onNavigate('secrets')}
        />
        <EntryCard
          icon={FileLock2}
          title='Policy Guard'
          description='Define access rules, deployment gates and approval flows.'
          tone='violet'
          meta='6 policies · 2 alerts'
          onClick={() => onNavigate('policies')}
        />
        <EntryCard
          icon={Activity}
          title='Audit Trail'
          description='Permission changes, secret access and sensitive platform activity.'
          tone='emerald'
          meta='Last 24h: 142 events · 1 critical'
          onClick={() => onNavigate('audit')}
        />
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader className='flex flex-row items-start justify-between space-y-0'>
            <div>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Activity from the last hour, across the workspace.</CardDescription>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='gap-1'
              onClick={() => onNavigate('audit')}
            >
              View all
              <ArrowRight className='h-3.5 w-3.5' />
            </Button>
          </CardHeader>
          <CardContent>
            <ul className='divide-y'>
              {RECENT_EVENTS.map((event) => (
                <li
                  key={event.id}
                  className='flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0'
                >
                  <div className='min-w-0 flex-1'>
                    <span className='font-medium'>{event.actor}</span>
                    <span className='text-muted-foreground'> {event.action} </span>
                    <span className='font-medium'>{event.target}</span>
                  </div>
                  <span className='shrink-0 text-xs text-muted-foreground'>{event.time}</span>
                  {severityBadge(event.severity)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Queue</CardTitle>
            <CardDescription>Items that need your attention.</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3'>
            {RISK_QUEUE.map((risk) => (
              <button
                key={risk.id}
                type='button'
                className='group flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent/40 cursor-pointer'
              >
                <div className='min-w-0 flex-1'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='line-clamp-2 text-sm font-medium'>{risk.title}</div>
                    {riskBadge(risk.severity)}
                  </div>
                  <div className='mt-1 line-clamp-1 text-xs text-muted-foreground'>{risk.detail}</div>
                </div>
                <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground' />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SecureOverview
