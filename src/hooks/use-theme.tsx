import { useSnapshot } from 'valtio'
import { themeStore, type Theme } from '@/store/theme'

export function useTheme() {
  const snap = useSnapshot(themeStore)

  return {
    theme: snap.theme,
    setTheme: themeStore.setTheme,
  }
}

export type { Theme }

