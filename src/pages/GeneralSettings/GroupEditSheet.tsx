import { useEffect, useMemo, useState, type FC } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { SettingItem } from '@/api/general-settings/types'
import type { SettingsGroup } from './groups'
import { cn } from '@/lib/utils'

const SENSITIVE_KEYWORDS = ['secret', 'key', 'salt', 'password', 'token']

function isSensitiveLabel(label: string) {
  const l = label.toLowerCase()
  return SENSITIVE_KEYWORDS.some((kw) => l.includes(kw))
}

function getByPath(obj: Record<string, unknown> | undefined, path?: string): unknown {
  if (!obj) return undefined
  if (!path) return obj
  return obj[path]
}

function detectType(value: unknown): 'string' | 'number' | 'boolean' {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

interface GroupEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: SettingsGroup | null
  settingsByName: Map<string, SettingItem>
  /** 提交一组 setting 的更新；上层负责发起 N 个 PUT */
  onSubmit: (updates: Array<{ name: string; value: Record<string, unknown> }>) => Promise<void>
}

export const GroupEditSheet: FC<GroupEditSheetProps> = ({
  open,
  onOpenChange,
  group,
  settingsByName,
  onSubmit,
}) => {
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const initialState = useMemo(() => {
    if (!group) return {}
    const next: Record<string, unknown> = {}
    group.fields.forEach((field, idx) => {
      const item = settingsByName.get(field.settingName)
      next[`f${idx}`] = getByPath(item?.value, field.path)
    })
    return next
  }, [group, settingsByName])

  useEffect(() => {
    if (!open || !group) return
    setDraft(initialState)
    setErrors({})
    setRevealed({})
  }, [open, group, initialState])

  const handleChange = (key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const { [key]: _omit, ...rest } = prev
        return rest
      })
    }
  }

  const handleSave = async () => {
    if (!group) return

    // 1. 校验
    const nextErrors: Record<string, string> = {}
    group.fields.forEach((field, idx) => {
      const key = `f${idx}`
      const original = getByPath(settingsByName.get(field.settingName)?.value, field.path)
      const type = detectType(original)
      const raw = draft[key]
      if (type === 'number') {
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (raw === '' || raw === null || raw === undefined || Number.isNaN(n)) {
          nextErrors[key] = 'Must be a number'
        }
      }
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // 2. 把每个 field 的草稿值合并回所属 SettingItem.value
    const updatedValueByName = new Map<string, Record<string, unknown>>()
    group.fields.forEach((field, idx) => {
      const key = `f${idx}`
      const item = settingsByName.get(field.settingName)
      if (!item) return
      const current = updatedValueByName.get(field.settingName) ?? { ...item.value }
      let v = draft[key]
      const original = getByPath(item.value, field.path)
      const type = detectType(original)
      if (type === 'number') v = Number(v)
      if (type === 'boolean') v = Boolean(v)

      if (field.path) {
        current[field.path] = v
      } else {
        updatedValueByName.set(field.settingName, v as Record<string, unknown>)
        return
      }
      updatedValueByName.set(field.settingName, current)
    })

    setLoading(true)
    try {
      await onSubmit(
        Array.from(updatedValueByName.entries()).map(([name, value]) => ({ name, value })),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-[460px] max-w-[calc(100vw-64px)] flex-col gap-0 p-0 sm:max-w-[460px]'
      >
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-5 text-left'>
          <SheetTitle>{group?.title ?? 'Edit settings'}</SheetTitle>
          <SheetDescription className='text-[13px]'>
            {group?.description}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto'>
          <ScrollArea className='h-full'>
            <div className='space-y-5 px-6 py-6'>
              {!group && (
                <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  No group selected.
                </div>
              )}

              {group?.fields.map((field, idx) => {
                const key = `f${idx}`
                const value = draft[key]
                const error = errors[key]
                const original = getByPath(
                  settingsByName.get(field.settingName)?.value,
                  field.path,
                )
                const type = detectType(original)
                const sensitive = isSensitiveLabel(field.label) && type === 'string'

                return (
                  <div key={`${field.settingName}-${field.path ?? '_'}`} className='space-y-1.5'>
                    <Label
                      htmlFor={`field-${idx}`}
                      className='flex items-baseline justify-between gap-2 text-[13px]'
                    >
                      <span>{field.label}</span>
                      <code className='font-mono text-[10px] text-muted-foreground'>
                        {field.settingName}
                        {field.path ? `.${field.path}` : ''}
                      </code>
                    </Label>

                    {type === 'boolean' && (
                      <div className='flex items-center gap-2 rounded-md border px-3 py-2'>
                        <Switch
                          id={`field-${idx}`}
                          checked={Boolean(value)}
                          onCheckedChange={(checked) => handleChange(key, checked)}
                        />
                        <span className='text-sm text-muted-foreground'>
                          {value ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    )}

                    {type === 'number' && (
                      <div className='flex items-center gap-2'>
                        <Input
                          id={`field-${idx}`}
                          type='number'
                          value={value === undefined || value === null ? '' : String(value)}
                          onChange={(e) =>
                            handleChange(
                              key,
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                        />
                        {field.suffix && (
                          <span className='shrink-0 text-xs text-muted-foreground'>
                            {field.suffix}
                          </span>
                        )}
                      </div>
                    )}

                    {type === 'string' && (
                      <div className='relative'>
                        <Input
                          id={`field-${idx}`}
                          type={sensitive && !revealed[key] ? 'password' : 'text'}
                          value={typeof value === 'string' ? value : String(value ?? '')}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className={cn(sensitive && 'pr-9')}
                        />
                        {sensitive && (
                          <button
                            type='button'
                            onClick={() =>
                              setRevealed((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground'
                            aria-label={revealed[key] ? 'Hide value' : 'Show value'}
                          >
                            {revealed[key] ? (
                              <EyeOff className='h-3.5 w-3.5' />
                            ) : (
                              <Eye className='h-3.5 w-3.5' />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {field.description && (
                      <p className='text-xs text-muted-foreground'>{field.description}</p>
                    )}
                    {error && <p className='text-xs text-destructive'>{error}</p>}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <Separator />
        <div className='sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type='button' disabled={loading || !group} onClick={handleSave}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
