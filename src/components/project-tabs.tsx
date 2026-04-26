import { Link } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'overview', label: 'Overview', match: '' },
  { value: 'pipelines', label: 'Pipelines', match: '/pipelines' },
  { value: 'deployments', label: 'Deployments', match: '/deployments' },
  { value: 'artifacts', label: 'Artifacts', match: '/artifacts' },
  { value: 'environments', label: 'Environments', match: '/environments' },
  { value: 'secrets', label: 'Secrets', match: '/secrets' },
  { value: 'members', label: 'Members', match: '/members' },
  { value: 'settings', label: 'Settings', match: '/settings' },
] as const

export function ProjectTabs({
  projectId,
  pathname,
}: {
  projectId: string
  pathname: string
}) {
  const base = `/projects/${projectId}`
  const sub = pathname.startsWith(base) ? pathname.slice(base.length) : ''

  // map current sub-path to tab value (handles nested routes like /pipelines/runs)
  let active: (typeof TABS)[number]['value'] = 'overview'
  for (const tab of TABS) {
    if (tab.match === '') continue
    if (sub === tab.match || sub.startsWith(`${tab.match}/`)) {
      active = tab.value
      break
    }
  }

  return (
    <Tabs value={active} className='w-full'>
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} asChild>
            <Link to={`${base}${tab.match}`}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
