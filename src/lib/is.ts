export function isDev() {
  return import.meta.env.DEV
}

export function isProd() {
  return import.meta.env.PROD
}

export function isMobile() {
  return /(?:iPad)|(?:iPhone)|(?:iPod)|(?:android)|(?:webOS)/i.test(navigator.userAgent)
}
