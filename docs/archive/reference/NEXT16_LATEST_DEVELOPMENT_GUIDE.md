# Next.js 16 Latest Development Guide

日期：2026-03-31

这份文档是给 NexusNote 团队的高信号实践版，不是把官方文档重写一遍。
目标是回答两个问题：

1. Next 16 现在推荐怎么开发
2. 在我们这个项目里应该怎么落

## 1. 先记住 6 条总原则

### 1.1 默认 Server Components

页面、布局、数据读取、权限判断，优先放在 Server Components。
只有真的需要浏览器状态、交互、动画、编辑器、`useState/useEffect` 时才加 `"use client"`.

### 1.2 Cache Components 是主线，不是附加项

Next 16 推荐用 Cache Components 来表达静态、半静态、个性化混合页面。
不要一上来就整页动态；优先做：

- 静态骨架
- 局部动态 island
- `Suspense`
- `cacheTag` / `cacheLife`

### 1.3 请求态数据必须显式动态边界

如果页面或 island 读取：

- `auth()`
- `cookies()`
- `headers()`
- request 级 redirect

就必须先 `await connection()`.

### 1.4 数据缓存要按“数据域”建模

不要用粗暴的全页 `force-dynamic` 或到处 `revalidatePath`.
推荐模式：

- server function 里 `"use cache"`
- `cacheTag("domain:user:id")`
- mutation 后精准 revalidate tag

### 1.5 Route Handlers 负责 AI streaming

聊天、生成、工作流流式输出，继续放 Route Handlers。
页面组件不要直接承担 streaming transport。

### 1.6 Client Components 只负责交互层

Client 组件应该吃已经准备好的数据，不要把 server-only 的对象、函数、数据库句柄、
图标工厂函数、render function 等直接传进去。

## 2. NexusNote 对应落法

### 2.1 页面认证

统一使用 [page-auth.ts](/Users/findbiao/projects/nexusnote/lib/server/page-auth.ts)：

- `getDynamicPageSession()`
- `requireDynamicPageAuth()`
- `redirectIfUnauthenticated()`

不要在 app page 里裸写：

```ts
await auth();
await requireAuth();
```

### 2.2 缓存

我们已经开启：

- `reactCompiler: true`
- `cacheComponents: true`

因此当前推荐写法是：

- 页面保留 Server Components
- 数据函数里用 `"use cache"`
- 用 `cacheTag()` 建精确数据域
- 用户态局部信息用动态 island 隔离

### 2.3 AI 页面

当前项目最合理的分层仍然是：

- app/page or app route page：负责组合页面
- Route Handlers：负责 stream transport
- `lib/ai/*`：负责 agent/workflow/tool/prompt/schema
- Client chat UI：只负责渲染 UIMessage parts

### 2.4 Learn / Interview / Golden Path

这三块都属于“静态结构 + 用户态上下文 + 局部动态”的典型场景：

- 页面骨架尽量 cacheable
- 用户会话与权限判断走动态边界
- 学习记录/最近课程/章节聊天上下文，作为动态 island 或动态页处理

## 3. 团队常见误区

### 3.1 误区：用 `force-dynamic` 一把梭

问题：

- 粗暴
- 性能差
- 失去 Cache Components 的价值

正确做法：

- 只给真正请求态逻辑加动态边界

### 3.2 误区：在 Server Component 里随手读 auth

问题：

- 线上容易出 `DYNAMIC_SERVER_USAGE`

正确做法：

- 统一走动态边界 helper

### 3.3 误区：Client 组件兜底服务器没返回的数据

问题：

- UI 看起来“正常”，但语义不可信

正确做法：

- 前端只渲染权威服务端数据
- 没有就明确显示空态

### 3.4 误区：把所有 personalized 内容都塞进页面顶层

问题：

- 让整页失去缓存价值

正确做法：

- personalized island + `Suspense`

## 4. 推荐开发流程

开发一个新页面时，按这个顺序判断：

1. 页面哪些部分是公共静态结构
2. 哪些部分是用户态或请求态
3. 静态数据是否可以 `"use cache"`
4. 动态数据是否要拆成 island
5. 是否需要 streaming Route Handler
6. mutation 后应该 revalidate 哪个 tag

## 5. 对我们最重要的官方结论

基于 Next.js 官方文档和官方发布说明，当前最重要的点是：

- Next 16 已经把 Cache Components 作为正式能力
- `connection()` 是请求态动态边界的官方 API
- App Router 继续是主路线
- React Compiler 在 Next 16 中已稳定
- 页面开发要围绕 Server Components + Cache Components + 局部动态边界来组织

## 6. 官方资料

建议优先读这些官方资料：

- Next.js 16 release: [https://nextjs.org/blog/next-16](https://nextjs.org/blog/next-16)
- `connection()` API: [https://nextjs.org/docs/app/api-reference/functions/connection](https://nextjs.org/docs/app/api-reference/functions/connection)
- Cache Components: [https://nextjs.org/docs/app/getting-started/cache-components](https://nextjs.org/docs/app/getting-started/cache-components)
- Caching and Revalidating: [https://nextjs.org/docs/app/getting-started/caching-and-revalidating](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
- Server and Client Components: [https://nextjs.org/docs/app/getting-started/server-and-client-components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- Route Handlers: [https://nextjs.org/docs/app/getting-started/route-handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

## 7. 我们现在离“Next 16 满分实践”还差什么

- 把发布链路做成可观测、可验证，而不是只依赖 CI 自动触发
- 给所有 request-bound page 建统一 helper 覆盖率检查
- 把 personalized island 进一步系统化，减少页面顶层动态依赖
- 为 cache tags 建一份全项目数据域字典
