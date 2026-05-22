import { Fragment, Suspense } from "react";
import { Navigate, Outlet, Route } from "react-router-dom";
import type { PermissionMenuItem } from "@/store/permission";
import { resolveRouteComponent } from "./component-registry";
import RoutePermissionGuard from "@/components/route-permission-guard";

type RouteMenuItem = PermissionMenuItem & {
  children?: readonly RouteMenuItem[];
};

function RouteLoadingFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
}

function DynamicComponent({
  componentKey,
  isLayout,
}: {
  componentKey?: string;
  isLayout?: boolean;
}) {
  if (isLayout) {
    return <Outlet />;
  }
  const Resolved = resolveRouteComponent(componentKey || "");
  if (!Resolved) {
    return <RouteLoadingFallback />;
  }
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Resolved />
    </Suspense>
  );
}

export function buildDynamicRoutes(menus: readonly RouteMenuItem[]) {
  const renderNodes = (items: readonly RouteMenuItem[]) => {
    return items
      .filter((item) => item.isEnabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item) => {
        const children = item.children ?? [];
        const element = (
          <RoutePermissionGuard permissionAction={item.permissionAction}>
            <DynamicComponent
              componentKey={item.component}
              isLayout={item.isLayout}
            />
          </RoutePermissionGuard>
        );

        if (item.isIndex) {
          return (
            <Route
              key={item.menuId}
              index
              element={element}
            />
          );
        }

        return (
          <Route
            key={item.menuId}
            path={item.path}
            element={element}
          >
            {item.redirect ? <Route index element={<Navigate to={item.redirect} replace />} /> : null}
            {children.length ? renderNodes(children) : null}
          </Route>
        );
      });
  };

  return <Fragment>{renderNodes(menus)}</Fragment>;
}
