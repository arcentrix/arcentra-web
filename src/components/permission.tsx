import type { PropsWithChildren } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { ScopeRef } from "@/store/permission";

interface PermissionProps extends PropsWithChildren {
  action: string;
  scope?: ScopeRef;
  fallback?: React.ReactNode;
}

export function Permission({ action, scope, fallback = null, children }: PermissionProps) {
  const { has } = usePermission();
  if (!has(action, scope)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
