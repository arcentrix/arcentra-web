# Arcentra Web

React + TypeScript + Vite 项目

## 环境变量配置

`VITE_API_CLIENT_URL` 支持两种使用模式：

### 模式 1: 通过代理请求（推荐用于同域部署）

设置相对路径，请求会发送到当前域名，由 Nginx/Vercel 等代理到后端：

```bash
# 开发环境 (`.env.development`)
VITE_API_CLIENT_URL=/api/v1

# 生产环境 (`.env.production`)
VITE_API_CLIENT_URL=/api/v1
```

**优点：** 避免跨域问题，cookie 认证更方便  
**缺点：** 需要配置反向代理

### 模式 2: 直接请求后端（推荐用于跨域部署）

设置完整 URL 或域名+路径，前端直接请求后端：

```bash
# 完整 URL（推荐）
VITE_API_CLIENT_URL=https://localhost:8080/api/v1/

# 或域名+路径（会自动添加 https://）
VITE_API_CLIENT_URL=localhost:8080/api/v1/

# HTTP 协议需要明确指定
VITE_API_CLIENT_URL=http://localhost:8080/api/v1/
```

**优点：** 无需配置代理，部署简单  
**缺点：** 需要处理跨域（CORS）和 cookie 设置

### 开发环境额外配置

```bash
# 后端服务地址 (仅用于 Vite proxy，模式 1 时需要)
VITE_API_URL=http://localhost:8080
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (支持 API 代理)
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果 (注意：不支持 API 代理)
pnpm preview
```

## API 请求模式说明

### 模式 1: 通过代理请求

#### 开发环境

Vite 开发服务器会自动代理 API 请求：

```
前端请求: /api/v1/user/login
代理到:   http://localhost:8080/api/v1/user/login
```

#### 生产环境（Nginx）

需要配置 Nginx 反向代理：

```nginx
# API 代理
location /api/ {
    proxy_pass http://backend:8080/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# 前端静态文件
location / {
    root /var/www/html/dist;
    try_files $uri $uri/ /index.html;
}
```

#### 生产环境（Vercel）

在 `vercel.json` 中配置代理：

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://localhost:8080/api/v1/:path*"
    }
  ]
}
```

### 模式 2: 直接请求后端

前端直接请求后端 API，无需配置代理。适用于：
- Vercel 等静态托管平台（无需配置代理）
- 后端已配置 CORS
- 跨域部署场景

### ⚠️ 注意事项

1. **打包时环境变量**：`VITE_API_CLIENT_URL` 会在构建时被打包进代码，修改后需要重新构建
2. **Vite Preview**：`pnpm preview` 不支持 Vite proxy，如需测试请使用模式 2 或部署到实际环境
3. **协议自动添加**：如果只设置域名+路径（如 `localhost:8080/api/v1/`），会自动添加 `https://`，如需 HTTP 请明确指定

## Browser acceptance

See [Browser acceptance](docs/browser-acceptance.md) for the official Chromium CI regression and the separate real-Control/Agent build-to-artifact journey. Simulated API regression is labeled explicitly and does not count as backend integration evidence.
