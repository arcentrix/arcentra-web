import { proxy, useSnapshot } from 'valtio'
import type { UserInfo, UserRole } from '@/models/user'
import storage from '@/lib/storage'

interface StateUser {
  userinfo: UserInfo | null
  role: UserRole | null
}

class UserStore {
  private state: StateUser = proxy<StateUser>({
    userinfo: null,
    role: null,
  })

  constructor() {
    const localUserinfo = storage.get('USER_INFO', { userinfo: null, role: null }) as StateUser
    if (localUserinfo.userinfo && localUserinfo.role) {
      this.state.userinfo = localUserinfo.userinfo
      this.state.role = localUserinfo.role
    }
  }

  getState() {
    return this.state
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSnapshot(this.state)
  }

  updateState(mutate: (state: StateUser) => void) {
    mutate(this.state)
    return this
  }

  setUserinfo(userinfo: UserInfo, role: UserRole) {
    this.state.userinfo = userinfo
    this.state.role = role
    storage.set('USER_INFO', { userinfo, role })
    return this
  }

  clearUserinfo() {
    this.state.userinfo = null
    this.state.role = null
    storage.remove('USER_INFO')
    return this
  }
}

const userStore = new UserStore()

export default userStore
