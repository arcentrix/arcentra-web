import { proxy, useSnapshot } from 'valtio'
import type { AuthToken } from '@/models/auth'
import storage from '@/lib/storage'

interface StateAuth extends AuthToken {
  initialized: boolean
}

class AuthStore {
  private state: StateAuth = proxy<StateAuth>({
    accessToken: '',
    refreshToken: '',
    initialized: false,
  })

  constructor() {
    const localTokens = storage.get('TOKENS', { accessToken: '', refreshToken: '' }) as AuthToken
    if (localTokens.accessToken && localTokens.refreshToken) {
      this.setTokens(localTokens)
    }
  }

  getState() {
    return this.state
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSnapshot(this.state)
  }

  updateState(mutate: (state: StateAuth) => void) {
    mutate(this.state)
    return this
  }

  setTokens(tokens: AuthToken) {
    this.state.accessToken = tokens.accessToken
    this.state.refreshToken = tokens.refreshToken
    this.state.initialized = true
    storage.set('TOKENS', tokens)
    return this
  }

  clearTokens() {
    this.state.accessToken = ''
    this.state.refreshToken = ''
    this.state.initialized = false
    storage.remove('TOKENS')
    return this
  }
}

const authStore = new AuthStore()

export default authStore
