import { useEffect, useMemo, useState, type FC } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralSettingsSheet } from '@/components/general-settings-sheet'
import { listSettings, updateSetting } from '@/api/general-settings'
import type { SettingItem, SettingValue } from '@/api/general-settings/types'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { GROUPED_SETTING_NAMES, SETTINGS_GROUPS, type SettingsGroup } from './groups'
import { GroupEditSheet } from './GroupEditSheet'

const SENSITIVE_KEYWORDS = ['secret', 'key', 'salt', 'password', 'token']

function isSensitiveField(fieldName: string) {
  const lower = fieldName.toLowerCase()
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw))
}

const SensitiveValue: FC<{ value: string }> = ({ value }) => {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className='font-mono text-xs text-foreground'>
        {revealed ? value : '••••••••••'}
      </span>
      <button
        type='button'
        onClick={() => setRevealed((v) => !v)}
        className='inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer'
        aria-label={revealed ? 'Hide value' : 'Show value'}
      >
        {revealed ? <EyeOff className='h-3 w-3' /> : <Eye className='h-3 w-3' />}
      </button>
    </span>
  )
}

function renderScalar(label: string, value: unknown): React.ReactNode {
  if (value === undefined || value === null) {
    return <span className='font-mono text-xs italic text-muted-foreground'>—</span>
  }
  if (typeof value === 'string') {
    if (isSensitiveField(label)) return <SensitiveValue value={value} />
    return <span className='break-all font-mono text-xs text-foreground'>{value}</span>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className='font-mono text-xs text-foreground'>{String(value)}</span>
  }
  return (
    <span className='font-mono text-xs text-foreground'>
      {JSON.stringify(value)}
    </span>
  )
}

function renderRawValue(key: string, value: unknown): React.ReactNode {
  if (typeof value === 'string') {
    if (isSensitiveField(key)) return <SensitiveValue value={value} />
    return <span className='break-all font-mono text-xs text-foreground'>{value}</span>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className='font-mono text-xs text-foreground'>{String(value)}</span>
  }
  if (Array.isArray(value)) {
    return (
      <div className='flex flex-wrap gap-1'>
        {value.map((item, idx) => (
          <Badge key={idx} variant='secondary' className='text-[10px] font-normal'>
            {String(item)}
          </Badge>
        ))}
      </div>
    )
  }
  if (value !== null && typeof value === 'object') {
    return (
      <div className='space-y-0.5'>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className='text-xs'>
            <span className='text-muted-foreground'>{k}:</span> {renderRawValue(k, v)}
          </div>
        ))}
      </div>
    )
  }
  return <span className='font-mono text-xs text-foreground'>{String(value)}</span>
}

function getByPath(obj: Record<string, unknown> | undefined, path?: string): unknown {
  if (!obj) return undefined
  if (!path) return obj
  return obj[path]
}

const VALID_TABS = ['overview', 'agents', 'retention', 'advanced'] as const
type GeneralTab = (typeof VALID_TABS)[number]

function isGeneralTab(value: string | null): value is GeneralTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value)
}

interface GroupCardProps {
  group: SettingsGroup
  settingsByName: Map<string, SettingItem>
  onEdit: (group: SettingsGroup) => void
}

