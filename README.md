# Arcade Web

React + TypeScript + Vite 项目

## 环境变量配置

### 开发环境 (`.env.development`)

```bash
# API 基础路径 (会被 Vite proxy 代理到后端)
VITE_API_CLIENT_URL=/api

# 后端服务地址 (仅用于 Vite proxy)
VITE_API_URL=http://localhost:8080
```

### 生产环境 (`.env.production`)

```bash
# API 基础路径 (需要 Nginx 反向代理)
VITE_API_CLIENT_URL=/api

# 或者使用完整 URL
# VITE_API_CLIENT_URL=https://api.yourdomain.com/api
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

## API 代理说明

### 开发环境

开发服务器会自动代理 API 请求：

```
前端请求: /api/user/login
代理到:   http://localhost:8080/api/v1/user/login
```

### 生产环境

生产环境需要通过 Nginx 配置反向代理：

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

### ⚠️ 注意

`vite preview` 命令不支持 API 代理！如需测试生产构建的 API 调用：

1. 使用 `pnpm dev` 进行开发测试
2. 部署到带有 Nginx 的环境进行测试
3. 或临时设置完整 API URL：

```bash
VITE_API_CLIENT_URL=http://localhost:8080/api/v1 pnpm build
pnpm preview
```
