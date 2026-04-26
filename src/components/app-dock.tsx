import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  Bot,
  Frame,
  Hammer,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  Rocket,
  Search,
  Settings2,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_LOGO_ICON } from '@/constants/assets'
import { NavUserDockTrigger } from '@/components/nav-user-dock-trigger'
import { uiShellStore } from '@/store/ui-shell'

type DockItem = {
  title: string
  url: string
  icon: LucideIcon
  exact?: boolean
}

const PRIMARY_ITEMS: DockItem[] = [
  { title: 'Overview', url: '/', icon: LayoutDashboard, exact: true },
  { title: 'Projects', url: '/projects', icon: Frame },
  { title: 'Build', url: '/build', icon: Hammer },
  { title: 'Deploy', url: '/deploy', icon: Rocket },
  { title: 'Agents', url: '/agents', icon: Bot },
  { title: 'Observe', url: '/observe', icon: Activity },
  { title: 'Secure', url: '/secure', icon: Shield },
  { title: 'Settings', url: '/settings', icon: Settings2 },
]

const PEEK_DELAY_MS = 300

function isActive(pathname: string, item: DockItem) {
  if (item.exact) return pathname === item.url
  return pathname === item.url || pathname.startsWith(`${item.url}/`)
}

function ItemLabel({
  expanded,
  children,
  className,
}: {
  expanded: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-left transition-opacity duration-150',
        expanded ? 'opacity-100 delay-75' : 'opacity-0',
        className,
      )}
      aria-hidden={!expanded}
    >
      {children}
    </span>
  )
}

function DockButton({
  item,
  active,
  expanded,
}: {
  item: DockItem
  active: boolean
  expanded: boolean
}) {
  const content = (
    <Link
      to={item.url}
      aria-label={item.title}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-sm transition-colors duration-150 cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-accent/40',
        active && 'text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden
          className='absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground'
        />
      )}
      <item.icon className='h-5 w-5 shrink-0' />
      <ItemLabel expanded={expanded}>{item.title}</ItemLabel>
    </Link>
  )

  if (expanded) return content

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side='right' sideOffset={8}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  )
}

function ActionButton({
  label,
  icon: Icon,
  expanded,
  onClick,
  hint,
}: {
  label: string
  icon: LucideIcon
  expanded: boolean
  onClick: () => void
  hint?: React.ReactNode
}) {
  const button = (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-sm transition-colors duration-150 cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon className='h-5 w-5 shrink-0' />
      <ItemLabel expanded={expanded}>{label}</ItemLabel>
      {hint && (
        <span
          className={cn(
            'shrink-0 transition-opacity duration-150',
            expanded ? 'opacity-100 delay-75' : 'opacity-0',
          )}
          aria-hidden={!expanded}
        >
          {hint}
        </span>
      )}
    </button>
  )

  if (expanded) return button

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side='right' sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ExternalLinkButton({
  label,
  icon: Icon,
  href,
  expanded,
}: {
  label: string
  icon: LucideIcon
  href: string
  expanded: boolean
}) {
  const link = (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={label}
      className={cn(
        'flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-md pl-[18px] pr-3 text-sm transition-colors duration-150 cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-accent/40',
      )}
    >
      <Icon className='h-5 w-5 shrink-0' />
      <ItemLabel expanded={expanded}>{label}</ItemLabel>
    </a>
  )

  if (expanded) return link

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side='right' sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function AppDock() {
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)
  const enterTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (enterTimer.current) window.clearTimeout(enterTimer.current)
    }
  }, [])

  const handleMouseEnter = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => setExpanded(true), PEEK_DELAY_MS)
  }

  const handleMouseLeave = () => {
    if (enterTimer.current) {
      window.clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
    setExpanded(false)
  }

  return (
    <nav
      aria-label='Primary'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-background py-2 shadow-[1px_0_0_0_transparent] transition-[width] duration-200 ease-out',
        expanded ? 'w-[180px] shadow-md' : 'w-14',
      )}
    >
      <Link
        to='/'
        aria-label='Arcentra home'
        className='flex h-10 w-full items-center gap-3 overflow-hidden whitespace-nowrap pl-[14px] pr-3 cursor-pointer'
      >
        <img
          src={APP_LOGO_ICON}
          alt='Arcentra'
          className='h-7 w-7 shrink-0 rounded-sm'
        />
        <ItemLabel expanded={expanded} className='font-semibold text-foreground'>
          Arcentra
        </ItemLabel>
      </Link>

      <div className='my-2 mx-2 h-px bg-border' aria-hidden />

      <div className='px-1'>
        <ActionButton
          label='Search'
          icon={Search}
          expanded={expanded}
          onClick={() => uiShellStore.openPalette()}
          hint={
            <span className='inline-flex items-center gap-0.5 text-[10px] text-muted-foreground'>
              <kbd className='rounded border border-border/40 bg-background px-1 py-px font-mono'>
                ⌘
              </kbd>
              <kbd className='rounded border border-border/40 bg-background px-1 py-px font-mono'>
                K
              </kbd>
            </span>
          }
        />
      </div>

      <ul className='mt-1 flex flex-col gap-0.5 px-1'>
        {PRIMARY_ITEMS.map((item) => (
          <li key={item.url}>
            <DockButton
              item={item}
              active={isActive(location.pathname, item)}
              expanded={expanded}
            />
          </li>
        ))}
      </ul>

      <div className='mt-auto flex flex-col gap-0.5 px-1'>
        <ExternalLinkButton
          label='Documentation'
          icon={HelpCircle}
          href='https://docs.arcentra.io/'
          expanded={expanded}
        />
        <NavUserDockTrigger expanded={expanded} />
      </div>
    </nav>
  )
}
