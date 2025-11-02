import { isNil } from 'lodash-es'

type StorageKeys = 'LOGIN_FALLBACK_URL' | 'USER_INFO' | 'TOKENS'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

const DEFAULT_CACHE_TIME = 60 * 60 * 24 * 7 // 1 week

class WebStorage<Keys = StorageKeys> {
  constructor(
    private storage: Storage,
    private prefixKey?: string,
  ) {}

  private getKey(key: Keys) {
    return `${this.prefixKey}${key}`.toUpperCase()
  }

  set(key: Keys, value: AnyData, expire: number | null = DEFAULT_CACHE_TIME) {
    const stringData = JSON.stringify({
      value,
      time: !isNil(expire) ? Date.now() : null,
      expire: !isNil(expire) ? new Date().getTime() + expire * 1000 : null,
    })
    this.storage.setItem(this.getKey(key), stringData)
  }

  get(key: Keys, def: AnyData = null): AnyData {
    const val = this.storage.getItem(this.getKey(key))
    if (!val) return def

    try {
      const data = JSON.parse(val)
      const { value, expire } = data
      if (isNil(expire) || expire >= new Date().getTime()) {
        return value
      }
      this.remove(key)
    } catch (e) {
      return def
    }
  }

  remove(key: Keys) {
    this.storage.removeItem(this.getKey(key))
  }

  /**
   * Delete all caches of this instance
   */
  clear(): void {
    this.storage.clear()
  }
}

const arcadeWebStorage = new WebStorage(localStorage, 'ARCADE_')

export default arcadeWebStorage
