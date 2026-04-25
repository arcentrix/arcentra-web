import {
  Eclipse,
  Frame,
  Rabbit,
  Settings2,
  Workflow,
  Zap,
  BookOpen,
  Brain,
  Shield,
} from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavProjects } from '@/components/nav-projects'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { OrgSwitcher } from '@/components/org-manage'
import { BugReportDialog } from '@/components/bug-report-dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
} from '@/components/ui/sidebar'
import { DEFAULT_USER_AVATAR } from '@/constants/assets'

export function AppSidebar() {
  const data = {
    organizations: [
      {
        name: 'Arcentra',
        logo: Workflow,
        plan: 'Enterprise',
      },
      {
        name: 'Acme Corp.',
        logo: Eclipse,
        plan: 'Startup',
      },
      {
        name: 'Evil Corp.',
        logo: Rabbit,
        plan: 'Free',
      },
    ],
    // NavUser 组件会自己从 store 获取用户信息，这里只是默认值
    user: {
      name: 'User',
      email: 'user@example.com',
      avatar: DEFAULT_USER_AVATAR,
    },
    navMain: [
      {
        title: 'Projects',
        url: '/projects',
        icon: Frame,
        items: [
          {
            title: 'Overview',
            url: '/projects',
          },
        ],
      },
      {
        title: 'Agents',
        url: '/agents',
        icon: Zap,
        items: [
          {
            title: 'Overview',
            url: '/agents',
          },
        ],
      },
      {
        title: 'Access',
        url: '/access',
        icon: Shield,
        items: [
          {
            title: 'Users',
            url: '/users',
          },
          {
            title: 'Roles',
            url: '/roles',
          },
        ],
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings2,
        items: [
          {
            title: 'General Settings',
            url: '/general-settings',
          },
          {
            title: 'Notifications',
            url: '/settings/notifications',
          },
          {
            title: 'Identity',
            url: '/identity-integration',
          },
          {
            title: 'System Information',
            url: '/settings/system-info',
          },
        ],
      },
    ],

    navSecondary: [
      {
        title: 'Documentation',
        url: 'https://docs.arcentra.io/',
        icon: BookOpen,
      },
    ],
    projects: [] as { name: string; url: string; icon: typeof Brain }[],
    searchResults: [
      {
        title: 'ML Model Training',
        teaser: 'AI workspace for machine learning model training and conversations',
        url: '/workspace/ML Model Training/chat',
        category: 'workspace' as const,
      },
      {
        title: 'Projects Overview',
        teaser: 'View and manage all your projects',
        url: '/projects',
        category: 'project' as const,
      },
      {
        title: 'Agents',
        teaser: 'Manage and configure AI agents',
        url: '/agents',
        category: 'project' as const,
      },
      {
        title: 'Settings',
        teaser: 'Configure application settings and preferences',
        url: '/settings',
        category: 'project' as const,
      },
      {
        title: 'Getting Started',
        teaser: 'Learn how to get started with Arcentra platform',
        url: 'https://docs.arcentra.io/getting-started',
        category: 'documentation' as const,
      },
      {
        title: 'Pipeline Configuration',
        teaser: 'Guide on how to configure and manage pipelines',
        url: 'https://docs.arcentra.io/pipelines/configuration',
        category: 'documentation' as const,
      },
      {
        title: 'Agent Management',
        teaser: 'Documentation on creating and managing AI agents',
        url: 'https://docs.arcentra.io/agents/management',
        category: 'documentation' as const,
      },
      {
        title: 'API Reference',
        teaser: 'Complete API reference for Arcentra platform',
        url: 'https://docs.arcentra.io/api/reference',
        category: 'documentation' as const,
      },
      {
        title: 'Deployment Guide',
        teaser: 'Step-by-step guide for deploying applications',
        url: 'https://docs.arcentra.io/deployment/guide',
        category: 'documentation' as const,
      },
    ],
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <OrgSwitcher orgs={data.organizations} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarItem>
          <SidebarLabel>Platform</SidebarLabel>
          <NavMain items={data.navMain} searchResults={data.searchResults} dashboardUrl='/' />
        </SidebarItem>
        <SidebarItem>
          <SidebarLabel>LLM Dialogue</SidebarLabel>
          <NavProjects projects={data.projects} />
        </SidebarItem>
        <SidebarItem className='mt-auto'>
          <SidebarLabel>Help</SidebarLabel>
          <a
            href='https://app.slack.com/client/T07MSU3LJB0/C0A5LSRLNC8'
            target='_blank'
            rel='noopener noreferrer'
            className='flex h-7 w-full items-center gap-2.5 overflow-hidden rounded-md px-1.5 text-xs ring-ring transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 cursor-pointer'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              className='h-4 w-4 shrink-0 translate-x-0.5 text-muted-foreground'
            >
              <path
                d='M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z'
                fill='currentColor'
              />
            </svg>
            <span className='line-clamp-1 font-medium text-muted-foreground'>Slack</span>
          </a>
          <BugReportDialog />
          <NavSecondary items={data.navSecondary} />
        </SidebarItem>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
