import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Bell,
  Command,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Upload,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Apis } from '@/api'
import authStore from '@/store/auth'
import userStore from '@/store/user'
import { logout as globalLogout } from '@/lib/auth'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { toast } from '@/lib/toast'
import { uiShellStore } from '@/store/ui-shell'
import { cn } from '@/lib/utils'
import { DEFAULT_USER_AVATAR } from '@/constants/assets'

const THEMES: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: 'system', label: 'Auto', icon: <Monitor className='h-3.5 w-3.5' /> },
  { value: 'light', label: 'Light', icon: <Sun className='h-3.5 w-3.5' /> },
  { value: 'dark', label: 'Dark', icon: <Moon className='h-3.5 w-3.5' /> },
]

interface DockUser {
  name: string
  email: string
  avatar: string
  role?: string
  workspace?: string
}

const DEFAULT_USER: DockUser = {
  name: 'User',
  email: 'user@example.com',
  avatar: DEFAULT_USER_AVATAR,
  workspace: 'Arcentra',
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function getRoleLabel(rawRole?: string, isSuperAdmin?: number) {
  if (isSuperAdmin === 1) return 'Owner'
  if (!rawRole) return 'Member'
  const r = rawRole.toLowerCase()
  if (r === 'admin') return 'Admin'
  if (r === 'viewer') return 'Viewer'
  return rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  hint?: React.ReactNode
  destructive?: boolean
}

function MenuItem({ icon, label, hint, destructive, className, ...rest }: MenuItemProps) {
  return (
    <button
      type='button'
      {...rest}
      className={cn(
        'group flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-[13px] outline-none transition-colors duration-150 cursor-pointer',
        destructive
          ? 'text-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-foreground hover:bg-accent/60',
        'focus-visible:bg-accent/60',
        className,
      )}
    >
      <span className='flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground'>
        {icon}
      </span>
      <span className='flex-1 truncate text-left'>{label}</span>
      {hint && <span className='shrink-0 text-xs text-muted-foreground'>{hint}</span>}
    </button>
  )
}

export function NavUserDockTrigger({ expanded = false }: { expanded?: boolean }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<DockUser>(DEFAULT_USER)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [language, setLanguage] = useState('zh-CN')
  const { theme, setTheme } = useTheme()
  const { register, handleSubmit, reset } = useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fullNameInputRef = useRef<HTMLInputElement | null>(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    const fetchUserInfo = async () => {
      const storedUserInfo = userStore.getState().userinfo
      if (storedUserInfo) {
        const displayName = storedUserInfo.fullName || storedUserInfo.username
        setUser({
          name: displayName,
          email: storedUserInfo.email,
          avatar: storedUserInfo.avatar || DEFAULT_USER_AVATAR,
          role: getRoleLabel(
            (storedUserInfo as { role?: string }).role,
            (storedUserInfo as { isSuperAdmin?: number }).isSuperAdmin,
          ),
          workspace: 'Arcentra',
        })
        return
      }

      const authState = authStore.getState()
      if (!authState.accessToken) return

      try {
        const userInfo = await Apis.user.getUserInfo()
        const displayName = userInfo.fullName || userInfo.username
        setUser({
          name: displayName,
          email: userInfo.email,
          avatar: userInfo.avatar || DEFAULT_USER_AVATAR,
          role: getRoleLabel(
            (userInfo as { role?: string }).role,
            (userInfo as { isSuperAdmin?: number }).isSuperAdmin,
          ),
          workspace: 'Arcentra',
        })
        userStore.updateState((state) => {
          state.userinfo = userInfo
        })
      } catch (error) {
        console.error('Failed to fetch user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    const userInfo = userStore.getState().userinfo
    if (userInfo && userInfo.fullName) {
      setUser((prev) => ({ ...prev, name: userInfo.fullName || prev.name }))
    }
  }, [language])

  const handleLogout = async () => {
    setPopoverOpen(false)
    try {
      await globalLogout()
      navigate('/login')
    } catch (error) {
      toast.error('Logout failed', (error as Error).message)
    }
  }

  const openProfile = () => {
    setPopoverOpen(false)
    setProfileOpen(true)
  }

  const goToInbox = () => {
    setPopoverOpen(false)
    navigate('/inbox')
  }

  const goToSettings = () => {
    setPopoverOpen(false)
    navigate('/settings')
  }

  const openCommandPalette = () => {
    setPopoverOpen(false)
    uiShellStore.openPalette()
  }

  const handleSaveProfile = handleSubmit(async (data) => {
    setIsSaving(true)
    try {
      const currentUserInfo = userStore.getState().userinfo
      if (!currentUserInfo?.userId) {
        toast.error('Failed to update profile', 'User ID not found')
        return
      }

      await Apis.user.updateUserInfo(currentUserInfo.userId, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        avatar: data.avatar,
      })

      // refetch authoritative user info from server
      const refreshedUserInfo = await Apis.user.getUserInfo()
      userStore.updateState((state) => {
        state.userinfo = refreshedUserInfo
      })

      const displayName =
        refreshedUserInfo?.fullName ||
        refreshedUserInfo?.username ||
        currentUserInfo.username ||
        user.name
      setUser((prev) => ({
        ...prev,
        name: displayName,
        email: refreshedUserInfo?.email || prev.email,
        avatar: refreshedUserInfo?.avatar || data.avatar || prev.avatar,
      }))

      toast.success('Profile updated', 'Your profile has been updated successfully.')
      setProfileOpen(false)
    } catch (error) {
      toast.error('Failed to update profile', (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', 'Please upload an image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File too large', 'Please upload an image smaller than 5MB')
      return
    }

    try {
      setIsUploading(true)

      const reader = new FileReader()
      reader.onloadend = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(file)

      const response = await Apis.user.uploadAvatar(file)
      const refreshedUserInfo = await Apis.user.getUserInfo()

      userStore.updateState((state) => {
        state.userinfo = refreshedUserInfo
      })

      const newAvatar = refreshedUserInfo.avatar || response.url
      setAvatarPreview(newAvatar)
      setUser((prev) => ({ ...prev, avatar: newAvatar }))

      reset({
        fullName: refreshedUserInfo?.fullName || '',
        email: refreshedUserInfo?.email || user.email,
        phone: refreshedUserInfo?.phone || '',
        avatar: newAvatar,
      })

      toast.success('Avatar uploaded', 'Your avatar has been uploaded successfully')
    } catch (error) {
      toast.error('Upload failed', (error as Error).message)
      setAvatarPreview('')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    if (profileOpen) {
      const userInfo = userStore.getState().userinfo
      reset({
        fullName: userInfo?.fullName || '',
        email: user.email,
        phone: userInfo?.phone || '',
        avatar: userInfo?.avatar || '',
      })
      setAvatarPreview(userInfo?.avatar || user.avatar || '')
      setTimeout(() => fullNameInputRef.current?.focus(), 100)
    } else {
      setAvatarPreview('')
    }
  }, [profileOpen, user, reset])

  const initials = getInitials(user.name)

  const triggerButton = (
    <PopoverTrigger asChild>
      <button
        type='button'
        aria-label={user.name}
        className={cn(
          'flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[14px] pr-3 cursor-pointer outline-none transition-colors duration-150',
          'hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent/40',
        )}
      >
        <Avatar className='h-7 w-7 shrink-0 rounded-md border'>
          <AvatarImage alt={user.name} src={user.avatar} />
          <AvatarFallback className='rounded-md text-[10px]'>{initials}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left text-sm font-medium transition-opacity duration-150',
            expanded ? 'opacity-100 delay-75' : 'opacity-0',
          )}
          aria-hidden={!expanded}
        >
          {user.name}
        </span>
      </button>
    </PopoverTrigger>
  )

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      {expanded ? (
        triggerButton
      ) : (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            {user.name}
          </TooltipContent>
        </Tooltip>
      )}

      <PopoverContent
        side='right'
        align='end'
        sideOffset={12}
        className='w-72 rounded-xl p-2 shadow-xl'
      >
        <div className='flex items-center gap-3 rounded-lg p-2'>
          <div className='relative'>
            <Avatar className='h-10 w-10 rounded-md border'>
              <AvatarImage alt={user.name} src={user.avatar} />
              <AvatarFallback className='rounded-md text-xs'>{initials}</AvatarFallback>
            </Avatar>
            <span
              aria-hidden
              className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500'
            />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <span className='truncate text-[15px] font-semibold leading-tight'>{user.name}</span>
              {user.role && (
                <Badge variant='outline' className='shrink-0 px-1.5 py-0 text-[10px] font-medium'>
                  {user.role}
                </Badge>
              )}
            </div>
            <div className='mt-0.5 truncate text-[13px] text-muted-foreground'>{user.email}</div>
            {user.workspace && (
              <div className='mt-0.5 truncate text-xs text-muted-foreground'>
                {user.workspace} · Online
              </div>
            )}
          </div>
        </div>

        <div className='my-1.5 h-px bg-border' />

        <div className='grid gap-0.5'>
          <MenuItem icon={<User className='h-4 w-4' />} label='View profile' onClick={openProfile} />
          <MenuItem
            icon={<Bell className='h-4 w-4' />}
            label='Notifications'
            onClick={goToInbox}
          />
          <MenuItem
            icon={<Settings className='h-4 w-4' />}
            label='Account settings'
            onClick={goToSettings}
          />
          <MenuItem
            icon={<Command className='h-4 w-4' />}
            label='Command palette'
            hint={
              <span className='inline-flex items-center gap-0.5'>
                <kbd className='rounded border border-border/50 bg-background px-1 py-px font-mono text-[10px]'>
                  ⌘
                </kbd>
                <kbd className='rounded border border-border/50 bg-background px-1 py-px font-mono text-[10px]'>
                  K
                </kbd>
              </span>
            }
            onClick={openCommandPalette}
          />
        </div>

        <div className='my-1.5 h-px bg-border' />

        <div className='space-y-1.5 px-2 py-1.5'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-[13px] text-muted-foreground'>
              <Sun className='h-3.5 w-3.5' />
              Theme
            </div>
            <div className='flex items-center gap-0.5 rounded-md border p-0.5'>
              {THEMES.map((item) => (
                <button
                  key={item.value}
                  type='button'
                  onClick={() => setTheme(item.value)}
                  className={cn(
                    'flex h-6 w-7 items-center justify-center rounded transition-colors cursor-pointer',
                    theme === item.value
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={item.label}
                  aria-label={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-[13px] text-muted-foreground'>
              <Globe className='h-3.5 w-3.5' />
              Language
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className='h-7 w-[100px] text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='zh-CN'>zh-CN</SelectItem>
                <SelectItem value='en-US'>en-US</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='my-1.5 h-px bg-border' />

        <MenuItem
          icon={<LogOut className='h-4 w-4' />}
          label='Sign out'
          onClick={handleLogout}
          destructive
        />
      </PopoverContent>

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent
          className='flex w-[440px] max-w-[calc(100vw-64px)] flex-col gap-0 p-0 sm:max-w-[440px]'
        >
          <form onSubmit={handleSaveProfile} className='flex h-full min-h-0 flex-col'>
            <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-5 text-left'>
              <SheetTitle className='text-base'>Edit profile</SheetTitle>
              <SheetDescription className='text-[13px]'>
                Update your name, contact info and profile photo.
              </SheetDescription>
            </SheetHeader>

            <div className='flex-1 space-y-8 overflow-y-auto px-6 py-6'>
              <section className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Profile photo
                </h3>
                <div className='flex items-center gap-4 rounded-lg border bg-muted/30 p-4'>
                  <div className='relative h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-background'>
                    <img
                      src={avatarPreview || user.avatar}
                      alt='Avatar'
                      className='h-full w-full object-cover'
                    />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>{user.name}</div>
                    <div className='truncate text-xs text-muted-foreground'>{user.email}</div>
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/jpeg,image/jpg,image/png,image/gif,image/webp'
                        onChange={handleAvatarUpload}
                        className='hidden'
                      />
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        className='h-7 gap-1.5 px-2.5 text-xs'
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSaving}
                      >
                        <Upload className='h-3.5 w-3.5' />
                        {isUploading ? 'Uploading…' : 'Upload new'}
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-7 px-2.5 text-xs'
                        disabled={isUploading || isSaving || !(avatarPreview || user.avatar)}
                        onClick={() => {
                          setAvatarPreview('')
                          reset((prev) => ({ ...prev, avatar: '' }))
                          setUser((u) => ({ ...u, avatar: DEFAULT_USER_AVATAR }))
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                    <p className='mt-1.5 text-[11px] text-muted-foreground'>
                      JPG, PNG or WebP. Max 5MB.
                    </p>
                  </div>
                </div>
                <input type='hidden' {...register('avatar')} />
              </section>

              <section className='space-y-4'>
                <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Account information
                </h3>
                <div className='grid gap-2'>
                  <Label htmlFor='username' className='text-[13px]'>
                    Username
                  </Label>
                  <Input
                    id='username'
                    defaultValue={user.name}
                    readOnly
                    className='cursor-not-allowed bg-muted'
                  />
                  <p className='text-[11px] text-muted-foreground'>
                    Used as your unique account identifier.
                  </p>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='fullName' className='text-[13px]'>
                    Display name
                  </Label>
                  <Input
                    id='fullName'
                    {...register('fullName')}
                    ref={(e) => {
                      const { ref } = register('fullName')
                      ref(e)
                      ;(fullNameInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e
                    }}
                    placeholder='How you appear across Arcentra'
                    disabled={isSaving}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='email' className='text-[13px]'>
                    Email
                  </Label>
                  <Input
                    id='email'
                    type='email'
                    {...register('email')}
                    placeholder='you@example.com'
                    disabled={isSaving}
                  />
                  <p className='text-[11px] text-muted-foreground'>
                    Used for login and system notifications.
                  </p>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='phone' className='text-[13px]'>
                    Phone
                  </Label>
                  <Input
                    id='phone'
                    type='tel'
                    {...register('phone')}
                    placeholder='Optional'
                    disabled={isSaving}
                  />
                </div>
              </section>
            </div>

            <div className='sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4'>
              <SheetClose asChild>
                <Button variant='outline' type='button' disabled={isSaving}>
                  Cancel
                </Button>
              </SheetClose>
              <Button type='submit' disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </Popover>
  )
}
