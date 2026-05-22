import { get } from "../client";
import type { PermissionMenuItem, ScopeRef } from "@/store/permission";

function toParams(scope?: ScopeRef) {
  if (!scope?.scopeType && !scope?.scopeId) {
    return undefined;
  }
  return {
    params: {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    },
  };
}

function getMenus(scope?: ScopeRef) {
  return get<PermissionMenuItem[]>("/me/menus", toParams(scope));
}

function getRoutes(scope?: ScopeRef) {
  return get<string[]>("/me/routes", toParams(scope));
}

function getEffectiveActions(scope?: ScopeRef) {
  return get<string[]>("/me/effective-actions", toParams(scope));
}

export default {
  getMenus,
  getRoutes,
  getEffectiveActions,
};
