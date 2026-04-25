import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Search, LayoutDashboard, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

type NavSubItem = {
  title: string
  url: string
  items?: NavSubItem[]
}

export function NavMain({
  className,
  items,
  searchResults,
  dashboardUrl,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: NavSubItem[]
  }[]
  searchResults: React.ComponentProps<typeof SidebarSearch>['results']
  dashboardUrl?: string
} & React.ComponentProps<'ul'>) {
  const location = useLocation()
  
  return (
    <ul className={cn('grid gap-0.5', className)}>
      <li>
        <SidebarSearch results={searchResults} />
      </li>
      {dashboardUrl && (
        <li>
          <Link
            to={dashboardUrl}
            className={cn(
              'min-w-8 flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-1.5 text-sm font-medium outline-none ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2',
              location.pathname === dashboardUrl ? 'bg-accent text-accent-foreground' : ''
            )}
          >
            <LayoutDashboard className='h-4 w-4 shrink-0' />
            <div className='flex flex-1 overflow-hidden'>
              <div className='line-clamp-1 pr-6'>Dashboard</div>
            </div>
          </Link>
        </li>
      )}
      {items.map((item) => (
        <NavItem key={item.title} item={item} />
      ))}
    </ul>
  )
}

function NavItem({
  item,
}: {
  item: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: NavSubItem[]
  }
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(item.isActive || false)
  
  // 只在子项被访问时自动展开（不包括一级菜单自身）
  useEffect(() => {
    if (item.items) {
      const hasActiveChild = item.items.some(subItem => {
        // 检查直接子项
        if (location.pathname === subItem.url) return true;
        // 检查嵌套子项
        if (subItem.items) {
          return subItem.items.some(child => location.pathname === child.url);
        }
        return false;
      });
      if (hasActiveChild) {
        setIsOpen(true);
      }
    }
  }, [location.pathname, item.items])

  const hasValidSubItems = !!(item.items && item.items.length > 0 && item.url && item.url !== '#')
  const isCurrentPath = hasValidSubItems && (
    location.pathname === item.url ||
    item.items!.some(subItem => {
      if (location.pathname === subItem.url) return true
      if (subItem.items) {
        return subItem.items.some(child => location.pathname === child.url)
      }
      return false
    })
  )

  useEffect(() => {
    if (isCurrentPath) {
      setIsOpen(true)
    }
  }, [isCurrentPath])

  if (hasValidSubItems) {
    return (
      <li>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className='relative min-w-8 flex h-8 w-full items-center gap-1 overflow-hidden rounded-md px-1.5 text-sm font-medium outline-none'>
            <Link 
              to={item.url} 
              className='flex items-center gap-2 flex-1 overflow-hidden'
              onClick={(e) => {
                // 点击菜单项时，如果菜单未展开，则展开它
                if (!isOpen) {
                  e.preventDefault()
                  setIsOpen(true)
                  // 使用 navigate 延迟导航，让展开动画先执行
                  setTimeout(() => {
                    navigate(item.url)
                  }, 150)
                }
              }}
            >
              <item.icon className='h-4 w-4 shrink-0' />
              <div className='flex flex-1 overflow-hidden'>
                <div className='line-clamp-1'>{item.title}</div>
              </div>
            </Link>
            <CollapsibleTrigger asChild>
              <button
                className='shrink-0 p-1.5 hover:bg-accent rounded-md cursor-pointer transition-all hover:text-accent-foreground'
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(!isOpen)
                }}
              >
                <ChevronRight className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-90'
                )} />
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className='px-4 py-0.5'>
            <ul className='grid border-l px-2'>
              {item.items?.map((subItem) => {
                // 检查是否有子菜单
                if (subItem.items && subItem.items.length > 0) {
                  return <NestedNavItem key={subItem.title} item={subItem} />
                }
                
                const isActive = location.pathname === subItem.url
                return (
                  <li key={subItem.title}>
                    <Link
                      to={subItem.url}
                      className={cn(
                        'min-w-8 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-medium ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <div className='line-clamp-1'>{subItem.title}</div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  // 如果没有有效URL，则整个区域是展开按钮
  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className='relative min-w-8 flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-1.5 text-sm font-medium outline-none ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 cursor-pointer'
            role='button'
            tabIndex={0}
          >
            <item.icon className='h-4 w-4 shrink-0' />
            <div className='flex flex-1 overflow-hidden'>
              <div className='line-clamp-1 pr-6'>{item.title}</div>
            </div>
            {item.items && item.items.length > 0 && (
              <ChevronRight className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                isOpen && 'rotate-90'
              )} />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className='px-4 py-0.5'>
          <ul className='grid border-l px-2'>
            {item.items?.map((subItem) => {
              // 检查是否有子菜单
              if (subItem.items && subItem.items.length > 0) {
                return <NestedNavItem key={subItem.title} item={subItem} />
              }
              
              const isActive = location.pathname === subItem.url
              return (
                <li key={subItem.title}>
                  <Link
                    to={subItem.url}
                    className={cn(
                      'min-w-8 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-medium ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2',
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <div className='line-clamp-1'>{subItem.title}</div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

// 嵌套子菜单项
function NestedNavItem({
  item,
}: {
  item: NavSubItem
}) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  // 检查是否有激活的子项
  useEffect(() => {
    if (item.items) {
      const hasActiveChild = item.items.some(child => location.pathname === child.url)
      if (hasActiveChild) {
        setIsOpen(true)
      }
    }
  }, [location.pathname, item.items])

  // 如果有链接地址，则渲染为可点击的链接 + 独立的展开按钮
  if (item.url && item.url !== '#') {
    return (
      <li>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className='min-w-8 flex h-8 items-center gap-1 overflow-hidden rounded-md px-2 text-sm font-medium text-muted-foreground'>
            <Link to={item.url} className='flex flex-1 overflow-hidden'>
              <div className='line-clamp-1'>{item.title}</div>
            </Link>
            {item.items && item.items.length > 0 && (
              <CollapsibleTrigger asChild>
                <button
                  className='shrink-0 p-1.5 hover:bg-accent rounded-md cursor-pointer transition-all hover:text-accent-foreground'
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <ChevronRight className={cn(
                    'h-3 w-3 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90'
                  )} />
                </button>
              </CollapsibleTrigger>
            )}
          </div>
          <CollapsibleContent className='pl-2'>
            <ul className='grid border-l ml-2'>
              {item.items?.map((child) => {
                const isActive = location.pathname === child.url
                return (
                  <li key={child.title}>
                    <Link
                      to={child.url}
                      className={cn(
                        'min-w-8 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-medium ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <div className='line-clamp-1'>{child.title}</div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  // 如果没有链接地址，整个区域都是展开/折叠按钮
  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className='min-w-8 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-medium text-muted-foreground ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 cursor-pointer'
            role='button'
            tabIndex={0}
          >
            <div className='flex flex-1 overflow-hidden'>
              <div className='line-clamp-1'>{item.title}</div>
            </div>
            <ChevronRight className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-90'
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className='pl-2'>
          <ul className='grid border-l ml-2'>
            {item.items?.map((child) => {
              const isActive = location.pathname === child.url
              return (
                <li key={child.title}>
                  <Link
                    to={child.url}
                    className={cn(
                      'min-w-8 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-sm font-medium ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2',
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <div className='line-clamp-1'>{child.title}</div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

type SearchResult = {
  title: string
  teaser: string
  url: string
  category?: 'workspace' | 'project' | 'documentation'
}

function SearchResultsList({
  results,
  query,
  onSelect,
}: {
  results: SearchResult[]
  query: string
  onSelect: () => void
}) {
  const filtered = query.trim()
    ? results.filter(r =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.teaser.toLowerCase().includes(query.toLowerCase())
      )
    : results

  const projectResults = filtered.filter(r => r.category === 'workspace' || r.category === 'project' || !r.category)
  const docResults = filtered.filter(r => r.category === 'documentation')

  if (filtered.length === 0) {
    return (
      <div className='px-2.5 py-6 text-center text-sm text-muted-foreground'>
        No results found.
      </div>
    )
  }

  return (
    <>
      {projectResults.length > 0 && (
        <>
          {projectResults.map((result) =>
            result.url.startsWith('http') ? (
              <a
                key={result.title}
                className='rounded-md p-2.5 outline-none ring-ring hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 block cursor-pointer'
                href={result.url}
                target='_blank'
                rel='noopener noreferrer'
                onClick={onSelect}
              >
                <div className='font-medium'>{result.title}</div>
                <div className='line-clamp-2 text-muted-foreground'>{result.teaser}</div>
              </a>
            ) : (
              <Link
                key={result.title}
                className='rounded-md p-2.5 outline-none ring-ring hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 block'
                to={result.url}
                onClick={onSelect}
              >
                <div className='font-medium'>{result.title}</div>
                <div className='line-clamp-2 text-muted-foreground'>{result.teaser}</div>
              </Link>
            )
          )}
        </>
      )}
      {docResults.length > 0 && (
        <>
          {projectResults.length > 0 && <Separator className='my-1.5' />}
          <div className='px-2.5 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
            Documentation
          </div>
          {docResults.map((result) => (
            <a
              key={result.title}
              className='rounded-md p-2.5 outline-none ring-ring hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 block cursor-pointer'
              href={result.url}
              target='_blank'
              rel='noopener noreferrer'
              onClick={onSelect}
            >
              <div className='font-medium'>{result.title}</div>
              <div className='line-clamp-2 text-muted-foreground'>{result.teaser}</div>
            </a>
          ))}
        </>
      )}
      {!query.trim() && (
        <>
          <Separator className='my-1.5' />
          <Link
            className='rounded-md px-2.5 py-1 text-muted-foreground outline-none ring-ring hover:text-foreground focus-visible:ring-2 block'
            to='/projects'
            onClick={onSelect}
          >
            See all projects
          </Link>
          <a
            className='rounded-md px-2.5 py-1 text-muted-foreground outline-none ring-ring hover:text-foreground focus-visible:ring-2 block cursor-pointer'
            href='https://docs.arcentra.io/'
            target='_blank'
            rel='noopener noreferrer'
            onClick={onSelect}
          >
            Browse all documentation
          </a>
        </>
      )}
    </>
  )
}

function SidebarSearch({
  results,
}: {
  results: SearchResult[]
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const handleSelect = () => setOpen(false)

  const triggerContent = (
    <>
      <Search className='h-4 w-4 shrink-0' />
      <div className='flex flex-1 overflow-hidden'>
        <div className='line-clamp-1 pr-6'>Search</div>
      </div>
      <KbdGroup className='hidden sm:inline-flex'>
        <Kbd>⌘</Kbd>
        <span className='text-muted-foreground'>+</span>
        <Kbd>K</Kbd>
      </KbdGroup>
    </>
  )

  const triggerClass = 'min-w-8 flex h-8 w-full flex-1 items-center gap-2 overflow-hidden rounded-md px-1.5 text-sm font-medium outline-none ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground cursor-pointer'

  const searchInput = (
    <div className='border-b p-2.5'>
      <Input
        className='h-8 rounded-sm shadow-none focus-visible:ring-0'
        placeholder='Search projects, workspaces, and docs...'
        type='search'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger className={triggerClass}>
          {triggerContent}
        </DrawerTrigger>
        <DrawerContent>
          {searchInput}
          <div className='grid gap-1 p-1.5 text-sm max-h-[400px] overflow-y-auto'>
            <SearchResultsList results={results} query={query} onSelect={handleSelect} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerClass}>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-96 p-0' side='right' sideOffset={4}>
        {searchInput}
        <div className='grid gap-1 p-1.5 text-sm max-h-[400px] overflow-y-auto'>
          <SearchResultsList results={results} query={query} onSelect={handleSelect} />
        </div>
      </PopoverContent>
    </Popover>
  )
}