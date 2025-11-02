import * as React from 'react'
import { PanelLeft } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export const SIDEBAR_STATE_COOKIE = 'sidebar:state'

interface SidebarContext {
  state: 'open' | 'closed'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContext>({
  state: 'open',
  open: true,
  onOpenChange: () => void 0,
})

function useSidebar() {
  return React.useContext(SidebarContext)
}

const SidebarLayout = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean
  }
>(({ defaultOpen, className, ...props }, ref) => {
  const [open, setOpen] = React.useState(defaultOpen ?? true)

  const onOpenChange = React.useCallback((open: boolean) => {
    setOpen(open)
    document.cookie = `${SIDEBAR_STATE_COOKIE}=${open}; path=/; max-age=${60 * 60 * 24 * 7}`
  }, [])

  const state = open ? 'open' : 'closed'

  return (
    <SidebarContext.Provider value={{ state, open, onOpenChange }}>
      <div
        className={cn(
          'flex min-h-screen bg-accent/50 transition-all duration-300 ease-in-out',
          open ? 'md:pl-64' : 'pl-0',
          className,
        )}
        data-sidebar={state}
        ref={ref}
        style={
          {
            '--sidebar-width': '16rem',
          } as React.CSSProperties
        }
        {...props}
      />
    </SidebarContext.Provider>
  )
})
SidebarLayout.displayName = 'SidebarLayout'

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useSidebar()

    return (
      <Button
        className={cn('h-8 w-8', className)}
        onClick={() => {
          onOpenChange(!open)
        }}
        ref={ref}
        size='icon'
        variant='ghost'
        {...props}
      >
        <PanelLeft className='h-4 w-4' />
        <span className='sr-only'>Toggle Sidebar</span>
      </Button>
    )
  },
)
SidebarTrigger.displayName = 'SidebarTrigger'

const Sidebar = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, children }, ref) => {
  const isMobile = useIsMobile()
  const { open, onOpenChange } = useSidebar()

  const sidebar = (
    <div className={cn('flex h-full flex-col border-r bg-background', className)} ref={ref}>
      {children}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className='w-64 p-0 [&>button]:hidden' side='left'>
          {sidebar}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className='fixed inset-y-0 left-0 z-10 hidden w-64 transition-all duration-300 ease-in-out md:block [[data-sidebar=closed]_&]:-left-64'>
      {sidebar}
    </aside>
  )
})
Sidebar.displayName = 'Sidebar'

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div className={cn('flex items-center border-b px-2.5 py-2', className)} ref={ref} {...props} />
})
SidebarHeader.displayName = 'SidebarHeader'

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div className={cn('flex items-center border-t px-2.5 py-2', className)} ref={ref} {...props} />
})
SidebarFooter.displayName = 'SidebarFooter'

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div className={cn('flex flex-1 flex-col gap-5 overflow-auto py-4', className)} ref={ref} {...props} />
})
SidebarContent.displayName = 'SidebarContent'

const SidebarItem = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div className={cn('grid gap-2 px-2.5', className)} ref={ref} {...props} />
})
SidebarItem.displayName = 'SidebarItem'

const SidebarLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div className={cn('px-1.5 text-xs font-medium text-muted-foreground', className)} ref={ref} {...props} />
})
SidebarLabel.displayName = 'SidebarLabel'

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarTrigger,
  useSidebar,
}