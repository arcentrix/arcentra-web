import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import permissionStore from "@/store/permission";
import type { ScopeRef } from "@/store/permission";

interface RoutePermissionGuardProps extends PropsWithChildren {
  permissionAction?: string;
  scope?: ScopeRef;
}

export default function RoutePermissionGuard({
  permissionAction,
  scope,
  children,
}: RoutePermissionGuardProps) {
  const location = useLocation();
  if (!permissionAction) {
    return <>{children}</>;
  }
  const allowed = permissionStore.has(permissionAction, scope);
  if (allowed) {
    return <>{children}</>;
  }
  return <Navigate to="/403" replace state={{ from: location.pathname }} />;
}
