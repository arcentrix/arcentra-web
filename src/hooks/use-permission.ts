import permissionStore from "@/store/permission";
import type { ScopeRef } from "@/store/permission";

export function usePermission() {
  const permission = permissionStore.useState();

  const has = (action: string, scope?: ScopeRef) =>
    permissionStore.has(action, scope);

  return {
    loading: permission.loading,
    actions: permission.actions,
    has,
  };
}
