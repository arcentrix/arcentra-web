import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
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
    // 支持反向代理部署：可通过 VITE_BASE_PATH 环境变量配置子路径
    // 例如：VITE_BASE_PATH=/app/ pnpm build
    base: process.env.VITE_BASE_PATH || '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // API 代理配置，开发环境将 /api 请求转发到后端
        // 前端: /api/user/login -> 后端: http://localhost:8080/api/v1/user/login
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
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
        },
      },
    },
  }
})
