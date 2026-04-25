/**
 * 右上角组织信息显示组件
 */

import { useOrganizationStore } from "@/store/organization"
import { APP_LOGO_ICON } from '@/constants/assets'

export function OrgHeaderDisplay() {
  const { currentOrganization } = useOrganizationStore()
  
  // 获取显示的组织信息
  const displayName = currentOrganization?.name || 'Arcentra'
  const displayLogo = currentOrganization?.logo || APP_LOGO_ICON
  
  return (
    <div className="flex items-center gap-2">
      <img alt={displayName} src={displayLogo} className="h-6 w-6 rounded-sm" />
      <span className="text-sm font-medium text-foreground">{displayName}</span>
    </div>
  )
}

