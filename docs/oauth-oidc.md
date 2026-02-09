## OAuth2 / OIDC 回调与重定向文档

本文件描述前端在 OAuth2 / OIDC 登录流程中的重定向、回调地址以及配置要点。

### 1. 术语说明

- **授权入口**：用户点击 OAuth / OIDC 登录按钮后跳转到第三方平台授权页面。
- **前端回调地址**：第三方平台授权完成后回跳到前端的地址。
- **后端回调地址**：前端拿到 `code` 后，跳转到后端完成登录并设置 Cookie 的地址。

### 2. 当前前端回调与后端回调地址

#### 2.1 前端回调（配置到第三方平台）

> 该地址必须在 OAuth / OIDC 平台的允许回调列表中配置。

```
http://<前端域名>/auth/callback/<provider>
```

示例：

- GitHub：`http://localhost:5173/auth/callback/github`
- OIDC：`http://localhost:5173/auth/callback/oidc`

#### 2.2 后端回调（前端内部跳转）

前端回调页会把 `code`/`state` 传递给后端回调完成登录，地址为：

```
/api/v1/identity/callback/<provider>?code=...&state=...
```

示例：

- `/api/v1/identity/callback/github?code=...&state=...`

### 3. 登录流程（简化）

1. 前端点击登录 → 调用后端授权入口：
   ```
   /api/v1/identity/authorize/<provider>?redirect_uri=http://<前端域名>/auth/callback/<provider>
   ```
2. 第三方授权完成 → 跳回前端回调页：
   ```
   http://<前端域名>/auth/callback/<provider>?code=...&state=...
   ```
3. 前端回调页跳转到后端回调：
   ```
   /api/v1/identity/callback/<provider>?code=...&state=...
   ```
4. 后端完成登录并设置 Cookie → 重定向回前端首页：
   ```
   http://<前端域名>/
   ```

### 4. 需要配置的位置

#### 4.1 第三方 OAuth / OIDC 平台

必须将 **前端回调地址**加入允许回调列表：

```
http://<前端域名>/auth/callback/<provider>
```

#### 4.2 后端 Identity Provider 配置

需要配置以下信息（示例为 GitHub）：

- `clientId`
- `clientSecret`
- `authURL`（例：`https://github.com/login/oauth/authorize`）
- `tokenURL`（例：`https://github.com/login/oauth/access_token`）
- `userInfoURL`（例：`https://api.github.com/user`）
- `redirectURL`（与前端回调地址一致）

### 5. 开发环境常见地址示例

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8080`
- OAuth 回调（前端）：`http://localhost:5173/auth/callback/github`
- 后端回调（前端内部跳转）：`/api/v1/identity/callback/github`

### 6. 常见问题排查

- **redirect_uri not associated**  
  说明第三方平台未配置前端回调地址。

- **invalid state parameter**  
  通常是重复调用后端回调导致 state 被消费。

- **Token cannot be empty / Invalid token**  
  通常是 Cookie 未写入或未被正确发送，可检查浏览器 Cookie、代理配置及后端 Cookie 设置策略。
