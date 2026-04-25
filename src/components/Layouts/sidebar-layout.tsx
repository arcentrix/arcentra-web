import { FC } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarLayout, SidebarTrigger } from '@/components/ui/sidebar'
import { Breadcrumb } from '@/components/breadcrumb'

interface SidebarLayoutWrapperProps {}

const SidebarLayoutWrapper: FC<SidebarLayoutWrapperProps> = () => {
  return (
    <SidebarLayout defaultOpen>
      <AppSidebar />
      <main className='flex flex-1 flex-col p-2 transition-all duration-300 ease-in-out overflow-hidden'>
        <div className='h-full rounded-md flex flex-col'>
          <div className='flex items-center gap-4 p-4 shrink-0'>
            <SidebarTrigger />
            <Breadcrumb />
          </div>
          <div className='flex-1 min-h-0 overflow-y-auto'>
            <Outlet />
          </div>
        </div>
      </main>
    </SidebarLayout>
  )
}

export default SidebarLayoutWrapper

