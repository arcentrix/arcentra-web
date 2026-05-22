import { proxy, useSnapshot } from "valtio";
import type { UserInfo, UserRole } from "@/models/user";
import storage from "@/lib/storage";

interface StateUser {
  userinfo: UserInfo | null;
  role: UserRole | null;
  effectiveActions: string[];
}

class UserStore {
  private state: StateUser = proxy<StateUser>({
    userinfo: null,
    role: null,
    effectiveActions: [],
  });

  constructor() {
    const localUserinfo = storage.get("USER_INFO", {
      userinfo: null,
      role: null,
      effectiveActions: [],
    }) as StateUser;
    if (localUserinfo.userinfo && localUserinfo.role) {
      this.state.userinfo = localUserinfo.userinfo;
      this.state.role = localUserinfo.role;
      this.state.effectiveActions = localUserinfo.effectiveActions || [];
    }
  }

  getState() {
    return this.state;
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSnapshot(this.state);
  }

  updateState(mutate: (state: StateUser) => void) {
    mutate(this.state);
    return this;
  }

  setUserinfo(userinfo: UserInfo, role: UserRole, effectiveActions: string[] = []) {
    this.state.userinfo = userinfo;
    this.state.role = role;
    this.state.effectiveActions = effectiveActions;
    storage.set("USER_INFO", { userinfo, role, effectiveActions });
    return this;
  }

  setEffectiveActions(effectiveActions: string[]) {
    this.state.effectiveActions = effectiveActions;
    const current = storage.get("USER_INFO", {
      userinfo: this.state.userinfo,
      role: this.state.role,
      effectiveActions: [],
    }) as StateUser;
    storage.set("USER_INFO", { ...current, effectiveActions });
    return this;
  }

  clearUserinfo() {
    this.state.userinfo = null;
    this.state.role = null;
    this.state.effectiveActions = [];
    storage.remove("USER_INFO");
    return this;
  }
}

const userStore = new UserStore();

export default userStore;