const GroupCard: FC<GroupCardProps> = ({ group, settingsByName, onEdit }) => {
  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-3'>
        <div>
          <CardTitle className='text-base'>{group.title}</CardTitle>
          <CardDescription>{group.description}</CardDescription>
        </div>
        <Button size='sm' variant='outline' className='gap-1.5' onClick={() => onEdit(group)}>
          <Pencil className='h-3.5 w-3.5' />
          Edit
        </Button>
      </CardHeader>
      <CardContent>
        <dl className='grid gap-2 rounded-md bg-muted/40 px-3 py-2.5'>
          {group.fields.map((field) => {
            const item = settingsByName.get(field.settingName)
            const value = getByPath(item?.value, field.path)
            return (
              <div
                key={`${field.settingName}-${field.path ?? '_'}`}
                className='flex items-baseline justify-between gap-4 text-xs'
              >
                <dt className='shrink-0 text-muted-foreground'>{field.label}</dt>
                <dd className='min-w-0 flex-1 text-right'>
                  {renderScalar(field.label, value)}
                  {field.suffix && (
                    <span className='ml-1 text-[11px] text-muted-foreground'>
                      {field.suffix}
                    </span>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}

function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='space-y-3'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='space-y-3 rounded-lg border border-border p-5'>
          <div className='flex items-start justify-between'>
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-3 w-64' />
            </div>
            <Skeleton className='h-8 w-16 rounded-md' />
          </div>
          <Skeleton className='h-16 w-full rounded-md' />
        </div>
      ))}
    </div>
  )
}

const GeneralSettingsPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: GeneralTab = isGeneralTab(rawTab) ? rawTab : 'overview'

  const [settings, setSettings] = useState<SettingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SettingsGroup | null>(null)

  const [singleSheetOpen, setSingleSheetOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<SettingItem | null>(null)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await listSettings()
      setSettings(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = (error as Error)?.message || 'Failed to load settings'
      toast.error('Failed to load settings', message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const settingsByName = useMemo(() => {
    const map = new Map<string, SettingItem>()
    settings.forEach((s) => map.set(s.name, s))
    return map
  }, [settings])

  const advancedItems = useMemo(() => {
    if (!searchText.trim()) return settings
    const q = searchText.toLowerCase()
    return settings.filter((item) => {
      if (item.name.toLowerCase().includes(q)) return true
      try {
        return JSON.stringify(item.value).toLowerCase().includes(q)
      } catch {
        return false
      }
    })
  }, [settings, searchText])

  const onTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const handleEditGroup = (group: SettingsGroup) => {
    setEditingGroup(group)
    setGroupSheetOpen(true)
  }

  const handleEditSingle = (item: SettingItem) => {
    setEditingSetting(item)
    setSingleSheetOpen(true)
  }

  const handleSubmitGroup = async (
    updates: Array<{ name: string; value: Record<string, unknown> }>,
  ) => {
    try {
      await Promise.all(updates.map((u) => updateSetting(u.name, { value: u.value })))
      toast.success('Settings updated', `${editingGroup?.title} saved successfully.`)
      setGroupSheetOpen(false)
      setEditingGroup(null)
      await loadSettings()
    } catch (error) {
      toast.error(
        'Failed to update settings',
        (error as Error)?.message || 'Please try again.',
      )
    }
  }

  const handleSubmitSingle = async (value: SettingValue) => {
    if (!editingSetting) return
    try {
      await updateSetting(editingSetting.name, { value })
      toast.success('Setting updated', `${editingSetting.name} saved successfully.`)
      setSingleSheetOpen(false)
      setEditingSetting(null)
      await loadSettings()
    } catch (error) {
      toast.error(
        'Failed to update setting',
        (error as Error)?.message || 'Please try again.',
      )
    }
  }

  const renderGroup = (groupId: SettingsGroup['id']) => {
    const group = SETTINGS_GROUPS.find((g) => g.id === groupId)
    if (!group) return null
    return (
      <GroupCard group={group} settingsByName={settingsByName} onEdit={handleEditGroup} />
    )
  }

  const ungroupedCount = settings.filter((s) => !GROUPED_SETTING_NAMES.has(s.name)).length

  return (
    <div className='flex-1 space-y-6 p-4 pt-6 md:p-8'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='flex items-center gap-3 text-3xl font-bold tracking-tight'>
            <Settings className='h-8 w-8 text-blue-500' />
            General Settings
          </h2>
          <p className='mt-1 text-muted-foreground'>
            Workspace-wide configuration values used by Arcentra.
          </p>
        </div>
        <Button
          variant='outline'
          size='icon'
          onClick={loadSettings}
          disabled={loading}
          aria-label='Refresh'
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className='w-full'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='agents'>Agents</TabsTrigger>
          <TabsTrigger value='retention'>Retention</TabsTrigger>
          <TabsTrigger value='advanced' className='gap-1.5'>
            Advanced
            {ungroupedCount > 0 && (
              <Badge variant='secondary' className='h-4 px-1 text-[10px] font-normal'>
                {ungroupedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='mt-6 space-y-4'>
          {loading ? (
            <CardsSkeleton count={2} />
          ) : (
            SETTINGS_GROUPS.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                settingsByName={settingsByName}
                onEdit={handleEditGroup}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value='agents' className='mt-6 space-y-4'>
          {loading ? <CardsSkeleton count={1} /> : renderGroup('agents')}
        </TabsContent>
        <TabsContent value='retention' className='mt-6 space-y-4'>
          {loading ? <CardsSkeleton count={1} /> : renderGroup('retention')}
        </TabsContent>

        <TabsContent value='advanced' className='mt-6 space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative flex-1 min-w-[240px] max-w-md'>
              <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder='Filter by name or value…'
                className='pl-8'
              />
            </div>
            <Badge variant='secondary' className='gap-1.5 px-2 py-1 text-xs'>
              {advancedItems.length} of {settings.length}
            </Badge>
          </div>

          {loading ? (
            <CardsSkeleton count={4} />
          ) : advancedItems.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center'>
              <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted'>
                <SearchX className='h-5 w-5 text-muted-foreground' />
              </div>
              <div>
                <div className='text-base font-medium'>No matching configurations</div>
                <p className='mt-1 max-w-md text-sm text-muted-foreground'>
                  {settings.length === 0
                    ? 'There are no settings to display yet.'
                    : 'Try a different search keyword.'}
                </p>
              </div>
              {searchText && (
                <Button variant='outline' size='sm' onClick={() => setSearchText('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className='space-y-3'>
              {advancedItems.map((item) => (
                <div
                  key={item.name}
                  className='group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:shadow-sm'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <code className='inline-block break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground'>
                      {item.name}
                    </code>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100'
                      onClick={() => handleEditSingle(item)}
                      aria-label='Edit'
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                  </div>
                  <div className='mt-3 space-y-1 rounded-md bg-muted/40 px-3 py-2.5'>
                    {Object.entries(item.value).length === 0 ? (
                      <span className='text-xs text-muted-foreground'>No value</span>
                    ) : (
                      Object.entries(item.value).map(([key, value]) => (
                        <div key={key} className='flex items-start gap-2 text-xs'>
                          <span className='shrink-0 text-muted-foreground'>{key}:</span>
                          <span className='min-w-0'>{renderRawValue(key, value)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GroupEditSheet
        open={groupSheetOpen}
        onOpenChange={(open) => {
          setGroupSheetOpen(open)
          if (!open) setEditingGroup(null)
        }}
        group={editingGroup}
        settingsByName={settingsByName}
        onSubmit={handleSubmitGroup}
      />

      <GeneralSettingsSheet
        open={singleSheetOpen}
        onOpenChange={(open) => {
          setSingleSheetOpen(open)
          if (!open) setEditingSetting(null)
        }}
        setting={editingSetting}
        onSubmit={handleSubmitSingle}
      />
    </div>
  )
}

export default GeneralSettingsPage
