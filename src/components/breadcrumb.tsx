/**
 * 面包屑导航组件
 */

import { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apis } from '@/api'

interface BreadcrumbItem {
  title: string
  url?: string
}

interface BreadcrumbProps {
  className?: string
}

// 路由到页面标题的映射
const routeTitleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Overview',
  '/agents': 'Overview',
  '/users': 'Users',
  '/roles': 'Roles',
  '/access': 'Access',
  '/settings': 'Settings',
  '/general-settings': 'General Settings',
  '/settings/notifications': 'Notifications',
  '/identity-integration': 'Identity',
  '/settings/system-info': 'System Information',
  '/inbox': 'Inbox',
  '/workspace/:workspaceName/chat': 'Chat',
  '/workspace/:workspaceName/history': 'History',
}

// 一级菜单配置
const mainMenuItems = [
  { title: 'Projects', url: '/projects' },
  { title: 'Agents', url: '/agents' },
  { title: 'Access', url: '/access' },
  { title: 'Settings', url: '/settings' },
]

const flatRouteToMenu: Record<string, { parent: string; parentUrl: string }> = {
  '/users': { parent: 'Access', parentUrl: '/access' },
  '/roles': { parent: 'Access', parentUrl: '/access' },
  '/identity-integration': { parent: 'Settings', parentUrl: '/settings' },
  '/general-settings': { parent: 'Settings', parentUrl: '/settings' },
  '/settings/notifications': { parent: 'Settings', parentUrl: '/settings' },
  '/settings/system-info': { parent: 'Settings', parentUrl: '/settings' },
}

// Agent 名称缓存，避免重复请求
const agentNameCache = new Map<string, string>()

