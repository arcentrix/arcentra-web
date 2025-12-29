import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 从 cookie 中读取指定名称的值
 * @param name cookie 名称
 * @returns cookie 值，如果不存在则返回 null
 */
export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null
  }
  return null
}

/**
 * 获取所有 cookie
 * @returns 包含所有 cookie 键值对的对象
 */
export function getAllCookies(): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (document.cookie) {
    document.cookie.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=')
      if (name) {
        cookies[name] = rest.join('=')
      }
    })
  }
  return cookies
}
