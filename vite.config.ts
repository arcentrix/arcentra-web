import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [react()]

  if (mode === 'analysis' && command === 'build') {
    plugins.push(
      visualizer({
        open: true,
        filename: `dist/analysis.html`,
      }),
    )
  }

  return {
    plugins,
    base: process.env.VITE_BASE_PATH || '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/v1/ws': {
          target: process.env.VITE_API_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          ws: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
              // 从浏览器请求头透传 Authorization（最推荐）
              const auth = req.headers['authorization'];
              if (auth) {
                proxyReq.setHeader('Authorization', auth);
              }
            })
          },
        },
        // SSE 日志流接口特殊处理，需要保持连接打开
        '/api/v1/events': {
          target: process.env.VITE_API_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          ws: false, // SSE 不是 WebSocket
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['content-type'] = 'text/event-stream';
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
            });
          },
        },
        '/api': {
          target: process.env.VITE_API_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          secure: false,
          // 确保 Cookie 被正确传递
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
          // 配置代理请求和响应，确保 Cookie 被转发
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // 确保 Cookie 被转发到后端
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie)
              }
              if (req?.url?.startsWith('/api/v1/users/fetch') || req?.url?.startsWith('/api/v1/users/refresh') || req?.url?.startsWith('/api/v1/users/logout')) {
                const cookieHeader = req.headers.cookie || ''
                const accessTokenCookie = cookieHeader
                  .split(';')
                  .map((item) => item.trim())
                  .find((item) => item.startsWith('accessToken='))
                if (accessTokenCookie) {
                  const tokenValue = accessTokenCookie.slice('accessToken='.length)
                  if (tokenValue) {
                    proxyReq.setHeader('Authorization', `Bearer ${tokenValue}`)
                  }
                }
              }
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              if (req?.url?.startsWith('/api/v1/identity/callback')) {
                const setCookieHeaders = proxyRes.headers['set-cookie']
              }
              // 确保后端设置的 Cookie 被正确返回
              const setCookieHeaders = proxyRes.headers['set-cookie']
              if (setCookieHeaders) {
                // 修改 Cookie 的域名和路径，确保前端可以接收
                proxyRes.headers['set-cookie'] = setCookieHeaders.map((cookie) => {
                  return cookie
                    .replace(/Domain=[^;]+/gi, '') // 移除 Domain
                    .replace(/Path=[^;]+/gi, 'Path=/') // 设置 Path 为 /
                    .replace(/Secure/gi, '') // 开发环境移除 Secure
                    .replace(/SameSite=None/gi, 'SameSite=Lax') // 修改 SameSite
                })
              }
            })
          },
        },
      },
    },
    build: {
      sourcemap: mode === 'analysis',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
          },

          assetFileNames: (assetInfo) => {
            const ext = assetInfo.name?.split('.').pop()?.toLowerCase()

            if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) {
              return 'images/[name]-[hash][extname]'
            }

            if (['js'].includes(ext || '')) {
              return 'assets/js/[name]-[hash][extname]'
            }

            if (['css'].includes(ext || '')) {
              return 'assets/css/[name]-[hash][extname]'
            }

            if (['woff', 'woff2', 'ttf', 'eot'].includes(ext || '')) {
              return 'fonts/[name]-[hash][extname]'
            }

            return 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
  }
})
