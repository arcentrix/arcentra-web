import { proxy, subscribe } from 'valtio'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'APP_THEME'

// 从 localStorage 读取主题，默认为 system
const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored as Theme
    }
  } catch (e) {
    // ignore
  }
  return 'system'
}

export const themeStore = proxy<ThemeStore>({
  theme: getInitialTheme(),
  setTheme: (theme: Theme) => {
    themeStore.theme = theme
  },
})

// 监听主题变化，同步到 localStorage 和 DOM
subscribe(themeStore, () => {
  try {
    localStorage.setItem(STORAGE_KEY, themeStore.theme)
  } catch (e) {
    // ignore
  }
  
  applyTheme(themeStore.theme)
})

// 应用主题
function applyTheme(theme: Theme) {
  const root = document.documentElement
  
  // 移除现有主题 class
  root.classList.remove('light', 'dark')
  
  if (theme === 'system') {
    // 系统主题：根据用户系统偏好设置
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (systemDark) {
      root.classList.add('dark')
    }
  } else if (theme === 'dark') {
    root.classList.add('dark')
  }
  // light 主题不需要添加 class
}

// 初始化时应用主题
if (typeof document !== 'undefined') {
  applyTheme(themeStore.theme)
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeStore.theme === 'system') {
      applyTheme('system')
    }
  })
}