export function Breadcrumb({ className }: BreadcrumbProps) {
  const location = useLocation()
  const pathname = location.pathname
  const [agentName, setAgentName] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const currentAgentIdRef = useRef<string | null>(null)

  // 提取路由参数
  const agentMatch = pathname.match(/^\/agents\/([^/]+)$/)
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)

  // 加载 agent 名称
  useEffect(() => {
    if (agentMatch) {
      const agentId = agentMatch[1]
      
      // 如果 ID 没有变化，跳过
      if (currentAgentIdRef.current === agentId) {
        return
      }
      
      currentAgentIdRef.current = agentId
      
      // 检查缓存
      if (agentNameCache.has(agentId)) {
        setAgentName(agentNameCache.get(agentId) || null)
        setLoading(false)
        return
      }
      
      // API 层面已经有请求去重机制，所以这里可以直接请求
      // 即使 Detail 页面也在请求，API 层面会确保只请求一次
      setLoading(true)
      Apis.agent
        .getAgentById(agentId)
        .then((agent) => {
          // 确保 ID 仍然匹配（防止快速切换路由导致的状态混乱）
          if (currentAgentIdRef.current === agentId) {
            const name = agent.agentName
            agentNameCache.set(agentId, name)
            setAgentName(name)
          }
        })
        .catch(() => {
          if (currentAgentIdRef.current === agentId) {
            setAgentName(null)
          }
        })
        .finally(() => {
          if (currentAgentIdRef.current === agentId) {
            setLoading(false)
          }
        })
    } else {
      currentAgentIdRef.current = null
      setAgentName(null)
    }
  }, [pathname, agentMatch])

  // 加载项目名称（如果有项目 API）
  useEffect(() => {
    if (projectMatch) {
      const projectId = projectMatch[1]
      // TODO: 如果有项目 API，在这里加载项目名称
      // 暂时使用项目 ID
      setProjectName(projectId)
    } else {
      setProjectName(null)
    }
  }, [pathname])

  // 生成面包屑项
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = []

    // Dashboard 页面
    if (pathname === '/') {
      return [{ title: 'Dashboard' }]
    }

    // 如果是 workspace 页面（需要在匹配一级菜单之前处理）
    if (pathname.match(/^\/workspace\/[^/]+\/(chat|history)$/)) {
      const match = pathname.match(/^\/workspace\/([^/]+)\/(chat|history)$/)
      if (match) {
        const [, workspaceName, page] = match
        const decodedWorkspaceName = decodeURIComponent(workspaceName)
        // 添加一级菜单 "LLM Dialogue"（虽然不在 mainMenuItems 中，但需要显示）
        items.push({ title: 'LLM Dialogue' })
        // 添加 workspace 名称，链接到该 workspace 的 chat 页面
        items.push({ 
          title: decodedWorkspaceName,
          url: `/workspace/${workspaceName}/chat`
        })
        // 添加页面名称
        if (page === 'chat') {
          // 对于 chat 页面，尝试从 URL 查询参数中获取 title
          const titleParam = new URLSearchParams(location.search).get('title')
          items.push({ title: titleParam || 'New chat' })
        } else {
          items.push({ title: 'History' })
        }
      }
      return items
    }

    // 如果是 inbox 或其他独立页面
    if (pathname === '/inbox') {
      return [{ title: 'Inbox' }]
    }

    // 检查是否为需要映射到父菜单的扁平路由
    const flatMapping = flatRouteToMenu[pathname]
    if (flatMapping) {
      const pageTitle = routeTitleMap[pathname]
      items.push({ title: flatMapping.parent, url: flatMapping.parentUrl })
      if (pageTitle) items.push({ title: pageTitle })
      return items
    }

    // 查找匹配的一级菜单
    const matchedMenu = mainMenuItems.find((menu) => pathname.startsWith(menu.url))

    // 如果没有匹配的一级菜单，显示路径作为标题
    if (!matchedMenu) {
      const pageTitle = routeTitleMap[pathname]
      if (pageTitle) return [{ title: pageTitle }]
      return []
    }

    // 添加一级菜单
    items.push({
      title: matchedMenu.title,
      url: matchedMenu.url,
    })

    // 如果是项目详情页
    if (pathname.match(/^\/projects\/[^/]+$/)) {
      items.push({ title: 'Overview', url: '/projects' })
      items.push({ title: projectName || 'Project Detail' })
      return items
    }

    // 如果是项目子页面
    if (pathname.match(/^\/projects\/[^/]+\//)) {
      const parts = pathname.split('/').filter(Boolean)
      if (parts.length >= 3) {
        items.push({ title: 'Overview', url: '/projects' })
        items.push({ title: projectName || 'Project Detail' })
        const subPage = parts[2]
        const subPageTitle = subPage.charAt(0).toUpperCase() + subPage.slice(1)
        items.push({ title: subPageTitle })
      }
      return items
    }

    // 如果是 agent 详情页
    if (pathname.match(/^\/agents\/[^/]+$/)) {
      items.push({ title: 'Overview', url: '/agents' })
      items.push({ title: loading ? 'Loading...' : agentName || 'Agent Detail' })
      return items
    }

    // 如果是 pipeline 详情页
    if (pathname.match(/^\/projects\/[^/]+\/pipelines\/[^/]+$/)) {
      items.push({ title: 'Overview', url: '/projects' })
      items.push({ title: projectName || 'Project Detail' })
      items.push({ title: 'Pipelines' })
      items.push({ title: 'Pipeline Detail' })
      return items
    }

    // 如果是 pipeline history
    if (pathname.match(/^\/projects\/[^/]+\/pipelines\/runs$/)) {
      items.push({ title: 'Overview', url: '/projects' })
      items.push({ title: projectName || 'Project Detail' })
      items.push({ title: 'Pipeline History' })
      return items
    }

    // 其他页面，从映射中获取标题
    const pageTitle = routeTitleMap[pathname]
    if (pageTitle && pageTitle !== matchedMenu.title) {
      items.push({ title: pageTitle })
    }

    return items
  }

  const breadcrumbs = generateBreadcrumbs()

  // 如果没有面包屑项，不显示
  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {isLast ? (
                <span className="font-medium text-foreground">{item.title}</span>
              ) : item.url ? (
                <Link
                  to={item.url}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">{item.title}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

