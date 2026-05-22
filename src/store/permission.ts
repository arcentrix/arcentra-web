import { proxy, useSnapshot } from "valtio";
import { Apis } from "@/api";

const wildcardAction = "*:*";

export interface ScopeRef {
  scopeType?: string;
  scopeId?: string;
}

export interface PermissionMenuItem {
  menuId: string;
  parentId: string;
  name: string;
  title?: string;
  path: string;
  component: string;
  redirect?: string;
  isLayout?: boolean;
  isIndex?: boolean;
  icon?: string;
  order?: number;
  scopeType?: string;
  permissionAction?: string;
  meta?: string;
  isVisible?: boolean;
  isEnabled?: boolean;
  description?: string;
  children?: readonly PermissionMenuItem[];
}

interface PermissionState {
  menus: PermissionMenuItem[];
  routes: string[];
  actions: string[];
  scopedActions: Record<string, string[]>;
  loading: boolean;
  initialized: boolean;
}

class PermissionStore {
  private state = proxy<PermissionState>({
    menus: [],
    routes: [],
    actions: [],
    scopedActions: {},
    loading: false,
    initialized: false,
  });

  getState() {
    return this.state;
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSnapshot(this.state);
  }

  private buildScopeKey(scope?: ScopeRef) {
    const scopeType = scope?.scopeType ?? "platform";
    const scopeId = scope?.scopeId ?? "";
    return `${scopeType}:${scopeId}`;
  }

  has(action: string, scope?: ScopeRef) {
    if (!action) return false;
    const key = this.buildScopeKey(scope);
    const scopedActions = this.state.scopedActions[key];
    if (scopedActions?.length) {
      return scopedActions.includes(action) || scopedActions.includes(wildcardAction);
    }
    return this.state.actions.includes(action) || this.state.actions.includes(wildcardAction);
  }

  async fetch(scope?: ScopeRef) {
    this.state.loading = true;
    try {
      const [menus, routes, actions] = await Promise.all([
        Apis.me.getMenus(scope),
        Apis.me.getRoutes(scope),
        Apis.me.getEffectiveActions(scope),
      ]);
      const key = this.buildScopeKey(scope);
      this.state.menus = menus ?? [];
      this.state.routes = routes ?? [];
      this.state.actions = actions ?? [];
      this.state.scopedActions[key] = actions ?? [];
      this.state.initialized = true;
    } finally {
      this.state.loading = false;
    }
  }

  async refresh(scope?: ScopeRef) {
    await this.fetch(scope);
  }

  clear() {
    this.state.menus = [];
    this.state.routes = [];
    this.state.actions = [];
    this.state.scopedActions = {};
    this.state.loading = false;
    this.state.initialized = false;
  }
}

const permissionStore = new PermissionStore();

export default permissionStore;
