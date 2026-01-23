# 🔒 NexusNote 安全检查清单

## ⚠️ 立即行动项

### 1. API 密钥安全
- [ ] **确认 `.env` 文件未提交到 Git**
  ```bash
  git log --all --full-history -- .env
  # 应该没有输出
  ```

- [ ] **如果已提交，立即轮换所有密钥**
  - DeepSeek: https://platform.deepseek.com/api_keys
  - 302.ai: https://302.ai/account/api-keys
  - SiliconFlow: https://cloud.siliconflow.cn/account/ak

- [ ] **使用 `.env.example` 作为模板**
  ```bash
  cp .env.example .env
  # 然后填入真实密钥
  ```

### 2. JWT 密钥强度
- [ ] **生成强 JWT 密钥**
  ```bash
  # 生成 64 字符的随机密钥
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **更新 .env 文件**
  ```bash
  JWT_SECRET=<生成的随机密钥>
  ```

- [ ] **在 Render Dashboard 更新生产环境密钥**

### 3. 数据库安全
- [ ] **确认 PostgreSQL 密码强度**
- [ ] **限制数据库访问 IP**（Render 自动处理）
- [ ] **定期备份数据库**

### 4. Redis 安全
- [ ] **使用 TLS 连接**（Upstash 默认启用）
- [ ] **定期轮换 Redis 密码**

---

## 🛡️ 代码安全

### 5. API 认证
- [ ] **所有 API 端点添加认证**
  - `/documents/*` - 需要 JWT
  - `/rag/*` - 需要 JWT
  - `/snapshots/*` - 需要 JWT

- [ ] **实现用户权限检查**
  - 用户只能访问自己的文档
  - 用户只能搜索自己的知识库

### 6. 输入验证
- [ ] **所有 API 端点使用 DTO 验证**
- [ ] **限制输入长度**
  - 文档标题: 最多 200 字符
  - 学习目标: 最多 500 字符
  - 搜索查询: 最多 200 字符

### 7. 速率限制
- [ ] **添加全局速率限制**
  - 每分钟最多 60 个请求
  - AI API 每分钟最多 10 个请求

---

## 🚀 部署安全

### 8. Render 环境变量
- [ ] **Server 服务必需变量**:
  ```
  DATABASE_URL (自动配置)
  REDIS_URL
  JWT_SECRET
  DEEPSEEK_API_KEY
  AI_302_API_KEY
  CORS_ORIGIN
  ```

- [ ] **Web 服务必需变量**:
  ```
  NEXT_PUBLIC_API_URL (自动配置)
  NEXT_PUBLIC_COLLAB_URL
  ```

### 9. CORS 配置
- [ ] **验证 CORS_ORIGIN 正确**
  ```
  Server: CORS_ORIGIN=https://nexusnote-web.onrender.com
  ```

- [ ] **不要使用通配符 `*`**

### 10. HTTPS
- [ ] **确保所有连接使用 HTTPS**
  - Render 自动提供 HTTPS
  - WebSocket 使用 WSS

---

## 📊 监控和日志

### 11. 日志记录
- [ ] **记录所有 API 请求**
  - 时间戳
  - 用户 ID
  - 端点
  - 响应状态

- [ ] **记录安全事件**
  - 登录失败
  - 无效 Token
  - 权限拒绝

### 12. 错误处理
- [ ] **不要暴露敏感信息**
  ```typescript
  // ❌ 错误
  return { error: error.stack }
  
  // ✅ 正确
  return { error: 'Internal server error' }
  ```

- [ ] **使用结构化日志**
  ```typescript
  logger.error('Database query failed', {
    userId: req.user.id,
    query: 'SELECT ...',
    error: error.message,
  })
  ```

---

## 🧪 测试

### 13. 安全测试
- [ ] **测试认证绕过**
  - 尝试不带 Token 访问 API
  - 尝试使用过期 Token
  - 尝试使用伪造 Token

- [ ] **测试权限检查**
  - 尝试访问其他用户的文档
  - 尝试修改其他用户的数据

- [ ] **测试输入验证**
  - 超长输入
  - 特殊字符
  - SQL 注入尝试

---

## 📝 定期维护

### 14. 密钥轮换（每 90 天）
- [ ] JWT_SECRET
- [ ] API Keys
- [ ] 数据库密码

### 15. 依赖更新（每月）
- [ ] `npm audit fix`
- [ ] 检查安全公告
- [ ] 更新关键依赖

### 16. 备份验证（每周）
- [ ] 测试数据库恢复
- [ ] 验证备份完整性

---

## 🆘 安全事件响应

### 如果发现密钥泄露：

1. **立即轮换所有密钥**
2. **检查 API 使用日志**
3. **通知受影响用户**
4. **更新安全措施**
5. **记录事件和响应**

### 如果发现数据泄露：

1. **立即隔离受影响系统**
2. **评估泄露范围**
3. **通知用户和监管机构**
4. **修复漏洞**
5. **加强监控**

---

## ✅ 当前状态

| 项目 | 状态 | 备注 |
|------|------|------|
| .env 未提交 | ✅ | 已在 .gitignore |
| API 密钥安全 | ⚠️ | 需要验证是否泄露 |
| JWT 密钥强度 | ❌ | 使用默认值，需更换 |
| API 认证 | ❌ | 大部分端点无认证 |
| 输入验证 | ⚠️ | 部分端点有验证 |
| 速率限制 | ❌ | 未实现 |
| CORS 配置 | ✅ | 已正确配置 |
| HTTPS | ✅ | Render 自动提供 |
| 日志记录 | ⚠️ | 基础日志，需改进 |
| 监控告警 | ❌ | 未配置 |

---

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
