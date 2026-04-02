import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import { DEFAULT_USER_AVATAR } from '@/constants/assets'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Apis } from '@/api'
import authStore from '@/store/auth'
import userStore from '@/store/user'
import { logout as globalLogout } from '@/lib/auth'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { User, Bell, ChevronsUpDown, LogOut, Monitor, Sun, Moon, Upload, SlidersHorizontal } from 'lucide-react'

const THEMES: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: 'system', label: 'System', icon: <Monitor className='h-4 w-4' /> },
  { value: 'light', label: 'Light', icon: <Sun className='h-4 w-4' /> },
  { value: 'dark', label: 'Dark', icon: <Moon className='h-4 w-4' /> },
]

export function NavUser({
  user: initialUser,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const navigate = useNavigate()
  const [user, setUser] = useState(initialUser)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [language, setLanguage] = useState('zh-CN')
  const { theme, setTheme } = useTheme()
  const { register, handleSubmit, reset } = useForm()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const fullNameInputRef = React.useRef<HTMLInputElement | null>(null)

  // 使用 ref 防止重复请求
  const hasFetchedRef = useRef(false)

  // 初始化用户信息（只在组件首次加载时）
  useEffect(() => {
    // 防止重复请求（React StrictMode 会执行两次）
    if (hasFetchedRef.current) {
      return
    }
    hasFetchedRef.current = true

    const fetchUserInfo = async () => {
      // 先检查 store 中是否已有用户信息
      const storedUserInfo = userStore.getState().userinfo
      if (storedUserInfo) {
        // 使用已存储的用户信息，不再请求 API
        console.log('[NavUser] Using cached user info from store')
        const displayName = storedUserInfo.fullName || storedUserInfo.username
        setUser({
          name: displayName,
          email: storedUserInfo.email,
          avatar: storedUserInfo.avatar || DEFAULT_USER_AVATAR,
        })
        return
      }
      
      // store 中没有数据，检查是否有 token
      const authState = authStore.getState()
      if (!authState.accessToken) {
        setUser(initialUser)
        return
      }
      
      try {
        const userInfo = await Apis.user.getUserInfo()
        const displayName = userInfo.fullName || userInfo.username
        const newUser = {
          name: displayName,
          email: userInfo.email,
          avatar: userInfo.avatar || DEFAULT_USER_AVATAR,
        }
        setUser(newUser)
        // 更新 store
        userStore.updateState((state) => {
          state.userinfo = userInfo
        })
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        // 如果获取失败，使用初始值
        setUser(initialUser)
      }
    }

    fetchUserInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当语言切换时，更新用户名显示（如果有 fullName）
  useEffect(() => {
    const userInfo = userStore.getState().userinfo
    if (userInfo && userInfo.fullName) {
      setUser((prev) => ({
        ...prev,
        name: userInfo.fullName || prev.name,
      }))
    }
  }, [language])

  const handleLogout = async () => {
    try {
      await globalLogout()
      navigate('/login')
    } catch (error) {
      toast.error('Logout failed', (error as Error).message)
    }
  }

  const handleSaveProfile = handleSubmit(async (data) => {
    setIsSaving(true)
    try {
      // 获取当前用户 ID
      const currentUserInfo = userStore.getState().userinfo
      if (!currentUserInfo?.userId) {
        toast.error('Failed to update profile', 'User ID not found')
        return
      }

      // 调用更新用户信息的 API
      const updatedUserInfo = await Apis.user.updateUserInfo(currentUserInfo.userId, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        avatar: data.avatar,
      })
      
      // 更新本地用户信息
      const displayName = updatedUserInfo?.fullName || updatedUserInfo?.username || currentUserInfo.username || user.name
      setUser({
        name: displayName,
        email: updatedUserInfo?.email || user.email,
        avatar: updatedUserInfo?.avatar || data.avatar || user.avatar,
      })
      
      // 更新 store
      userStore.updateState((state) => {
        state.userinfo = updatedUserInfo
      })
      
      toast.success('Profile updated', 'Your profile has been updated successfully.')
      setIsSheetOpen(false)
    } catch (error) {
      toast.error('Failed to update profile', (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  })

  // 处理头像上传
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', 'Please upload an image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // 验证文件大小 (最大 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File too large', 'Please upload an image smaller than 5MB')
      return
    }

    try {
      setIsUploading(true)
      
      // 创建本地预览
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // 上传到服务器
      const response = await Apis.user.uploadAvatar(file)
      
      // 获取最新的用户信息
      const refreshedUserInfo = await Apis.user.getUserInfo()
      
      // 更新 store
      userStore.updateState((state) => {
        state.userinfo = refreshedUserInfo
      })
      
      // 立即更新用户头像显示
      const newAvatar = refreshedUserInfo.avatar || response.url
      setAvatarPreview(newAvatar)
      setUser({
        ...user,
        avatar: newAvatar,
      })
      
      // 更新表单中的 avatar 值
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

  // 当 Sheet 打开时，重置表单为当前用户信息
  useEffect(() => {
    if (isSheetOpen) {
      const userState = userStore.getState()
      const userInfo = userState.userinfo
      reset({
        fullName: userInfo?.fullName || '',
        email: user.email,
        phone: userInfo?.phone || '',
        avatar: userInfo?.avatar || '',
      })
      setAvatarPreview(userInfo?.avatar || user.avatar || '')
      // 延迟聚焦到第一个输入框，确保 Sheet 动画完成
      setTimeout(() => {
        fullNameInputRef.current?.focus()
      }, 100)
    } else {
      setAvatarPreview('')
    }
  }, [isSheetOpen, user, reset])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='w-full rounded-md outline-none ring-ring hover:bg-accent focus-visible:ring-2 data-[state=open]:bg-accent'>
        <div className='flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-all'>
          <Avatar className='h-7 w-7 rounded-md border'>
            <AvatarImage alt={user.name} className='animate-in fade-in-50 zoom-in-90' src={user.avatar} />
            <AvatarFallback className='rounded-md'>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className='grid flex-1 leading-none'>
            <div className='font-medium'>{user.name}</div>
            <div className='overflow-hidden text-xs text-muted-foreground'>
              <div className='line-clamp-1'>{user.email}</div>
            </div>
          </div>
          <ChevronsUpDown className='ml-auto mr-0.5 h-4 w-4 text-muted-foreground/50' />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56' side='right' sideOffset={4}>
        <DropdownMenuLabel className='p-0 font-normal'>
          <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm transition-all'>
            <Avatar className='h-7 w-7 rounded-md'>
              <AvatarImage alt={user.name} src={user.avatar} />
              <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className='grid flex-1'>
              <div className='font-medium'>{user.name}</div>
              <div className='overflow-hidden text-xs text-muted-foreground'>
                <div className='line-clamp-1'>{user.email}</div>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <DropdownMenuItem className='gap-2' onSelect={(e) => e.preventDefault()}>
                <User className='h-4 w-4 text-muted-foreground' />
                Profile
              </DropdownMenuItem>
            </SheetTrigger>
            <SheetContent>
              <form onSubmit={handleSaveProfile}>
                <SheetHeader>
                  <SheetTitle>Edit profile</SheetTitle>
                  <SheetDescription>
                    Make changes to your profile here. Click save when you&apos;re done.
                  </SheetDescription>
                </SheetHeader>
                <div className='grid flex-1 auto-rows-min gap-6 py-6'>
                  <div className='grid gap-3'>
                    <Label htmlFor='username'>Username</Label>
                    <Input
                      id='username'
                      defaultValue={user.name}
                      disabled
                      className='bg-muted cursor-not-allowed'
                    />
                  </div>
                  <div className='grid gap-3'>
                    <Label htmlFor='fullName'>Full Name</Label>
                    <Input
                      id='fullName'
                      {...register('fullName')}
                      ref={(e) => {
                        const { ref } = register('fullName')
                        ref(e)
                        ;(fullNameInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e
                      }}
                      placeholder='Enter your full name'
                      disabled={isSaving}
                    />
                  </div>
                  <div className='grid gap-3'>
                    <Label htmlFor='email'>Email</Label>
                    <Input
                      id='email'
                      type='email'
                      {...register('email')}
                      placeholder='Enter your email'
                      disabled={isSaving}
                    />
                  </div>
                  <div className='grid gap-3'>
                    <Label htmlFor='phone'>Phone</Label>
                    <Input
                      id='phone'
                      type='tel'
                      {...register('phone')}
                      placeholder='Enter your phone number'
                      disabled={isSaving}
                    />
                  </div>
                  <div className='grid gap-3'>
                    <Label htmlFor='avatar'>Avatar</Label>
                    <div className='flex items-center gap-4'>
                      <div className='relative h-20 w-20 overflow-hidden rounded-full border-2 border-border'>
                        <img
                          src={avatarPreview || user.avatar}
                          alt='Avatar'
                          className='h-full w-full object-cover'
                        />
                      </div>
                      <div className='flex flex-col gap-2'>
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
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || isSaving}
                        >
                          <Upload className='mr-2 h-4 w-4' />
                          {isUploading ? 'Uploading...' : 'Upload New'}
                        </Button>
                        <p className='text-xs text-muted-foreground'>
                          JPG, PNG, GIF or WebP (Max 5MB)
                        </p>
                      </div>
                    </div>
                    <input
                      type='hidden'
                      {...register('avatar')}
                    />
                  </div>
                </div>
                <SheetFooter>
                  <Button type='submit' disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                  <SheetClose asChild>
                    <Button variant='outline' type='button' disabled={isSaving}>
                      Close
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
          <DropdownMenuItem className='gap-2' onClick={() => navigate('/inbox')}>
            <Bell className='h-4 w-4 text-muted-foreground' />
            System Notifications
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className='gap-2'>
              <SlidersHorizontal className='h-4 w-4 text-muted-foreground' />
              Preferences
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-56'>
              <div className='px-2 py-2'>
                <div className='flex items-center justify-between mb-3'>
                  <span className='text-sm font-medium'>Theme</span>
                  <div className='flex items-center gap-1 rounded-md border p-1'>
                    {THEMES.map((item) => (
                      <button
                        key={item.value}
                        type='button'
                        onClick={() => setTheme(item.value)}
                        className={`rounded-sm p-1.5 transition-colors hover:bg-accent ${
                          theme === item.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Language</span>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className='w-[100px] h-8'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='zh-CN'>zh-CN</SelectItem>
                      <SelectItem value='en-US'>en-US</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='gap-2' onClick={handleLogout}>
          <LogOut className='h-4 w-4 text-muted-foreground' />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
